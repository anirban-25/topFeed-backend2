import admin from 'firebase-admin';
import axios from 'axios';

// Fetch user notification settings from Firestore
export async function getUserNotificationSettings(userId) {
  try {
    const docRef = admin.firestore().doc(`notifications/${userId}`);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching user notification settings:", error);
    return null;
  }
}

// Send a Telegram message via Telegram API
export async function sendTelegramMessage(telegramAccount, message) {
  try {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    console.log("telegram account " + telegramAccount + "token" + telegramToken);
    const response = await axios.post(url, {
      chat_id: telegramAccount,
      text: message,
    });
    return response.data;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    throw new Error("Failed to send Telegram message");
  }
}
