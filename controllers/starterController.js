import admin from "firebase-admin";
import { fetchFeeds } from "../services/feedService.js";
import {
  getUserNotificationSettings,
  sendTelegramMessage,
} from "../utils/notificationUtils.js";

export async function processStarter(req, res) {
  try {
    console.log("Starting processStarter");
    const forceRefresh = req.query.refresh === "true";

    if (forceRefresh) {
      console.log("Force refresh requested. Bypassing cache.");
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: "topfeed-123",
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY,privateKey:
            "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1OnfEjnPLfrSo\nOCujizCA5Qb8yg7rcztlyRkXaPI/a5IJeBw/m6kJM9j/uaYKo1Dx10V2CjB4Xc4S\nWCWfv3NZTb7VLZ2zAkIyd3lPNoRQMzTHvkCpTBxvTcTTtrhSkJTtFNnz1QKkHkEQ\n82G1IsFDux87zvAe3nq1PD3UwXzrk1KFUvsDOcfoOIQLuTswsWpW+uV6ouXS13ca\nk6Lm4kgAZnitLbKTLnfYJxBoFzx/i/UPlA0PAPjBgtBpF95xofbOe6+z/HNxivsb\nXRaX1AaPZ0tEVhXXVLcrrz9chEKdSXaK1gpd/V4xWexSexV2j2F2MgV9hDsS4SzR\nA82gTNZXAgMBAAECggEAV/cNvEPS09LoGIDPOb4taFsChcAD9ugDTDgMrE69yufJ\nRjxdJcjGBxf5+8JeZGp6NzDg39c5SKtrg37yoDQa5p10g9/03Dc772gLY1YYah84\nvr1LgIFXifULFSJrHHRePSdyVUau1f9zYKlp4zR/74LLucmLxsgBcqfPcU4LdwJF\nN5qgXbKlsWyrQ/qbDzxnZqXwL6TipT4NVKQ9QpflY+DF+B1D4dTH07zitJJI1Caq\nzhgUAsTN/XCpcqbTI61UgLT+mvS3XlaHoVvdIZBRPJI/MeJx2Ro9qQ9FVHnsR+ky\nR2xYYhYuEyTi1sTvOOz4LPN6t02HcVTeRwjdTUYiSQKBgQDlY1WUq5YlzYD1XkZq\nUXa5ro8/5JOvv4MxTWhCT9wumsPyVvEgQ2EhrRNLKz35Xeegy2MJ9Ek4NMjO7ChF\n4tjT/6IwbA/2kAU2dEy1aUl07oPnp2vlTfcvVqAT4bGZ/81O7hRudDpI9X1Bfoe1\n3fGQuaDcaYPlCJoN9Zr04RM1mQKBgQDKQNNhEYo7Tpnz1uQVFMheM4Bb2lXNjjcf\nmw9leekAxurrLtZg3bu5GA0E2MKSmkCPBjSPb8ZjhVZt1MQPThERiZVb878pKi13\nK692Nf5rpwhi1dWyyZvtDaOMpjOlnmcQd1+5EPpPBoW9nCNSSVVbg9qcLnbMtkcj\nyHPAp7sBbwKBgCaRZBNCIlWqztLyje5UUhz4L5ezi+1RyvIgLLZxjPi9BtMZMSOW\nkJ9D5WmPFLV3x3kumTFURHdR0K2R4VeWw5QpeBCiKrDvGCFGvpsF39bsP3tUl/yO\n9k+cRf/xw5W7/74Uo5TKr/4SYIQBjTnT3kjSHSzSBN4eayCLugkQStWJAoGAZmJa\nnxDaARvRI3btDx7uL4GywMzOErijfwRnzt7f7NzFnzienXqhxRk/vexc0wnzFHP3\nt4TF0St2jTLf7T9/tHkJevrxEk2fpmwe7qB2othzjlThURhuLppw6IpaKsT9N4C2\nnGDT1Z1fppSb7NPiuekNiXKcARVk/eBDeItwR1ECgYEAw4sCxMM2Z8iP030erkAn\nX53u/wfSWScsMvnTr/kCp2lILFlIVUGdtpoxbFzPj6e3mH+gOlcs4pOKSZshC3q3\n/H0zAF3fRq1i3mvKRRWIfouePytf5TfmV9hpL9RmaIfkGjWuNGthncRLqeDuWqVI\n68L1U5jvaM2RZmOlyS1nCqU=\n-----END PRIVATE KEY-----\n",
        }),
      });
    }

    const db = admin.firestore();
    const usersSnapshot = await db.collection("users").get();
    console.log(`Number of users: ${usersSnapshot.size}`);

    const allResults = await Promise.all(
      usersSnapshot.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        console.log(`Processing user: ${userId}`);
        const planFetch = db.collection("users").doc(userId);
        let plan = "";
        const plandoc = await planFetch.get();
        if (plandoc.exists) {
          plan = plandoc.data().plan;
        }
        
        if (plan === "Starter") {
          try {
            // Fetch user's tweet feed configuration
            const tweetFeedSnapshot = await db
              .collection("users")
              .doc(userId)
              .collection("tweet_feed")
              .limit(1)
              .get();

            if (tweetFeedSnapshot.empty) {
              console.log(`No tweet_feed found for user ${userId}`);
              return null;
            }

            const tweetFeedDoc = tweetFeedSnapshot.docs[0];
            const tweetFeedData = tweetFeedDoc.data();
            console.log(`User ${userId} - Tweet feed data:`, tweetFeedData);

            // Extract usernames and add @ prefix
            const filterMeArray = tweetFeedData.twitterUrls.map((url) => {
              const username = url.split("/").pop();
              return `@${username}`;
            });

            // Get all user tweets
            const userTweetsRef = db
              .collection("users")
              .doc(userId)
              .collection("user_tweets");
            const tweetsSnapshot = await userTweetsRef.get();

            // Create batch for deletions
            const deleteBatch = db.batch();
            let deleteCount = 0;

            // Current date for comparison
            const currentDate = new Date();

            tweetsSnapshot.forEach((doc) => {
              const tweet = doc.data();
              if (!tweet.created_at) {
                deleteBatch.delete(doc.ref);
                deleteCount++;
                return;
              }
              const tweetDate = tweet.created_at.toDate();
              const daysDifference =
                (currentDate - tweetDate) / (1000 * 60 * 60 * 24);

              if (daysDifference > 3) {
                deleteBatch.delete(doc.ref);
                deleteCount++;
                return;
              }

              const authorMatches = tweet.authors.some((author) =>
                filterMeArray.includes(author.name)
              );

              if (!authorMatches) {
                deleteBatch.delete(doc.ref);
                deleteCount++;
              }
            });

            // Commit deletions if any
            if (deleteCount > 0) {
              try {
                await deleteBatch.commit();
                console.log(`Deleted ${deleteCount} tweets for user ${userId}`);
              } catch (error) {
                console.error(`Error committing delete batch for user ${userId}:`, error);
              }
            }

            // Fetch user's notification settings
            const userSettings = await getUserNotificationSettings(userId);
            const notificationLevels = userSettings?.notificationLevels || [];
            const telegramUserId = userSettings?.telegramUserId || "";

            if (!userSettings) {
              console.log(`No notification settings found for user ${userId}. Continuing without notifications.`);
            } else {
              console.log(`Notification settings found for user ${userId}. Continuing with notifications.`);
            }

            if (!tweetFeedData.twitterUrls || !tweetFeedData.tags) {
              console.log(`Missing twitterUrls or tags for user ${userId}`);
              return null;
            }

            const topicsString = tweetFeedData.tags.join(', ');

            // Fetch and process feeds
            const result = await fetchFeeds(
              tweetFeedData.twitterUrls,
              topicsString,
              userId,
              notificationLevels,
              telegramUserId
            );
            console.log(`User ${userId} - fetchFeeds result:`, result);

            // Create new batch for adding tweets
            const addBatch = db.batch();
            let addCount = 0;

            for (const tweet of result) {
              // Check if we're approaching batch limit (500 operations)
              if (addCount >= 450) {
                try {
                  await addBatch.commit();
                  console.log(`Committed batch of ${addCount} new tweets for user ${userId}`);
                  addCount = 0;
                  // Create a new batch for remaining operations
                  addBatch = db.batch();
                } catch (error) {
                  console.error(`Error committing add batch for user ${userId}:`, error);
                }
              }

              const newTweetRef = userTweetsRef.doc();
              addBatch.set(newTweetRef, {
                content_html: tweet.content_html,
                authors: tweet.authors,
                relevancy: tweet.relevancy,
                url: tweet.url,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
              });
              addCount++;

              if (
                userSettings &&
                notificationLevels.includes(tweet.relevancy.toLowerCase()) &&
                telegramUserId
              ) {
                try {
                  await sendTelegramMessage(
                    telegramUserId,
                    `${tweet.relevancy} tweet: ${tweet.url}`
                  );
                } catch (error) {
                  console.error(`Error sending Telegram message for user ${userId}:`, error);
                }
              }
            }

            // Commit any remaining tweets in the final batch
            if (addCount > 0) {
              try {
                await addBatch.commit();
                console.log(`Committed final batch of ${addCount} new tweets for user ${userId}`);
              } catch (error) {
                console.error(`Error committing final add batch for user ${userId}:`, error);
              }
            }

            return {
              userId: userId,
              tweetFeedId: tweetFeedDoc.id,
              processedTweets: result.length,
              deletedTweets: deleteCount,
              addedTweets: addCount,
            };
          } catch (error) {
            console.error(`Error processing user ${userId}:`, error);
            return null;
          }
        }
        return null; // Return null for non-Starter plans
      })
    );

    const filteredResults = allResults.filter((result) => result !== null);
    console.log(`Total processed users: ${filteredResults.length}`);

    res.json({
      message: "Starter plan processing completed successfully",
      processedUsers: filteredResults.length,
      results: filteredResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error in processStarter:`, error);
    res.status(500).json({ error: String(error) });
  }
}