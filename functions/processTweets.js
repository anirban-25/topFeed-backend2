const axios = require("axios");
const { parse } = require("node-html-parser");
const admin = require("firebase-admin");
const { OpenAI } = require("openai");
const { parseISO, subHours } = require("date-fns");
const { getUserNotificationSettings, sendTelegramMessage } = require("../utils/notificationUtils");
const { storeDataInFirestore } = require("../utils/storeTwitterData");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const MODEL = "gpt-4";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Utility Functions
function extractLinks(text) {
  const urlPattern = /https?:\/\/\S+|www\.\S+/g;
  return text.match(urlPattern) || [];
}

function excludeLinks(text) {
  const urlPattern = /https?:\/\/\S+|www\.\S+|\b\w+\.com\b|\b\w+\.\S+/g;
  return text.replace(urlPattern, "");
}

async function fetchMetaTitle(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      timeout: 5000,
    });
    if (response.status === 200) {
      const root = parse(response.data);
      const title = root.querySelector("title")?.text ||
        root.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        root.querySelector('meta[name="twitter:title"]')?.getAttribute("content") ||
        "No Title Found";
      return title.trim();
    }
    return "Failed to fetch";
  } catch (error) {
    console.error(`Error fetching meta title for ${url}: ${error.message}`);
    return url;
  }
}

function shouldSendNotification(relevancy, notificationLevels) {
  const lowercasedRelevancy = relevancy.toLowerCase();
  const lowercasedNotificationLevels = notificationLevels.map(level => level.toLowerCase());
  return lowercasedNotificationLevels.includes(lowercasedRelevancy);
}

async function feedToGPT(filtered, newTopic, notificationLevels, telegramUserId) {
  for (const row of filtered) {
    const title = String(row.text).trim();
    const contentText = String(row.meta_titles);
    const summaryInput = `text: ${title}\nMeta Title of Data mentioned via url: ${contentText}`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: `You are an AI assistant helping to categorize tweets based on their relevancy to -> ${newTopic}.` },
          { role: "user", content: title }
        ],
        max_tokens: 3000,
        temperature: 0,
      });
      row.relevancy = response.choices[0].message.content ?? "low";
      if (shouldSendNotification(row.relevancy, notificationLevels)) {
        await sendTelegramMessage(telegramUserId, row.url);
      }
    } catch (error) {
      console.error(`Error in GPT-4 processing: ${error}`);
    }
  }
  return filtered;
}

async function fetchRssFeeds(urls, newTopic, notificationLevels, telegramUserId) {
  const twitterData = [];

  for (const url of urls) {
    try {
      const response = await axios.get(url);
      if (response.status === 200) {
        const items = response.data.items || [];
        for (const item of items) {
          twitterData.push({
            title: item.title,
            link: item.link,
            date_published: item.date_published,
            content_html: item.content_html,
            content_text: item.content_text,
            url: item.url,
            authors: item.authors,
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching RSS feed: ${error}`);
    }
  }

  const currentDate = new Date();
  const twoWeeksAgo = subHours(currentDate, 12 * 2);
  const filteredData = twitterData
    .filter(item => parseISO(item.date_published) > twoWeeksAgo)
    .map(item => ({
      ...item,
      links: extractLinks(item.content_text),
      text: excludeLinks(item.content_text),
    }));

  for (const item of filteredData) {
    item.meta_titles = await Promise.all((item.links ?? []).map(fetchMetaTitle));
  }

  const filtered = filteredData.map(({ text, meta_titles, url, content_html, authors }) => ({
    text: text ?? "",
    meta_titles: meta_titles ?? [],
    url,
    content_html,
    authors: authors?.map(author => ({ name: author })),
  }));

  return feedToGPT(filtered, newTopic, notificationLevels, telegramUserId);
}

async function fetchFeeds(twitterUrls, newTopic, notificationLevels, telegramUserId) {
  const urls = [];
  const apiUrl = "https://api.rss.app/v1/feeds";
  const headers = {
    Authorization: `Bearer ${process.env.RSS_API_KEY}`,
    "Content-Type": "application/json",
  };

  for (const twitterUrl of twitterUrls) {
    const query = await db.collection("all_tweet_feeds").where("twitter_url", "==", twitterUrl).limit(1).get();
    if (!query.empty) {
      const doc = query.docs[0];
      urls.push(doc.data().rss_feed_url);
    } else {
      try {
        const response = await axios.post(apiUrl, { url: twitterUrl }, { headers });
        if (response.status === 200 && response.data.rss_feed_url) {
          const feedId = response.data.rss_feed_url.split("/").pop()?.replace(".xml", "");
          const newFeedUrl = `http://rss.app/feeds/v1.1/${feedId}.json`;
          urls.push(newFeedUrl);

          await db.collection("all_tweet_feeds").add({
            twitter_url: twitterUrl,
            rss_feed_url: newFeedUrl,
          });
        }
      } catch (error) {
        console.error(`Error processing URL ${twitterUrl}: ${error}`);
      }
    }
  }

  return fetchRssFeeds(urls, newTopic, notificationLevels, telegramUserId);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { twitterUrls, newTopic, userId } = JSON.parse(event.body);

    if (!twitterUrls || !newTopic || !Array.isArray(twitterUrls)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid input. 'twitterUrls' must be an array and 'newTopic' is required.",
        }),
      };
    }

    let notificationLevels = [];
    let telegramUserId = "";
    try {
      const userSettings = await getUserNotificationSettings(userId);
      if (userSettings) {
        notificationLevels = userSettings.notificationLevels || [];
        telegramUserId = userSettings.telegramUserId || "";
      }
    } catch (error) {
      console.error("Error fetching user settings:", error);
    }

    const dfFinal = await fetchFeeds(twitterUrls, newTopic, notificationLevels, telegramUserId);

    const transformedData = dfFinal.map(item => ({
      content_html: item.content_html || "",
      relevancy: item.relevancy || "low",
      authors: item.authors || [],
    }));

    await storeDataInFirestore(transformedData, userId);

    return {
      statusCode: 200,
      body: JSON.stringify({ result: dfFinal }),
    };
  } catch (error) {
    console.error(`Error processing data: ${error}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(error) }),
    };
  }
};
