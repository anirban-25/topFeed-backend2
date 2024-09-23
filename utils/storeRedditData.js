import { db } from '../firebase.js';
import { collection, doc, setDoc } from 'firebase/firestore';

/**
 * @typedef {Object} SubHeading
 * @property {string} title
 * @property {string[]} points
 */

/**
 * @typedef {Object} Heading
 * @property {string} heading
 * @property {SubHeading[]} sub_headings
 */

/**
 * @typedef {Object} TrendsAndQuestions
 * @property {string} title
 * @property {string[]} points
 */

/** @typedef {(Heading | TrendsAndQuestions)[]} APIResponseType */

/**
 * Stores Reddit analysis data in Firestore
 * @param {APIResponseType} data - The analysis data to store
 * @param {string} user - The user ID
 * @param {string[]} subreddits - The list of subreddits analyzed
 * @returns {Promise<import('firebase/firestore').DocumentReference>}
 */
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