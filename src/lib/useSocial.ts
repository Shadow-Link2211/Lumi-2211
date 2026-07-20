import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

/**
 * Tracks whether the current user has liked a given post or reel, and
 * subscribes to realtime changes on the `likes` table so multiple tabs /
 * screens stay in sync. Returns the live like state plus a toggle that
 * writes to the DB (the trigger updates the count column).
 */
export function useLiked(target: { post_id?: string; reel_id?: string }) {
  const { user } = useAuth();
  const key = target.post_id ? 'post_id' : 'reel_id';
  const value = target.post_id || target.reel_id;
  const [liked, setLiked] = useState(false);

  const load = useCallback(async () => {
    if (!user || !value) return;
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq(key, value)
      .maybeSingle();
    setLiked(!!data);
  }, [user, key, value]);

  useEffect(() => {
    load();
    if (!user || !value) return;
    const channel = supabase
      .channel(`likes-${key}-${value}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'likes', filter: `${key}=eq.${value}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user, key, value]);

  const toggleLike = useCallback(async () => {
    if (!user || !value) return;
    if (!liked) {
      setLiked(true);
      await supabase.from('likes').insert({ user_id: user.id, [key]: value } as any);
    } else {
      setLiked(false);
      await supabase.from('likes').delete().eq('user_id', user.id).eq(key, value);
    }
  }, [liked, user, key, value]);

  return { liked, toggleLike };
}

/**
 * Tracks whether the current user follows a given profile, with realtime
 * sync across screens.
 */
export function useFollowing(followingId: string | undefined) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    if (!user || !followingId || user.id === followingId) return;
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', followingId)
      .maybeSingle();
    setFollowing(!!data);
  }, [user, followingId]);

  useEffect(() => {
    load();
    if (!user || !followingId || user.id === followingId) return;
    const channel = supabase
      .channel(`follows-${user.id}-${followingId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${user.id}` },
        () => load())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${followingId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user, followingId]);

  const toggleFollow = useCallback(async () => {
    if (!user || !followingId || user.id === followingId) return;
    if (!following) {
      setFollowing(true);
      await supabase.from('follows').insert({ follower_id: user.id, following_id: followingId });
      await supabase.from('notifications').insert({ recipient_id: followingId, actor_id: user.id, type: 'follow' });
    } else {
      setFollowing(false);
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', followingId);
    }
  }, [following, user, followingId]);

  return { following, toggleFollow };
}

/**
 * Tracks whether the current user has saved a given post or reel, with realtime
 * sync. The toggle writes to the `saves` table (trigger updates the count column).
 */
export function useSaved(target: { post_id?: string; reel_id?: string }) {
  const { user } = useAuth();
  const key = target.post_id ? 'post_id' : 'reel_id';
  const value = target.post_id || target.reel_id;
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!user || !value) return;
    const { data } = await supabase
      .from('saves')
      .select('id')
      .eq('user_id', user.id)
      .eq(key, value)
      .maybeSingle();
    setSaved(!!data);
  }, [user, key, value]);

  useEffect(() => {
    load();
    if (!user || !value) return;
    const channel = supabase
      .channel(`saves-${key}-${value}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'saves', filter: `${key}=eq.${value}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user, key, value]);

  const toggleSave = useCallback(async () => {
    if (!user || !value) return;
    if (!saved) {
      setSaved(true);
      await supabase.from('saves').insert({ user_id: user.id, [key]: value } as any);
    } else {
      setSaved(false);
      await supabase.from('saves').delete().eq('user_id', user.id).eq(key, value);
    }
  }, [saved, user, key, value]);

  return { saved, toggleSave };
}

/**
 * Subscribes to realtime updates on a set of posts/reels so counts (likes,
 * comments) stay live across screens. Returns nothing — callers should
 * pass an updater callback that merges the new row into their state.
 */
export function useRealtimeCounts<T extends { id: string }>(
  table: 'posts' | 'reels',
  ids: string[],
  onRow: (row: T) => void,
) {
  useEffect(() => {
    if (ids.length === 0) return;
    const channel = supabase
      .channel(`counts-${table}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table },
        (payload: any) => onRow(payload.new as T))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ids.join(',')]);
}
