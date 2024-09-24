import axios from 'axios';
import { parse } from 'node-html-parser';
import { parseISO, subHours, subMinutes } from 'date-fns';
import OpenAI from 'openai';
import admin from "firebase-admin"
import { getFirestore } from '../config/firebase.js';

const MODEL = "gpt-4o";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
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

async function classifyTweetRelevance(tweet, topic) {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are an AI assistant helping to categorize tweets based on their relevancy to -> ${topic}. Provide one word answer: High, Medium, or Low. High Relevancy: The tweet directly discusses key elements of the topic in detail. Medium Relevancy: The tweet mentions elements of the topic but doesn't focus exclusively on them. Low Relevancy: The tweet mentions related but distinct topics or focuses on other areas.`
        },
        { role: "user", content: tweet }
      ],
      max_tokens: 1,
      temperature: 0,
    });
    return response.choices[0].message.content.toLowerCase();
  } catch (error) {
    console.error(`Error in GPT-4 processing: ${error}`);
    return "low";
  }
}

async function fetchRssFeeds(urls, topic) {
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
  const fifteenMinutesAgo = subHours(currentDate, 10);
  const filteredData = twitterData
    .filter(item => parseISO(item.date_published) > fifteenMinutesAgo)
    .sort((a, b) => parseISO(b.date_published).getTime() - parseISO(a.date_published).getTime())
    .map(item => ({
      ...item,
      links: extractLinks(item.content_text),
      text: excludeLinks(item.content_text),
    }));

  for (const item of filteredData) {
    item.meta_titles = await Promise.all((item.links ?? []).map(fetchMetaTitle));
  }

  const processedTweets = await Promise.all(filteredData.map(async (item) => {
    const relevancy = await classifyTweetRelevance(item.text, topic);
    return {
      content_html: item.content_html,
      authors: item.authors,
      relevancy: relevancy,
      url: item.url,
      text: item.text,
      meta_titles: item.meta_titles,
    };
  }));

  return processedTweets;
}

export async function fetchFeeds(twitterUrls, topic, userId) {
  const urls = [];
  const apiUrl = "https://api.rss.app/v1/feeds";
  const headers = {
    Authorization: "Bearer c_nNbfzK4dAWoTxY:s_WIHFi2i4TLEx6YFbNvitWY",
    "Content-Type": "application/json",
  };
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "topfeed-123",
        clientEmail:
          "firebase-adminsdk-6mx07@topfeed-123.iam.gserviceaccount.com",
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1OnfEjnPLfrSo\nOCujizCA5Qb8yg7rcztlyRkXaPI/a5IJeBw/m6kJM9j/uaYKo1Dx10V2CjB4Xc4S\nWCWfv3NZTb7VLZ2zAkIyd3lPNoRQMzTHvkCpTBxvTcTTtrhSkJTtFNnz1QKkHkEQ\n82G1IsFDux87zvAe3nq1PD3UwXzrk1KFUvsDOcfoOIQLuTswsWpW+uV6ouXS13ca\nk6Lm4kgAZnitLbKTLnfYJxBoFzx/i/UPlA0PAPjBgtBpF95xofbOe6+z/HNxivsb\nXRaX1AaPZ0tEVhXXVLcrrz9chEKdSXaK1gpd/V4xWexSexV2j2F2MgV9hDsS4SzR\nA82gTNZXAgMBAAECggEAV/cNvEPS09LoGIDPOb4taFsChcAD9ugDTDgMrE69yufJ\nRjxdJcjGBxf5+8JeZGp6NzDg39c5SKtrg37yoDQa5p10g9/03Dc772gLY1YYah84\nvr1LgIFXifULFSJrHHRePSdyVUau1f9zYKlp4zR/74LLucmLxsgBcqfPcU4LdwJF\nN5qgXbKlsWyrQ/qbDzxnZqXwL6TipT4NVKQ9QpflY+DF+B1D4dTH07zitJJI1Caq\nzhgUAsTN/XCpcqbTI61UgLT+mvS3XlaHoVvdIZBRPJI/MeJx2Ro9qQ9FVHnsR+ky\nR2xYYhYuEyTi1sTvOOz4LPN6t02HcVTeRwjdTUYiSQKBgQDlY1WUq5YlzYD1XkZq\nUXa5ro8/5JOvv4MxTWhCT9wumsPyVvEgQ2EhrRNLKz35Xeegy2MJ9Ek4NMjO7ChF\n4tjT/6IwbA/2kAU2dEy1aUl07oPnp2vlTfcvVqAT4bGZ/81O7hRudDpI9X1Bfoe1\n3fGQuaDcaYPlCJoN9Zr04RM1mQKBgQDKQNNhEYo7Tpnz1uQVFMheM4Bb2lXNjjcf\nmw9leekAxurrLtZg3bu5GA0E2MKSmkCPBjSPb8ZjhVZt1MQPThERiZVb878pKi13\nK692Nf5rpwhi1dWyyZvtDaOMpjOlnmcQd1+5EPpPBoW9nCNSSVVbg9qcLnbMtkcj\nyHPAp7sBbwKBgCaRZBNCIlWqztLyje5UUhz4L5ezi+1RyvIgLLZxjPi9BtMZMSOW\nkJ9D5WmPFLV3x3kumTFURHdR0K2R4VeWw5QpeBCiKrDvGCFGvpsF39bsP3tUl/yO\n9k+cRf/xw5W7/74Uo5TKr/4SYIQBjTnT3kjSHSzSBN4eayCLugkQStWJAoGAZmJa\nnxDaARvRI3btDx7uL4GywMzOErijfwRnzt7f7NzFnzienXqhxRk/vexc0wnzFHP3\nt4TF0St2jTLf7T9/tHkJevrxEk2fpmwe7qB2othzjlThURhuLppw6IpaKsT9N4C2\nnGDT1Z1fppSb7NPiuekNiXKcARVk/eBDeItwR1ECgYEAw4sCxMM2Z8iP030erkAn\nX53u/wfSWScsMvnTr/kCp2lILFlIVUGdtpoxbFzPj6e3mH+gOlcs4pOKSZshC3q3\n/H0zAF3fRq1i3mvKRRWIfouePytf5TfmV9hpL9RmaIfkGjWuNGthncRLqeDuWqVI\n68L1U5jvaM2RZmOlyS1nCqU=\n-----END PRIVATE KEY-----\n",
      }),
    });
  }
  const db = admin.firestore();

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

  return fetchRssFeeds(urls, topic);
}