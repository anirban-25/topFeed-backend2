import { InvokeCommand } from '@aws-sdk/client-lambda';
import { storeDataInFirestore } from "../utils/storeRedditData.js";
import { getUserNotificationSettings, sendTelegramMessage } from "../utils/notificationUtils.js";
import { lambdaClient } from '../config/awsConfig.js';

export async function processRedditData(req, res) {
  try {
    const { subreddits, userId } = req.body;

    console.log("Subreddits:", subreddits);
    console.log("User ID:", userId);
    console.log("-------------------------------------------");

    const eventPayload = {
      body: JSON.stringify({ subreddits }),
    };

    const params = {
      FunctionName: "chatgpt",
      Payload: JSON.stringify(eventPayload),
    };

    const command = new InvokeCommand(params);
    const lambdaResponse = await lambdaClient.send(command);
    console.log("Lambda response:", lambdaResponse);

    if (lambdaResponse.StatusCode === 200 && lambdaResponse.Payload) {
      const parsedResponse = JSON.parse(Buffer.from(lambdaResponse.Payload).toString());

      if (parsedResponse.statusCode === 400) {
        return res.status(400).json({ error: parsedResponse.body });
      }

      const parsedBody = JSON.parse(parsedResponse.body);
      const analysisData = parsedBody;

      console.log("Analysis data to store in Firestore:", analysisData);

      if (!analysisData) {
        throw new Error("No analysis data found in the Lambda response.");
      }

      await storeDataInFirestore(analysisData, userId, subreddits);
      console.log("Fetching user notification settings for:", userId);

      const userSettings = await getUserNotificationSettings(userId);
      console.log("Fetched User Settings:", userSettings);

      if (userSettings && userSettings.istelegram === true && userSettings.isActive === true && userSettings.reddit === true) {
        console.log("conditions matched lessgo");
        const message = `New Reddit analysis data available for subreddits: ${subreddits.join(', ')}`;
        await sendTelegramMessage(userSettings.telegramUserId, message);
        console.log("Telegram message sent successfully.");
      }

      res.status(200).json({ message: "Data processed, stored, and notification sent if applicable", analysisData });
    } else {
      res.status(500).json({ error: "Failed to invoke Lambda function" });
    }
  } catch (error) {
    console.error("Error in API route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}