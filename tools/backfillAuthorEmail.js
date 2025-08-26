// tools/backfillAuthorEmail.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account
const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json in tools/. Download it from Firebase Console.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath))
});

const db = admin.firestore();
const auth = admin.auth();

async function run() {
  console.log('Backfill starting…');

  const postsRef = db.collection('posts');
  const snapshot = await postsRef.get();
  console.log(`Found ${snapshot.size} posts.`);

  let updated = 0;
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.authorEmail) continue; // already populated
    if (!data.uid) {
      console.log(`Skipping ${docSnap.id}: no uid`);
      continue;
    }

    try {
      const userRecord = await auth.getUser(data.uid);
      const email = userRecord.email || null;
      if (!email) {
        console.log(`No email for uid ${data.uid} (post ${docSnap.id})`);
        continue;
      }

      await docSnap.ref.update({ authorEmail: email });
      updated++;
      if (updated % 50 === 0) console.log(`Updated ${updated}…`);
    } catch (e) {
      console.error(`Error on ${docSnap.id}:`, e.message);
    }
  }

  console.log(`Backfill complete. Updated ${updated} posts.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
