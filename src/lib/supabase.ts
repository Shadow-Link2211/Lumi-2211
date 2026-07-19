import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
      };
      posts: {
        Row: Post;
        Insert: Partial<Post>;
        Update: Partial<Post>;
      };
    };
  };
};

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  website: string;
  is_private: boolean;
  is_owner: boolean;
  is_verified: boolean;
  referral_code: string | null;
  referred_by: string | null;
  follower_count: number;
  following_count: number;
  post_count: number;
  is_online: boolean;
  last_seen_at: string;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  location: string;
  is_explicit: boolean;
  fact_check_status: 'verified' | 'suspicious' | 'likely_false';
  fact_check_reason: string;
  like_count: number;
  comment_count: number;
  save_count: number;
  mood_tags: string[];
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  audio_id: string | null;
  duration: number;
  expires_at: string;
  created_at: string;
  profiles?: Profile;
}

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  audio_id: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  is_explicit: boolean;
  created_at: string;
  profiles?: Profile;
}

export interface Comment {
  id: string;
  post_id: string | null;
  reel_id: string | null;
  user_id: string;
  content: string;
  is_ai_generated: boolean;
  like_count: number;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'share' | 'reel_like' | 'story_view';
  post_id: string | null;
  reel_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
  post?: Post;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
}

export interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message: string;
  last_message_at: string;
  created_at: string;
  other_user?: Profile;
}

export interface TrendingAudio {
  id: string;
  title: string;
  artist: string;
  video_id: string;
  use_count: number;
  created_at: string;
}

export interface UserSettings {
  id: string;
  theme: 'light' | 'dark';
  is_private: boolean;
  fake_news_checker: boolean;
  explicit_content_filter: boolean;
  parental_lock_enabled: boolean;
  parental_lock_password: string | null;
  parental_screen_time_limit: number;
  parental_block_dms: boolean;
  notification_likes: boolean;
  notification_comments: boolean;
  notification_follows: boolean;
  notification_messages: boolean;
  created_at: string;
  updated_at: string;
}
