import { supabase } from './supabase';

const HEARTBEAT_INTERVAL_MS = 25000; // 25s
const OFFLINE_THRESHOLD_MS = 70000;  // ~3 missed heartbeats

let heartbeatTimer: number | null = null;
let currentUserId: string | null = null;

/**
 * Start presence tracking for the given user. Updates `is_online=true` and
 * `last_seen_at` immediately, then heartbeats every 25s. On unload, marks
 * the user offline.
 */
export function startPresence(userId: string) {
  if (currentUserId === userId && heartbeatTimer) return;
  stopPresence();
  currentUserId = userId;

  const markOnline = () => {
    supabase
      .from('profiles')
      .update({ is_online: true, last_seen_at: new Date().toISOString() })
      .eq('id', userId)
      .then();
  };

  markOnline();
  heartbeatTimer = window.setInterval(markOnline, HEARTBEAT_INTERVAL_MS);

  const markOffline = () => {
    navigator.sendBeacon &&
      navigator.sendBeacon(
        // best-effort; RLS will gate the actual write
        '/__presence_offline__',
        new Blob([JSON.stringify({ userId })], { type: 'application/json' })
      );
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    // synchronous fallback (may fail due to RLS, that's fine)
    supabase
      .from('profiles')
      .update({ is_online: false, last_seen_at: new Date().toISOString() })
      .eq('id', userId)
      .then();
  };

  window.addEventListener('beforeunload', markOffline);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUserId) {
      markOnline();
    }
  });
}

export function stopPresence() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  currentUserId = null;
}

/**
 * Returns true if the given last_seen_at should be considered "online"
 * based on the heartbeat threshold. Useful for rendering derived status
 * without a separate query.
 */
export function isRecentlyActive(lastSeenAt: string | null, isOnline: boolean): boolean {
  if (isOnline) return true;
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < OFFLINE_THRESHOLD_MS;
}

export function formatLastSeen(lastSeenAt: string | null, isOnline: boolean): string {
  if (isOnline) return 'Active now';
  if (!lastSeenAt) return '';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 60000) return 'Active just now';
  if (diff < 3600000) return `Active ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Active ${Math.floor(diff / 3600000)}h ago`;
  return `Active ${new Date(lastSeenAt).toLocaleDateString()}`;
}
