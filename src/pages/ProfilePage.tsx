import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Grid3x3, Bookmark, Heart, Flag, UserPlus, MessageCircle, Clapperboard, Film } from 'lucide-react';
import { Profile, Post, Reel } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { OwnerBadge, VerifiedBadge } from '../components/Badges';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { PostViewer } from '../components/PostViewer';

interface ProfilePageProps {
  userId: string;
  onEditProfile: () => void;
  onNavigate: (page: any, params?: any) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ userId, onEditProfile, onNavigate }) => {
  const { user, isOwner } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [viewer, setViewer] = useState<{ type: 'post' | 'reel'; index: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      setProfile(data as Profile);

      const [postsRes, reelsRes] = await Promise.all([
        supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('reels').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);
      setPosts((postsRes.data as Post[]) || []);
      setReels((reelsRes.data as Reel[]) || []);

      if (user) {
        const { data: savedData } = await supabase.from('saves').select('post_id').eq('user_id', user.id);
        if (savedData && savedData.length > 0) {
          const ids = savedData.map(s => s.post_id);
          const { data: savedPostsData } = await supabase.from('posts').select('*, profiles!posts_user_id_fkey(*)').in('id', ids);
          if (savedPostsData) setSavedPosts(savedPostsData as unknown as Post[]);
        }
      }
    };
    load();
  }, [userId, user]);

  if (!profile) return <div className="loading-center"><div className="spinner" /></div>;

  const isMyProfile = user?.id === userId;
  const reportReasons = ['Spam', 'Harassment', 'Fake Account', 'Hate Speech', 'Impersonation', 'Scam', 'Explicit Content'];

  const handleFollow = async () => {
    if (!user) return;
    if (!isFollowing) {
      setIsFollowing(true);
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
      await supabase.from('notifications').insert({ recipient_id: userId, actor_id: user.id, type: 'follow' });
      showToast('Followed');
    } else {
      setIsFollowing(false);
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId);
      showToast('Unfollowed');
    }
  };

  const handleReport = async (reason: string) => {
    if (!user) return;
    await supabase.from('reports').insert({ reporter_id: user.id, reported_user_id: userId, reason: reason.toLowerCase().replace(/ /g, '_') });
    setShowReport(false);
    showToast('Report submitted. Our team will review it.');
  };

  const handleMessage = () => { onNavigate('messages', { userId }); };

  const handleDeletePost = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    supabase.from('posts').delete().eq('id', id).then();
    setViewer(null);
  };

  const handleDeleteReel = (id: string) => {
    setReels(prev => prev.filter(r => r.id !== id));
    supabase.from('reels').delete().eq('id', id).then();
    setViewer(null);
  };

  const gridItems = tab === 'posts' ? posts : tab === 'reels' ? reels : savedPosts;

  return (
    <div className="page-container wide">
      <div className="profile-header">
        <Avatar src={profile.avatar_url} alt={profile.username} size="xl" ring={isFollowing || isMyProfile} />
        <div className="profile-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {profile.username}
              {profile.is_verified && <VerifiedBadge />}
              {profile.is_owner && <OwnerBadge />}
            </h2>
            <div className="profile-actions">
              {isMyProfile ? (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={onEditProfile}>Edit Profile</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('settings')}><SettingsIcon size={16} /></button>
                </>
              ) : (
                <>
                  <button className={`follow-btn ${isFollowing ? 'following' : 'not-following'}`} onClick={handleFollow}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleMessage}><MessageCircle size={16} /></button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowReport(true)}><Flag size={16} /></button>
                </>
              )}
            </div>
          </div>
          <div className="profile-stats">
            <div className="profile-stat"><span className="num">{profile.post_count || posts.length}</span> <span className="label">posts</span></div>
            <div className="profile-stat"><span className="num">{reels.length}</span> <span className="label">reels</span></div>
            <div className="profile-stat"><span className="num">{profile.follower_count.toLocaleString()}</span> <span className="label">followers</span></div>
            <div className="profile-stat"><span className="num">{profile.following_count.toLocaleString()}</span> <span className="label">following</span></div>
          </div>
          <div className="profile-bio">
            <span className="fullname">{profile.full_name}</span>
            {profile.bio}
            {profile.website && <div className="text-accent" style={{ fontSize: 14 }}>{profile.website}</div>}
          </div>
        </div>
      </div>

      {profile.is_private && !isMyProfile && !isFollowing ? (
        <div className="empty-state">
          <p>This account is private</p>
          <span className="text-sm">Follow to see their photos and videos.</span>
        </div>
      ) : (
        <>
          <div className="profile-tabs">
            <div className={`profile-tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>
              <Grid3x3 size={14} /> POSTS
            </div>
            <div className={`profile-tab ${tab === 'reels' ? 'active' : ''}`} onClick={() => setTab('reels')}>
              <Clapperboard size={14} /> REELS
            </div>
            {isMyProfile && (
              <div className={`profile-tab ${tab === 'saved' ? 'active' : ''}`} onClick={() => setTab('saved')}>
                <Bookmark size={14} /> SAVED
              </div>
            )}
          </div>
          <div className="profile-grid">
            {gridItems.map((item, i) => {
              const isReel = tab === 'reels';
              const reel = item as Reel;
              const post = item as Post;
              return (
                <div key={item.id} className="profile-grid-item" onClick={() => setViewer({ type: tab === 'reels' ? 'reel' : 'post', index: i })}>
                  {isReel ? (
                    <>
                      <img src={reel.thumbnail_url || reel.video_url} alt={reel.caption} loading="lazy" />
                      <div className="explore-overlay">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Film size={16} fill="white" /> {reel.view_count.toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <img src={post.image_url} alt={post.caption} loading="lazy" />
                      <div className="explore-overlay">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Heart size={16} fill="white" /> {post.like_count.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {gridItems.length === 0 && (
            <div className="empty-state">
              <p>{tab === 'posts' ? 'No posts yet' : tab === 'reels' ? 'No reels yet' : 'No saved posts'}</p>
            </div>
          )}
        </>
      )}

      {viewer && (
        <PostViewer
          posts={tab === 'saved' ? savedPosts : posts}
          reels={reels}
          initialType={viewer.type}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
          onOpenProfile={(uid) => { setViewer(null); onNavigate('profile', { userId: uid }); }}
          onDeletePost={handleDeletePost}
          onDeleteReel={handleDeleteReel}
        />
      )}

      <Modal open={showReport} onClose={() => setShowReport(false)} title="Report User">
        <p className="text-muted mb-4">Why are you reporting this account?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {reportReasons.map(reason => (
            <button key={reason} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '12px' }} onClick={() => handleReport(reason)}>
              {reason}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};
