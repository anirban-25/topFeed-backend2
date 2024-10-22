import { db } from '../firebase.js';
import { collection, doc, updateDoc, getDoc, setDoc, getDocs } from 'firebase/firestore';

export async function monthlySchedulerController(req, res) {
  try {
    console.log("Starting monthly reset of isRefresh...");

    const usersCollectionRef = collection(db, 'users');
    const userSnapshots = await getDocs(usersCollectionRef);

    for (const userDoc of userSnapshots.docs) {
      const userId = userDoc.id;
      const userDocRef = doc(db, 'users', userId);
      const userRedditsCollectionRef = collection(userDocRef, 'user_reddits');
      const latestDocRef = doc(userRedditsCollectionRef, 'latest_analysis');

      try {
        const latestDocSnapshot = await getDoc(latestDocRef);

        if (latestDocSnapshot.exists()) {
          const data = latestDocSnapshot.data();
          if ('isRefresh' in data) {
            await updateDoc(latestDocRef, { isRefresh: 0 });
          } else {
            await setDoc(latestDocRef, { isRefresh: 0 }, { merge: true });
          }
        } else {
          await setDoc(latestDocRef, { isRefresh: 0 });
        }

        console.log(`Reset/Set isRefresh for user ${userId}`);
      } catch (e) {
        console.error(`Failed to reset/set isRefresh for user ${userId}:`, e);
      }
    }

    console.log("Completed monthly reset of isRefresh.");
    
    res.status(200).json({ message: "Done" });
  } catch (e) {
    console.error("Error resetting isRefresh for users:", e);
    
    res.status(500).json({ error: e.message });
  }
}