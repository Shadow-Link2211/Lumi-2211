import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, Profile, UserSettings } from './supabase';

interface AuthContextValue {
  user: Profile | null;
  settings: UserSettings | null;
  loading: boolean;
  isOwner: boolean;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const DEFAULT_SETTINGS: UserSettings = {
  id: '',
  theme: 'light',
  is_private: false,
  fake_news_checker: true,
  explicit_content_filter: false,
  parental_lock_enabled: false,
  parental_lock_password: null,
  parental_screen_time_limit: 120,
  parental_block_dms: false,
  notification_likes: true,
  notification_comments: true,
  notification_follows: true,
  notification_messages: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const loadSettings = useCallback(async (userId: string) => {
    const { data } = await supabase.from('user_settings').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setSettings(data as UserSettings);
      document.documentElement.setAttribute('data-theme', data.theme);
    } else {
      const newSettings = { ...DEFAULT_SETTINGS, id: userId };
      await supabase.from('user_settings').insert(newSettings);
      setSettings(newSettings);
      document.documentElement.setAttribute('data-theme', newSettings.theme);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setUser(data as Profile);
      setIsOwner((data as Profile).is_owner);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        await loadProfile(session.user.id);
        await loadSettings(session.user.id);
      }
      if (mounted) setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_IN' && session) {
          await loadProfile(session.user.id);
          await loadSettings(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSettings(null);
          setIsOwner(false);
          document.documentElement.setAttribute('data-theme', 'light');
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, loadSettings]);

  const signUp = useCallback(async (email: string, password: string, username: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };

    if (data.user) {
      // Check if any profile exists (first user = owner)
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const shouldBeOwner = (count ?? 0) === 0;

      const referralCode = `${username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}${Math.floor(Math.random() * 1000)}`;
      const newProfile: Partial<Profile> = {
        id: data.user.id,
        username,
        full_name: fullName,
        bio: '',
        avatar_url: '',
        website: '',
        is_private: false,
        is_owner: shouldBeOwner,
        is_verified: shouldBeOwner,
        referral_code: referralCode,
        referred_by: null,
        follower_count: 0,
        following_count: 0,
        post_count: 0,
      };
      await supabase.from('profiles').insert(newProfile);
      await supabase.from('user_settings').insert({ ...DEFAULT_SETTINGS, id: data.user.id });
      await loadProfile(data.user.id);
      await loadSettings(data.user.id);
    }
    return { error: null };
  }, [loadProfile, loadSettings]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSettings(null);
    setIsOwner(false);
  }, []);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) return;
    const { data } = await supabase.from('user_settings').update(updates).eq('id', user.id).select().single();
    if (data) {
      setSettings(data as UserSettings);
      if (updates.theme) document.documentElement.setAttribute('data-theme', updates.theme);
    }
  }, [user]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;
    const { data } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single();
    if (data) setUser(data as Profile);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, settings, loading, isOwner, signUp, signIn, signOut, refreshProfile, updateSettings, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
