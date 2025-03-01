import axios from "axios";
import { parse } from "node-html-parser";
import "dotenv/config";
import admin from "firebase-admin";
import OpenAI from "openai";
import { parseISO, subHours } from "date-fns";
import {
  getUserNotificationSettings,
  sendTelegramMessage,
} from "../utils/notificationUtils.js";
import { storeDataInFirestore } from "../utils/storeTwitterData.js";
import { doc, getFirestore, setDoc } from "firebase/firestore";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "topfeed-123",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:
        "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1OnfEjnPLfrSo\nOCujizCA5Qb8yg7rcztlyRkXaPI/a5IJeBw/m6kJM9j/uaYKo1Dx10V2CjB4Xc4S\nWCWfv3NZTb7VLZ2zAkIyd3lPNoRQMzTHvkCpTBxvTcTTtrhSkJTtFNnz1QKkHkEQ\n82G1IsFDux87zvAe3nq1PD3UwXzrk1KFUvsDOcfoOIQLuTswsWpW+uV6ouXS13ca\nk6Lm4kgAZnitLbKTLnfYJxBoFzx/i/UPlA0PAPjBgtBpF95xofbOe6+z/HNxivsb\nXRaX1AaPZ0tEVhXXVLcrrz9chEKdSXaK1gpd/V4xWexSexV2j2F2MgV9hDsS4SzR\nA82gTNZXAgMBAAECggEAV/cNvEPS09LoGIDPOb4taFsChcAD9ugDTDgMrE69yufJ\nRjxdJcjGBxf5+8JeZGp6NzDg39c5SKtrg37yoDQa5p10g9/03Dc772gLY1YYah84\nvr1LgIFXifULFSJrHHRePSdyVUau1f9zYKlp4zR/74LLucmLxsgBcqfPcU4LdwJF\nN5qgXbKlsWyrQ/qbDzxnZqXwL6TipT4NVKQ9QpflY+DF+B1D4dTH07zitJJI1Caq\nzhgUAsTN/XCpcqbTI61UgLT+mvS3XlaHoVvdIZBRPJI/MeJx2Ro9qQ9FVHnsR+ky\nR2xYYhYuEyTi1sTvOOz4LPN6t02HcVTeRwjdTUYiSQKBgQDlY1WUq5YlzYD1XkZq\nUXa5ro8/5JOvv4MxTWhCT9wumsPyVvEgQ2EhrRNLKz35Xeegy2MJ9Ek4NMjO7ChF\n4tjT/6IwbA/2kAU2dEy1aUl07oPnp2vlTfcvVqAT4bGZ/81O7hRudDpI9X1Bfoe1\n3fGQuaDcaYPlCJoN9Zr04RM1mQKBgQDKQNNhEYo7Tpnz1uQVFMheM4Bb2lXNjjcf\nmw9leekAxurrLtZg3bu5GA0E2MKSmkCPBjSPb8ZjhVZt1MQPThERiZVb878pKi13\nK692Nf5rpwhi1dWyyZvtDaOMpjOlnmcQd1+5EPpPBoW9nCNSSVVbg9qcLnbMtkcj\nyHPAp7sBbwKBgCaRZBNCIlWqztLyje5UUhz4L5ezi+1RyvIgLLZxjPi9BtMZMSOW\nkJ9D5WmPFLV3x3kumTFURHdR0K2R4VeWw5QpeBCiKrDvGCFGvpsF39bsP3tUl/yO\n9k+cRf/xw5W7/74Uo5TKr/4SYIQBjTnT3kjSHSzSBN4eayCLugkQStWJAoGAZmJa\nnxDaARvRI3btDx7uL4GywMzOErijfwRnzt7f7NzFnzienXqhxRk/vexc0wnzFHP3\nt4TF0St2jTLf7T9/tHkJevrxEk2fpmwe7qB2othzjlThURhuLppw6IpaKsT9N4C2\nnGDT1Z1fppSb7NPiuekNiXKcARVk/eBDeItwR1ECgYEAw4sCxMM2Z8iP030erkAn\nX53u/wfSWScsMvnTr/kCp2lILFlIVUGdtpoxbFzPj6e3mH+gOlcs4pOKSZshC3q3\n/H0zAF3fRq1i3mvKRRWIfouePytf5TfmV9hpL9RmaIfkGjWuNGthncRLqeDuWqVI\n68L1U5jvaM2RZmOlyS1nCqU=\n-----END PRIVATE KEY-----\n",
    }),
  });
}

const db = admin.firestore();

let last_date = null;
const MODEL = "gpt-4o";
const api_key = process.env.OPENAI_API_KEY;

const client = new OpenAI({ apiKey: api_key });

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
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 5000,
    });
    if (response.status === 200) {
      const root = parse(response.data);
      const title =
        root.querySelector("title")?.text ||
        root
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content") ||
        root
          .querySelector('meta[name="twitter:title"]')
          ?.getAttribute("content") ||
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
  const lowercasedNotificationLevels = notificationLevels.map((level) =>
    level.toLowerCase()
  );
  return lowercasedNotificationLevels.includes(lowercasedRelevancy);
}

async function feedToGPT(
  filtered,
  newTopic,
  notificationLevels,
  telegramUserIds
) {
  for (const row of filtered) {
    console.log(row.title);
    const str = String(row.title);
    const firstColonIndex = str.indexOf(":");
    const extractedText = str.substring(firstColonIndex + 2); // +2 to skip the ': ' part
    console.log(extractedText);
    // const title = String(row.text).trim();
    const contentText = String(row.meta_titles);
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping to categorize tweets based on their relevancy to -> ${newTopic}. 

STEP 1: Topic Type Classification
First, determine if the topic contains any of these types:
- Personality topics: Names of specific people 
- General topics: Abstract concepts, events, or subjects 

STEP 2: Apply Relevancy Rules Based on Topic Type

For Personality Topics:
- HIGH Relevancy: Any direct mention of the person's name, UNLESS it's clearly used in an unrelated context (e.g., "trump card")
- LOW Relevancy: Only if the name appears in a completely unrelated context OR doesn't appear at all

For General Topics:
1. HIGH Relevancy: The tweet directly discusses or provides substantial focus on the topic
2. MEDIUM Relevancy: The tweet mentions or partially aligns with the topic but without detailed focus
3. LOW Relevancy: The tweet has no meaningful connection to the topic

For Mixed Topics (containing both personality and general elements):
- Apply personality rules first
- If no personality match is found, apply general topic rules

You will provide a one-word answer: High, Medium, or Low.

Remember: For personality-based topics like "Trump" or "Biden", ANY direct reference to the person should be marked as HIGH unless it's clearly using the name in an unrelated context.`,
          },
          { role: "user", content: extractedText },
        ],
        max_tokens: 3000,
        temperature: 0,
      });
      row.relevancy = response.choices[0].message.content ?? "low";
      console.log("hiiiiiiiii\n");
      console.log(extractedText);
      console.log(row.relevancy + "   " + notificationLevels);

      try {
        if (shouldSendNotification(row.relevancy, notificationLevels)) {
          console.log("should send notification");
          const message = `${row.relevancy} relevancy tweet: ${row.url}`;

          // Send to all recipients if there are any
          if (telegramUserIds.length > 0) {
            console.log("send notification for users: " + telegramUserIds.join(", "));
            const sendPromises = telegramUserIds.map((userId) =>
              sendTelegramMessage(userId, message)
            );
            await Promise.all(sendPromises);
          }
        } else {
          console.log("should not send notification");
        }
      } catch (error) {
        console.log("Error sending notifications:", error);
      }
    } catch (error) {
      console.error(`Error in GPT-4 processing: ${error}`);
    }
  }
  return filtered;
}

async function fetchRssFeeds(
  urls,
  newTopic,
  notificationLevels,
  telegramUserIds,
  userId
) {
  const twitterData = [];

  for (const url of urls) {
    try {
      const response = await axios.get(url);
      if (response.status === 200) {
        const items = response.data.items || [];
        for (const item of items) {
          const currentDate = new Date(item.date_published);
          if (!last_date || currentDate > last_date) {
            last_date = currentDate;
          }
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
        if (last_date) {
          try {
            const db = getFirestore();
            const userRef = doc(db, "users", userId);
            await setDoc(
              userRef,
              { last_date: last_date.toISOString() },
              { merge: true }
            );
            console.log("Last date successfully stored in Firestore");
          } catch (error) {
            console.error("Error storing last date in Firestore:", error);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching RSS feed: ${error}`);
    }
  }

  const currentDate = new Date();
  const twoWeeksAgo = subHours(currentDate, 12 * 2);
  const filteredData = twitterData
    .filter((item) => parseISO(item.date_published) > twoWeeksAgo)
    .sort(
      (a, b) =>
        parseISO(b.date_published).getTime() -
        parseISO(a.date_published).getTime()
    )
    .map((item) => ({
      ...item,
      links: extractLinks(item.content_text),
      text: excludeLinks(item.content_text),
    }));

  for (const item of filteredData) {
    item.meta_titles = await Promise.all(
      (item.links ?? []).map(fetchMetaTitle)
    );
  }

  const filtered = filteredData.map(
    ({ text, meta_titles, url, content_html, authors, title }) => ({
      text: text ?? "",
      meta_titles: meta_titles ?? [],
      url,
      content_html,
      authors: authors?.map((author) => ({ name: author.name || author })), // Change here
      title,
    })
  );
  return feedToGPT(filtered, newTopic, notificationLevels, telegramUserIds);
}

async function fetchFeeds(
  twitterUrls,
  newTopic,
  notificationLevels,
  telegramUserIds,
  userId
) {
  const urls = [];
  const apiUrl = "https://api.rss.app/v1/feeds";
  const headers = {
    Authorization: "Bearer c_nNbfzK4dAWoTxY:s_WIHFi2i4TLEx6YFbNvitWY",
    "Content-Type": "application/json",
  };

  for (const twitterUrl of twitterUrls) {
    const query = await db
      .collection("all_tweet_feeds")
      .where("twitter_url", "==", twitterUrl)
      .limit(1)
      .get();

    if (!query.empty) {
      const doc = query.docs[0];
      urls.push(doc.data().rss_feed_url);
    } else {
      try {
        const response = await axios.post(
          apiUrl,
          { url: twitterUrl },
          { headers }
        );
        if (response.status === 200 && response.data.rss_feed_url) {
          const feedId = response.data.rss_feed_url
            .split("/")
            .pop()
            ?.replace(".xml", "");
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

  return fetchRssFeeds(
    urls,
    newTopic,
    notificationLevels,
    telegramUserIds,
    userId
  );
}

export default async function feedController(req, res) {
  try {
    const { twitterUrls, newTopic, userId } = req.body;

    if (!twitterUrls || !newTopic || !Array.isArray(twitterUrls)) {
      return res.status(400).json({
        error:
          "Invalid input. 'twitterUrls' must be an array and 'newTopic' is required.",
      });
    }

    let notificationLevels = [];
    let telegramUserIds = [];
    try {
      const userSettings = await getUserNotificationSettings(userId);
      if (userSettings) {
        console.log("Settings notifications:", userSettings.notificationLevels);
        notificationLevels = userSettings.notificationLevels || [];

        // Initialize array with individual telegramUserId if it exists
        if (userSettings.telegramUserId && userSettings.sendTo === true) {
          telegramUserIds.push(userSettings.telegramUserId);
        }
        // Add group IDs if they exist
        if (userSettings.groups && Array.isArray(userSettings.groups)) {
          const groupIds = userSettings.groups.map((group) => group.id);
          telegramUserIds = [...telegramUserIds, ...groupIds];
        }
        console.log("telegramUserIds" + telegramUserIds);
      }
    } catch (error) {
      console.error("Error fetching user settings:", error);
    }
    const dfFinal = await fetchFeeds(
      twitterUrls,
      newTopic,
      notificationLevels,
      telegramUserIds,
      userId
    );

    const transformedData = dfFinal.map((item) => ({
      content_html: item.content_html || "",
      relevancy: item.relevancy || "low",
      authors: item.authors || [],
      created_at: new Date(),
    }));

    await storeDataInFirestore(transformedData, userId);
    res.json({ result: dfFinal });
  } catch (error) {
    console.error(`Error processing data: ${error}`);
    res.status(500).json({ error: String(error) });
  }
}
