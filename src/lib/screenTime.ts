import { useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

let currentSection: string = 'feed';
let sectionStart: number = Date.now();
let appOpenDate: string = new Date().toISOString().slice(0, 10);
let openRecorded = false;

/**
 * Call setSection whenever the user navigates to a different section.
 * On unmount/section change, the elapsed time is flushed to the database.
 */
export function useScreenTimeTracker() {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const flush = useCallback(async (section: string, start: number) => {
    const u = userRef.current;
    if (!u) return;
    const elapsed = Math.floor((Date.now() - start) / 1000);
    if (elapsed < 1) return;
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from('screen_time_stats')
      .upsert({
        user_id: u.id,
        stat_date: today,
        section,
        seconds_spent: elapsed,
      }, { onConflict: 'user_id,stat_date,section' });
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        flush(currentSection, sectionStart);
        sectionStart = Date.now();
      } else {
        sectionStart = Date.now();
        if (!openRecorded && userRef.current) {
          openRecorded = true;
          appOpenDate = new Date().toISOString().slice(0, 10);
          recordAppOpen(userRef.current.id);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Record app open on mount
    if (!openRecorded && user) {
      openRecorded = true;
      recordAppOpen(user.id);
    }
    // Flush on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      flush(currentSection, sectionStart);
    };
  }, [flush, user]);

  const setSection = useCallback((section: string) => {
    if (section === currentSection) return;
    flush(currentSection, sectionStart);
    currentSection = section;
    sectionStart = Date.now();
  }, [flush]);

  return { setSection };
}

async function recordAppOpen(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('screen_time_stats')
    .select('app_opens')
    .eq('user_id', userId)
    .eq('stat_date', today)
    .eq('section', 'feed')
    .maybeSingle();
  await supabase
    .from('screen_time_stats')
    .upsert({
      user_id: userId,
      stat_date: today,
      section: 'feed',
      app_opens: (data?.app_opens || 0) + 1,
    }, { onConflict: 'user_id,stat_date,section' });
}

export function getCurrentSection() { return currentSection; }
