import admin from 'firebase-admin';

export async function storeDataInFirestore(data, userId) {
  try {
    const batch = admin.firestore().batch();
    const userRef = admin.firestore().collection('twitterData').doc(userId);

    data.forEach(item => {
      const docRef = userRef.collection('items').doc();
      batch.set(docRef, item);
    });

    await batch.commit();
  } catch (error) {
    console.error("Error storing data in Firestore:", error);
    throw new Error("Failed to store data in Firestore");
  }
}


