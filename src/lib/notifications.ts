/**
 * Device-level push notifications using the Web Notifications API.
 * Fires native OS notifications for incoming messages when the
 * chat is not actively open (or the tab is in the background).
 */

let permissionRequested = false;

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission {
  if (!notificationsSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  if (Notification.permission === 'default' && !permissionRequested) {
    permissionRequested = true;
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }
  return Notification.permission;
}

// Track shown message ids to prevent duplicate notifications
const shownIds = new Set<string>();
const MAX_TRACKED = 200;

function trackId(id: string) {
  shownIds.add(id);
  if (shownIds.size > MAX_TRACKED) {
    // drop oldest half
    const arr = Array.from(shownIds);
    shownIds.clear();
    arr.slice(Math.floor(arr.length / 2)).forEach(i => shownIds.add(i));
  }
}

export interface PushNotificationPayload {
  messageId: string;
  senderName: string;
  senderAvatar?: string;
  messagePreview: string;
  conversationId: string;
  otherUserId: string;
}

export function showMessageNotification(payload: PushNotificationPayload) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  if (shownIds.has(payload.messageId)) return;
  trackId(payload.messageId);

  // Don't notify if the tab is focused and the chat is open — caller checks this,
  // but we also guard here using document.visibilityState.
  if (document.visibilityState === 'visible' && isChatOpen(payload.conversationId)) return;

  const title = payload.senderName;
  const body = payload.messagePreview;
  const options: NotificationOptions = {
    body,
    tag: payload.messageId, // dedupe by message id across re-renders
    data: {
      conversationId: payload.conversationId,
      otherUserId: payload.otherUserId,
      messageId: payload.messageId,
    },
    icon: payload.senderAvatar || undefined,
    badge: payload.senderAvatar || undefined,
  };

  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      // Dispatch an event the app can listen for to navigate to the conversation
      window.dispatchEvent(new CustomEvent('open-conversation', { detail: { otherUserId: payload.otherUserId } }));
      n.close();
    };
  } catch {
    // Some browsers require a service worker; ignore failures silently
  }
}

// Track the currently-open conversation id so we don't notify for messages the user is reading
let openConversationId: string | null = null;
export function setOpenConversation(id: string | null) { openConversationId = id; }
function isChatOpen(conversationId: string): boolean {
  return openConversationId === conversationId;
}
