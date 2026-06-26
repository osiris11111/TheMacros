import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "ai-studio-11f462dc-ca8a-4eea-a946-ab9c480e7f44",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const snapshot = await getDocs(collection(db, 'menuItems'));
  let mapped = [];
  snapshot.docs.forEach(doc => {
     mapped.push(doc.data().title);
     if (doc.data().title === "Turkey & cheese sandwish" || doc.data().title?.includes("Shrimp")) {
       console.log(doc.data().title, doc.data().sizes, doc.data().showOptionsOnCard);
     }
  });
  console.log("Total items:", snapshot.size);
}
check();
