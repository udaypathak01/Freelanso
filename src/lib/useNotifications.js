import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { dbRT } from "./firebase";

export default function useNotifications(uid) {
  const [state, setState] = useState({
    uid: null,
    items: [],
    error: null,
  });

  useEffect(() => {
    if (!uid) return undefined;

    let active = true;
    const unsubscribe = onValue(
      ref(dbRT, `notifications/${uid}`),
      (snapshot) => {
        if (!active) return;
        const items = Object.entries(snapshot.val() ?? {})
          .map(([id, notification]) => ({ id, ...notification }))
          .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
        setState({ uid, items, error: null });
      },
      (error) => {
        if (!active) return;
        console.error("Notification subscription failed:", error);
        setState({ uid, items: [], error: "Notifications could not be loaded." });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid]);

  const currentItems = state.uid === uid ? state.items : [];
  return {
    notifications: currentItems,
    unreadCount: currentItems.filter((notification) => notification.readAt == null).length,
    error: state.uid === uid ? state.error : null,
  };
}
