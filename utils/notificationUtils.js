const admin = require('firebase-admin');
const axios = require('axios');

/**
 * Get user notification settings
 * @param {string} userId 
 * @returns {Promise<Object|null>}
 */
async function getUserNotificationSettings(userId) {
  try {
    console.log("Trying to fetch user settings for userId:", userId);
    const db = admin.firestore();
    const notificationDocRef = db.doc(`notifications/${userId}`);
    const docSnap = await notificationDocRef.get();
    if (docSnap.exists) {
      console.log("Document found:", docSnap.data());
      return docSnap.data();
    } else {
      console.log("No notification settings found for user:", userId);
      return null;
    }
  } catch (error) {
    console.log("Error fetching user notification settings:", error);
    return null;
  }
}

/**
 * Send a message to the user's Telegram account
 * @param {string} telegramAccount 
 * @param {string} message 
 * @returns {Promise<Object>}
 */
async function sendTelegramMessage(telegramAccount, message) {
  try {
    console.log("Sending message to Telegram account:", telegramAccount);
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = telegramAccount;
    
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: telegramChatId,
      text: message,
    });

    console.log("Telegram message sent:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    throw new Error("Failed to send Telegram message");
  }
}

module.exports = { getUserNotificationSettings, sendTelegramMessage };