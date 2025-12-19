const firestore = firebase.firestore();

function docRef(email){
  return firestore.collection("assessments").doc(email.toLowerCase());
}

async function getRecord(email){
  const snap = await docRef(email).get();
  return snap.exists ? snap.data() : null;
}

async function saveRecord(email, data){
  await docRef(email).set(
    { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function listStudents(limit=200){
  const snap = await firestore.collection("assessments")
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(d => d.id);
}
