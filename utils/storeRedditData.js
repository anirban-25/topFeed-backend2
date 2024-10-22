import { db } from '../firebase.js';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
export async function storeDataInFirestore(data, user, subreddits) {
  if (!user) {
    console.error("No user ID provided.");
    return;
  }
  const userDocRef = doc(db, 'users', user);
  const userRedditsCollectionRef = collection(userDocRef, 'user_reddits');
  const latestDocRef = doc(userRedditsCollectionRef, 'latest_analysis');
  try {
    // console.log(`Storing data for user ${user}`);
    // Get the current document to check the current value of isRefresh
    const latestDocSnapshot = await getDoc(latestDocRef);
    let isRefresh = 1; // Initialize to 1 if the field doesn't exist
    if (latestDocSnapshot.exists() && latestDocSnapshot.data().isRefresh) {
      isRefresh = latestDocSnapshot.data().isRefresh + 1;
    }
    // Update the document with the new data and incremented isRefresh
    await setDoc(latestDocRef, {
      analysis: data,
      timestamp: new Date(),
      isRefresh: isRefresh, // Add or update isRefresh field
    }, { merge: true });
    console.log("Document updated with ID: ", latestDocRef.id);
    return latestDocRef;
  } catch (e) {
    console.error(`Error updating document for user ${user}:`, e);
    throw e;
  }
} 