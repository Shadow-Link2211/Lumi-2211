import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Film } from 'lucide-react';
import { Post, Reel } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { PostViewer } from '../components/PostViewer';

interface ExplorePageProps {
  onOpenProfile?: (userId: string) => void;
}

type ExploreItem =
  | { kind: 'post'; data: Post }
  | { kind: 'reel'; data: Reel };

export const ExplorePage: React.FC<ExplorePageProps> = ({ onOpenProfile }) => {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ type: 'post' | 'reel'; index: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [postsRes, reelsRes] = await Promise.all([
        supabase.from('posts').select('*, profiles!posts_user_id_fkey(*), audio:trending_audio(*)').order('like_count', { ascending: false }).limit(30),
        supabase.from('reels').select('*, profiles!reels_user_id_fkey(*)').order('view_count', { ascending: false }).limit(15),
      ]);
      const posts = ((postsRes.data as unknown as Post[]) || []).map(p => ({ kind: 'post' as const, data: p }));
      const reels = ((reelsRes.data as unknown as Reel[]) || []).map(r => ({ kind: 'reel' as const, data: r }));
      // Interleave posts and reels
      const merged: ExploreItem[] = [];
      const maxLen = Math.max(posts.length, reels.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < posts.length) merged.push(posts[i]);
        if (i < reels.length) merged.push(reels[i]);
      }
      setItems(merged);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="page-container wide">
      <div className="page-header">
        <h1 className="page-title">Explore</h1>
      </div>
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>Nothing to explore yet</p>
          <p className="text-sm">Be the first to share content!</p>
        </div>
      ) : (
        <div className="explore-grid">
          {items.map(item => {
            const isReel = item.kind === 'reel';
            const reel = isReel ? (item.data as Reel) : null;
            const post = !isReel ? (item.data as Post) : null;
            return (
              <div key={`${item.kind}-${item.data.id}`} className="explore-grid-item" onClick={() => {
                const posts = items.filter((i): i is { kind: 'post'; data: Post } => i.kind === 'post');
                const reels = items.filter((i): i is { kind: 'reel'; data: Reel } => i.kind === 'reel');
                if (item.kind === 'post') {
                  setViewer({ type: 'post', index: posts.findIndex(p => p.data.id === item.data.id) });
                } else {
                  setViewer({ type: 'reel', index: reels.findIndex(r => r.data.id === item.data.id) });
                }
              }}>
                <img
                  src={isReel ? (reel!.thumbnail_url || reel!.video_url) : post!.image_url}
                  alt={item.data.caption}
                  loading="lazy"
                />
                <div className="explore-overlay">
                  {isReel ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Film size={16} fill="white" /> {reel!.view_count.toLocaleString()}
                    </span>
                  ) : (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Heart size={16} fill="white" /> {post!.like_count.toLocaleString()}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageCircle size={16} fill="white" /> {post!.comment_count}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {viewer && (
        <PostViewer
          posts={items.filter((i): i is { kind: 'post'; data: Post } => i.kind === 'post').map(i => i.data)}
          reels={items.filter((i): i is { kind: 'reel'; data: Reel } => i.kind === 'reel').map(i => i.data)}
          initialType={viewer.type}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
          onOpenProfile={(uid) => { setViewer(null); onOpenProfile?.(uid); }}
        />
      )}
    </div>
  );
};
