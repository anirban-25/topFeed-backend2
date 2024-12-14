import admin from 'firebase-admin';

export async function storeDataInFirestore(data, userId) {
  try {
    // Initialize Firestore once
    const db = admin.firestore();
    const batch = db.batch();
    
    // Get user reference
    const userRef = db.collection('users').doc(userId);
    
    // Check if user exists and update loading status
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      batch.update(userRef, {
        twitterLoading: false
      });
    }

    // Create user_tweets subcollection and add data
    const userTweetsRef = userRef.collection('user_tweets');
    
    data.forEach(item => {
      const docRef = userTweetsRef.doc(); // Auto-generate new document ID
      batch.set(docRef, item);
    });

    await batch.commit();
    console.log(`Successfully stored ${data.length} tweets for user ${userId}`);
    
  } catch (error) {
    console.error("Error storing data in Firestore:", error);
    throw new Error("Failed to store data in Firestore");
  }
}