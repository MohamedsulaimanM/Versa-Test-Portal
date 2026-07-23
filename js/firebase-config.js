const firebaseConfig = {
  apiKey:            "AIzaSyBSRVqmF4VPYP-kLFIqc7doLiKPU8vvKH0",
  authDomain:        "versa-test-portal.firebaseapp.com",
  projectId:         "versa-test-portal",
  storageBucket:     "versa-test-portal.firebasestorage.app",
  messagingSenderId: "744975888968",
  appId:             "1:744975888968:web:43597aa0d3f5784f30de7d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
