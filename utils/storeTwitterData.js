const admin = require('firebase-admin');

/**
 * @typedef {Object} APIDataType
 * @property {string} content_html
 * @property {string} relevancy
 * @property {Array<{name: string}>} authors
 */

/**
 * Store data under a specific user's subcollection
 * @param {APIDataType[]} data 
 * @param {string} userId 
 */
async function storeDataInFirestore(data, userId) {
  if (!userId) {
    console.error("No user ID provided.");
    return;
  }

  const db = admin.firestore();
  const userDocRef = db.doc(`users/${userId}`);
  const userTwitterRef = userDocRef.collection('user_tweets');

  try {
    // Delete existing documents
    const querySnapshot = await userTwitterRef.get();
    const deletePromises = querySnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    console.log(`Deleted ${querySnapshot.size} existing documents for user ${userId}`);

    // Store new data
    const addPromises = data.map(async (item, index) => {
      try {
        const docRef = await userTwitterRef.add({
          content_html: item.content_html,
          relevancy: item.relevancy,
          authors: item.authors,
          // Add other fields as needed
        });
        console.log(`Document ${index} written with ID: ${docRef.id}`);
      } catch (e) {
        console.error(`Error adding document for item ${index}:`, e);
      }
    });

    await Promise.all(addPromises);
    console.log(`Successfully stored ${data.length} items for user ${userId}`);
  } catch (e) {
    console.error(`Error in storeDataInFirestore for user ${userId}:`, e);
  }
}

module.exports = { storeDataInFirestore };