import { db } from '../firebase.js';
import { collection, doc, setDoc } from 'firebase/firestore';

export async function storeDataInFirestore(data, user, subreddits) {
  if (!user) {
    console.error("No user ID provided.");
    return;
  }

  const userDocRef = doc(db, 'users', user);
  const userRedditsCollectionRef = collection(userDocRef, 'user_reddits');
  const latestDocRef = doc(userRedditsCollectionRef, 'latest_analysis');

  try {
    console.log(`Storing data for user ${user}`);
    await setDoc(latestDocRef, {
      analysis: data,
      subreddits: subreddits,
      timestamp: new Date(),
    }, { merge: true });  // This will overwrite existing fields

    console.log("Document updated with ID: ", latestDocRef.id);
    return latestDocRef;
  } catch (e) {
    console.error(`Error updating document for user ${user}:`, e);
    throw e;
  }
}