const firebaseConfig = {
  apiKey:            "AIzaSyB78Z7dLmKtN52cOVgPpK1c6VvocZW9VlI",
  authDomain:        "versa-test-portal-2.firebaseapp.com",
  projectId:         "versa-test-portal-2",
  storageBucket:     "versa-test-portal-2.firebasestorage.app",
  messagingSenderId: "902267204107",
  appId:             "1:902267204107:web:92acdfe03438d2a0060d0e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let storage;
try { storage = firebase.storage(); } catch(e) { console.warn('Firebase Storage not available:', e.message); }
