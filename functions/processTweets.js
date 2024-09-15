const axios = require("axios");
const { parse } = require("node-html-parser");
const admin = require("firebase-admin");
const { OpenAI } = require("openai");
const { parseISO, subHours } = require("date-fns");
const { getUserNotificationSettings, sendTelegramMessage } = require("./notificationUtils");
const { storeDataInFirestore } = require("./storeTwitterData");

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

// ... (rest of the utility functions remain the same)

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