import React, { useState, useEffect, useCallback } from 'react';
import { Post, Story, Reel } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { PostCard } from '../components/PostCard';
import { FeedReelCard } from '../components/FeedReelCard';
import { StoriesBar } from '../components/StoriesBar';
import { PostViewer } from '../components/PostViewer';
import { aiMoodFilter } from '../lib/ai';
import { useAuth } from '../lib/auth';

const MOODS = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'study', label: 'Study', emoji: '📚' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'fitness', label: 'Fitness', emoji: '💪' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'funny', label: 'Funny', emoji: '😂' },
];

type FeedItem =
  | { kind: 'post'; data: Post }
  | { kind: 'reel'; data: Reel };

interface HomeFeedProps {
  onOpenProfile: (userId: string) => void;
}

export const HomeFeed: React.FC<HomeFeedProps> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState('all');
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewer, setViewer] = useState<{ type: 'post' | 'reel'; index: number } | null>(null);

  const buildFeed = (posts: Post[], reels: Reel[]): FeedItem[] => {
    // Interleave: insert a reel every 4 posts
    const items: FeedItem[] = [];
    let reelIdx = 0;
    posts.forEach((post, i) => {
      items.push({ kind: 'post', data: post });
      if ((i + 1) % 4 === 0 && reelIdx < reels.length) {
        items.push({ kind: 'reel', data: reels[reelIdx] });
        reelIdx++;
      }
    });
    // Append remaining reels
    while (reelIdx < reels.length) {
      items.push({ kind: 'reel', data: reels[reelIdx] });
      reelIdx++;
    }
    return items;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [postsRes, reelsRes, storiesRes] = await Promise.all([
      supabase.from('posts').select('*, profiles!posts_user_id_fkey(*), audio:trending_audio(*)').order('created_at', { ascending: false }).limit(10),
      supabase.from('reels').select('*, profiles!reels_user_id_fkey(*)').order('created_at', { ascending: false }).limit(5),
      supabase.from('stories').select('*, profiles!stories_user_id_fkey(*)').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(20),
    ]);
    let posts = (postsRes.data as unknown as Post[]) || [];
    const reels = (reelsRes.data as unknown as Reel[]) || [];

    // Use recommendation algorithm if user is logged in
    if (user && posts.length > 0) {
      try {
        const { data: recommended } = await supabase.rpc('get_recommended_posts', { p_user_id: user.id, p_limit: 10 });
        if (recommended && recommended.length > 0) {
          // Fetch full post data with profiles for recommended posts
          const recIds = recommended.map((r: any) => r.id);
          const { data: recPosts } = await supabase
            .from('posts')
            .select('*, profiles!posts_user_id_fkey(*), audio:trending_audio(*)')
            .in('id', recIds);
          if (recPosts && recPosts.length > 0) {
            // Sort by recommendation score
            const scoreMap = new Map(recommended.map((r: any) => [r.id, r.score]));
            posts = (recPosts as unknown as Post[]).sort((a, b) =>
              Number(scoreMap.get(b.id) || 0) - Number(scoreMap.get(a.id) || 0)
            );
          }
        }
      } catch {
        // Fall back to chronological if RPC fails
      }
    }

    setFeed(buildFeed(posts, reels));
    setStories((storiesRes.data as unknown as Story[]) || []);
    if (posts.length < 10) setHasMore(false);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const { data: morePosts } = await supabase
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(*)')
      .order('created_at', { ascending: false })
      .range((page + 1) * 10, (page + 2) * 10 - 1);
    const { data: moreReels } = await supabase
      .from('reels')
      .select('*, profiles!reels_user_id_fkey(*)')
      .order('created_at', { ascending: false })
      .range((page + 1) * 5, (page + 2) * 5 - 1);
    if (morePosts && morePosts.length > 0) {
      setFeed(prev => [...prev, ...buildFeed(morePosts as unknown as Post[], (moreReels as unknown as Reel[]) || [])]);
      setPage(p => p + 1);
      if (morePosts.length < 10) setHasMore(false);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [page, hasMore, loadingMore]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !loadingMore && hasMore) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, hasMore]);

  const handleDelete = (postId: string) => {
    setFeed(prev => prev.filter(item => !(item.kind === 'post' && item.data.id === postId)));
    supabase.from('posts').delete().eq('id', postId).then();
  };

  const moodFilteredPosts = aiMoodFilter(
    feed.filter((i): i is { kind: 'post'; data: Post } => i.kind === 'post').map(i => i.data),
    mood
  );
  const moodFilteredReels = mood === 'all'
    ? feed.filter((i): i is { kind: 'reel'; data: Reel } => i.kind === 'reel').map(i => i.data)
    : [];
  const filteredFeed = buildFeed(moodFilteredPosts, moodFilteredReels);

  return (
    <div className="page-container">
      <StoriesBar stories={stories} onOpenProfile={onOpenProfile} />

      <div className="mood-selector">
        {MOODS.map(m => (
          <div key={m.id} className={`mood-chip ${mood === m.id ? 'active' : ''}`} onClick={() => setMood(m.id)}>
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filteredFeed.length === 0 ? (
        <div className="empty-state">
          <p>No posts {mood !== 'all' ? 'for this mood' : 'yet'}.</p>
          {mood !== 'all' && <button className="btn btn-outline mt-4" onClick={() => setMood('all')}>View all posts</button>}
        </div>
      ) : (
        <div key={mood} style={{ animation: 'fadeIn var(--transition) ease-out' }}>
          {filteredFeed.map(item =>
            item.kind === 'post' ? (
              <PostCard key={`post-${item.data.id}`} post={item.data} onOpenProfile={onOpenProfile} onDelete={handleDelete} onOpenViewer={() => setViewer({ type: 'post', index: filteredFeed.findIndex(f => f.kind === 'post' && f.data.id === item.data.id) })} />
            ) : (
              <FeedReelCard key={`reel-${item.data.id}`} reel={item.data} onOpenProfile={onOpenProfile} onOpenViewer={() => setViewer({ type: 'reel', index: filteredFeed.findIndex(f => f.kind === 'reel' && f.data.id === item.data.id) })} />
            )
          )}
          {loadingMore && <div className="loading-more"><div className="spinner" /></div>}
          {!hasMore && <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 'var(--space-5)' }}>You're all caught up ✨</div>}
        </div>
      )}
      {viewer && (
        <PostViewer
          posts={filteredFeed.filter((i): i is { kind: 'post'; data: Post } => i.kind === 'post').map(i => i.data)}
          reels={filteredFeed.filter((i): i is { kind: 'reel'; data: Reel } => i.kind === 'reel').map(i => i.data)}
          initialType={viewer.type}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
          onOpenProfile={(uid) => { setViewer(null); onOpenProfile(uid); }}
          onDeletePost={handleDelete}
        />
      )}
    </div>
  );
};
