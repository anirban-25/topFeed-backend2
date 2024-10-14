import admin from 'firebase-admin';

export async function storeDataInFirestore(data, userId) {
  try {
    const batch = admin.firestore().batch();
    const userRef = admin.firestore().collection('users').doc(userId);

    // Create a user_tweets subcollection
    const userTweetsRef = userRef.collection('user_tweets');

    data.forEach(item => {
      const docRef = userTweetsRef.doc(); // This will auto-generate a new document ID
      batch.set(docRef, item);
    });

    await batch.commit();
    console.log(`Successfully stored ${data.length} tweets for user ${userId}`);
  } catch (error) {
    console.error("Error storing data in Firestore:", error);
    throw new Error("Failed to store data in Firestore");
  }
}