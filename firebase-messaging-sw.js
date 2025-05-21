// This file should be included in your index.html and other pages where you want to enable push notifications

// Initialize Firebase Messaging
function initializeFirebaseMessaging() {
  // Check if the browser supports service workers and push notifications
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push notifications are not supported in this browser");
    return;
  }

  // Initialize Firebase if it's not already initialized
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyCgOvIkDCcS3DFrt5f6Y7pYmjCoHIfDF9U",
      authDomain: "moniebase-b4b4d.firebaseapp.com",
      projectId: "moniebase-b4b4d",
      storageBucket: "moniebase-b4b4d.appspot.com",
      messagingSenderId: "1009678808253",
      appId: "1:1009678808253:android:ff94e94c52bad2db7973d4",
      databaseURL: "https://moniebase-b4b4d-default-rtdb.firebaseio.com/",
    });
  }

  // Get messaging instance
  const messaging = firebase.messaging();

  // Add the public VAPID key (you'll need to generate this)
  // You can generate VAPID keys using the Firebase console or the web-push library
  messaging.usePublicVapidKey(
    "BMNp5xK0WOmSy0KjxBypA-dIDvtGhOwlcOZGvhkW5aP7uf8S7JIZqq8h4xS_wqDadl-lAnWvE_GsZ5UYqufIzjU"
  );

  // Request permission and get token
  requestNotificationPermission()
    .then(() => getMessagingToken(messaging))
    .then((token) => {
      if (token) {
        saveTokenToDatabase(token);
        console.log("Notification permission granted and token saved");
      }
    })
    .catch((err) => console.error("Failed to get permission or token", err));

  // Handle incoming messages when the app is in the foreground
  messaging.onMessage((payload) => {
    console.log("Message received in foreground:", payload);

    // Create and show a notification manually since onMessage only triggers
    // when the app is in the foreground
    if (payload.notification) {
      const { title, body } = payload.notification;

      // Check if we can show notifications
      if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body: body,
            icon: "/gamelogo.png",
            badge: "/gamelogo.png",
            vibrate: [100, 50, 100, 50, 100],
            data: {
              dateOfArrival: Date.now(),
              url: payload.data?.url || "/",
            },
            actions: [
              {
                action: "open",
                title: "Open App",
              },
              {
                action: "close",
                title: "Dismiss",
              },
            ],
          });
        });
      }
    }
  });
}

// Request notification permission
async function requestNotificationPermission() {
  try {
    // Register service worker first
    const registration = await navigator.serviceWorker.register(
      "/service-worker.js"
    );
    console.log("Service worker registered:", registration);

    // Request permission
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Notification permission not granted");
    }

    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    throw error;
  }
}

// Get messaging token
async function getMessagingToken(messaging) {
  try {
    // Get token
    const currentToken = await messaging.getToken();

    if (!currentToken) {
      console.log("No token available");
      return null;
    }

    return currentToken;
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
}

// Save token to Firebase database
function saveTokenToDatabase(token) {
  // Check if user is logged in
  const user = firebase.auth().currentUser;

  if (!user) {
    // If not logged in, save token with a temporary ID
    // This allows sending notifications to users who haven't logged in yet
    const tempId = localStorage.getItem("tempUserId") || generateTempId();
    localStorage.setItem("tempUserId", tempId);

    firebase.database().ref(`pushTokens/${tempId}`).set({
      token: token,
      createdAt: Date.now(),
      platform: getPlatformInfo(),
      lastActive: Date.now(),
    });
  } else {
    // If logged in, save token with user ID
    firebase.database().ref(`pushTokens/${user.uid}`).set({
      token: token,
      createdAt: Date.now(),
      platform: getPlatformInfo(),
      lastActive: Date.now(),
    });

    // Also update user's profile with token info
    firebase.database().ref(`users/${user.uid}/pushToken`).set(token);

    // If there was a temporary token, migrate it
    const tempId = localStorage.getItem("tempUserId");
    if (tempId) {
      // Remove the temporary token
      firebase.database().ref(`pushTokens/${tempId}`).remove();
      localStorage.removeItem("tempUserId");
    }
  }
}

// Generate temporary user ID
function generateTempId() {
  return "temp_" + Math.random().toString(36).substring(2, 15);
}

// Get platform information
function getPlatformInfo() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    vendor: navigator.vendor,
  };
}

// Update token when user logs in
function updateTokenOnLogin(user) {
  firebase
    .messaging()
    .getToken()
    .then((token) => {
      if (token) {
        // Save token with user ID
        firebase.database().ref(`pushTokens/${user.uid}`).set({
          token: token,
          createdAt: Date.now(),
          platform: getPlatformInfo(),
          lastActive: Date.now(),
        });

        // Update user's profile
        firebase.database().ref(`users/${user.uid}/pushToken`).set(token);

        // Remove temporary token if it exists
        const tempId = localStorage.getItem("tempUserId");
        if (tempId) {
          firebase.database().ref(`pushTokens/${tempId}`).remove();
          localStorage.removeItem("tempUserId");
        }
      }
    });
}

// Initialize when the page loads
document.addEventListener("DOMContentLoaded", function () {
  // Initialize Firebase Messaging
  initializeFirebaseMessaging();

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      updateTokenOnLogin(user);
    }
  });
});
