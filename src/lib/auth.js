import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth as firebaseAuth } from "./firebase";
import { apiRequest } from "./api";

const googleProvider = new GoogleAuthProvider();

const isProfileSyncUnavailable = (error) => {
  if (!error) return false;
  const status = Number(error.status ?? 0);
  const message = String(error.message || "");
  return (
    status === 404 ||
    status === 503 ||
    /failed to fetch|network|not found/i.test(message)
  );
};

const syncUserProfile = async () => {
  try {
    const payload = await apiRequest("/users/me", {}, true);
    return payload?.data ?? null;
  } catch (error) {
    if (isProfileSyncUnavailable(error)) {
      return null;
    }
    throw error;
  }
};

onAuthStateChanged(firebaseAuth, (user) => {
  if (user) {
    const avatarSeed = encodeURIComponent(user.displayName || user.email || "user");
    const userData = {
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      avatar:
        user.photoURL ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
    };
    localStorage.setItem("fl_user", JSON.stringify(userData));
    localStorage.setItem("user", JSON.stringify(userData));
    syncUserProfile().catch((error) => {
      if (isProfileSyncUnavailable(error)) {
        return;
      }
      console.error("Failed to bootstrap the user profile:", error.message);
    });
  } else {
    localStorage.removeItem("fl_user");
    localStorage.removeItem("user");
  }
  window.dispatchEvent(new Event("auth-change"));
});

export const auth = {
  login: (email, password) =>
    signInWithEmailAndPassword(firebaseAuth, email, password),
  googleLogin: () => signInWithPopup(firebaseAuth, googleProvider),
  signup: async (email, password, name) => {
    const userCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );
    const avatarSeed = encodeURIComponent(name || email);
    await updateProfile(userCredential.user, {
      displayName: name,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
    });
    return userCredential;
  },
  logout: () => signOut(firebaseAuth),
  getUser: () => JSON.parse(localStorage.getItem("fl_user") || "null"),
  isAuthenticated: () => Boolean(firebaseAuth.currentUser),
};

export const savePost = (post) => {
  const posts = JSON.parse(localStorage.getItem("fl_posts") || "[]");
  posts.unshift({ ...post, id: Date.now() });
  localStorage.setItem("fl_posts", JSON.stringify(posts));
};
