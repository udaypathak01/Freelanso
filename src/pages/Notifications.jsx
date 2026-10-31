import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import Sidebar from "../components/Sidebar";
import { auth } from "../lib/auth";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/data";
import useNotifications from "../lib/useNotifications";

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function Notifications() {
  const navigate = useNavigate();
  const user = auth.getUser();
  const { notifications, unreadCount, error: subscriptionError } =
    useNotifications(user?.uid);
  const [collapsed, setCollapsed] = useState(true);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const openNotification = async (notification) => {
    setActionError("");
    if (notification.readAt == null) {
      try {
        await markNotificationRead(notification.id);
      } catch (error) {
        setActionError(error.message || "Could not update this notification.");
        return;
      }
    }
    if (typeof notification.href === "string" && notification.href.startsWith("/")) {
      navigate(notification.href);
    }
  };

  const handleMarkAllRead = async () => {
    setBusy(true);
    setActionError("");
    try {
      await markAllNotificationsRead();
    } catch (error) {
      setActionError(error.message || "Could not update notifications.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white">
      <div
        className={`hidden shrink-0 transition-all duration-300 lg:block ${
          collapsed ? "w-[78px]" : "w-[240px]"
        }`}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>
      <main className="min-w-0 flex-1 px-4 pb-24 pt-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#0066FF]">
                Your activity
              </p>
              <h1 className="text-3xl font-black tracking-tight">Notifications</h1>
              <p className="mt-2 text-sm text-[#888]">
                {unreadCount ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={!unreadCount || busy}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-[#aaa] transition hover:border-[#0066FF]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          {(actionError || subscriptionError) && (
            <p role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {actionError || subscriptionError}
            </p>
          )}

          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-[#101014] px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066FF]/10 text-[#4c91ff]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold">No notifications yet</h2>
              <p className="mt-2 text-sm text-[#777]">
                Messages, project activity, and job application updates will show up here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101014]">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`flex w-full items-start gap-4 border-b border-white/[0.06] px-4 py-5 text-left transition last:border-b-0 hover:bg-white/[0.03] sm:px-6 ${
                    notification.readAt == null ? "bg-[#0066FF]/[0.045]" : ""
                  }`}
                >
                  <Avatar
                    src={notification.actorAvatar}
                    name={notification.actorName || notification.title}
                    size="w-10 h-10"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-bold text-white">{notification.title}</span>
                      {notification.readAt == null && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0066FF]" aria-label="Unread" />
                      )}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[#999]">
                      {notification.body}
                    </span>
                    <span className="mt-2 block text-xs text-[#666]">
                      {formatTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
