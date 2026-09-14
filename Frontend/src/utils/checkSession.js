// Utility function to check Firebase authentication session status
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Check if user is currently authenticated in Firebase
 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
 */
export const checkFirebaseSession = () => {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('✅ Firebase Session: ACTIVE');
        console.log('User:', {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          lastSignInTime: user.metadata?.lastSignInTime,
          creationTime: user.metadata?.creationTime
        });
        resolve(user);
      } else {
        console.log('❌ Firebase Session: INACTIVE (No user logged in)');
        resolve(null);
      }
    });
  });
};

/**
 * Get current Firebase user synchronously
 * @returns {Object|null} Current user or null
 */
export const getCurrentFirebaseUser = () => {
  return auth.currentUser;
};

/**
 * Check localStorage session (your app's session management)
 * @returns {Object|null} User data from localStorage or null
 */
export const checkLocalStorageSession = () => {
  const userData = localStorage.getItem('user');
  if (userData) {
    console.log('✅ LocalStorage Session: ACTIVE');
    console.log('User Data:', JSON.parse(userData));
    return JSON.parse(userData);
  } else {
    console.log('❌ LocalStorage Session: INACTIVE (No user data)');
    return null;
  }
};

/**
 * Check both Firebase and localStorage session status
 * @returns {Object} Session status object
 */
export const checkSessionStatus = async () => {
  const firebaseUser = await checkFirebaseSession();
  const localStorageUser = checkLocalStorageSession();

  return {
    firebase: {
      isActive: !!firebaseUser,
      user: firebaseUser
    },
    localStorage: {
      isActive: !!localStorageUser,
      user: localStorageUser
    },
    isFullyLoggedIn: !!(firebaseUser && localStorageUser)
  };
};
