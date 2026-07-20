import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Play, Pause, Volume2, VolumeX, Trash2, X } from 'lucide-react';
import { Reel, Comment, Profile } from '../lib/supabase';
import { Avatar } from './Avatar';
import { OwnerBadge, VerifiedBadge } from './Badges';
import { ShareModal } from './ShareModal';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { useLiked, useSaved } from '../lib/useSocial';

interface ReelCardProps {
  reel: Reel;
  onOpenProfile?: (userId: string) => void;
  onDelete?: (reelId: string) => void;
  fullscreen?: boolean;
}

export const ReelCard: React.FC<ReelCardProps> = ({ reel, onOpenProfile, onDelete, fullscreen }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { liked, toggleLike } = useLiked({ reel_id: reel.id });
  const { saved, toggleSave } = useSaved({ reel_id: reel.id });
  const [likeCount, setLikeCount] = useState(reel.like_count);
  const [saveCount, setSaveCount] = useState(reel.save_count || 0);
  const [muted, setMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const profile = reel.profiles;
  const isMyReel = user?.id === reel.user_id;
  const shareUrl = `${window.location.origin}/?reel=${reel.id}`;

  // Autoplay on visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && videoRef.current) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        } else if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );
    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  // Realtime count sync
  useEffect(() => {
    const channel = supabase
      .channel(`reel-counts-${reel.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reels', filter: `id=eq.${reel.id}` },
        (payload: any) => {
          setLikeCount(payload.new.like_count);
          setSaveCount(payload.new.save_count);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reel.id]);

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles!comments_user_id_fkey(*)')
      .eq('reel_id', reel.id)
      .order('created_at', { ascending: true });
    setComments((data as unknown as Comment[]) || []);
  };

  useEffect(() => {
    if (showComments) loadComments();
  }, [showComments]);

  const handleLike = async () => {
    const wasLiked = liked;
    await toggleLike();
    if (!wasLiked) {
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
      setLikeCount(c => c + 1);
      supabase.from('notifications').insert({ recipient_id: reel.user_id, actor_id: user?.id, type: 'reel_like', reel_id: reel.id }).then();
    } else {
      setShowBreak(true);
      setTimeout(() => setShowBreak(false), 800);
      setLikeCount(c => Math.max(0, c - 1));
    }
  };

  const handleSave = async () => {
    const wasSaved = saved;
    await toggleSave();
    if (!wasSaved) {
      setSaveCount(c => c + 1);
      showToast('Saved');
    } else {
      setSaveCount(c => Math.max(0, c - 1));
      showToast('Removed from saved');
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !user) return;
    const { data } = await supabase
      .from('comments')
      .insert({ user_id: user.id, reel_id: reel.id, content: commentText.trim() })
      .select('*, profiles!comments_user_id_fkey(*)')
      .single();
    if (data) {
      setComments(prev => [...prev, data as unknown as Comment]);
      setCommentText('');
      supabase.from('notifications').insert({ recipient_id: reel.user_id, actor_id: user.id, type: 'comment', reel_id: reel.id }).then();
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
    else { videoRef.current.play().catch(() => {}); setIsPlaying(true); }
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (onDelete) onDelete(reel.id);
  };

  return (
    <div className={`reel-item ${fullscreen ? 'reel-fullscreen' : ''}`} onDoubleClick={handleLike}>
      {reel.video_url ? (
        <video
          ref={videoRef}
          src={reel.video_url}
          loop
          muted={muted}
          playsInline
          className="reel-thumbnail"
          poster={reel.thumbnail_url}
          onClick={togglePlay}
        />
      ) : (
        <img src={reel.thumbnail_url} alt={reel.caption} className="reel-thumbnail" />
      )}

      {showHeart && <div className="heart-burst"><Heart size={80} fill="white" /></div>}
      {showBreak && <div className="heart-break"><Heart size={80} fill="white" /></div>}

      {!isPlaying && reel.video_url && (
        <button className="reel-play-overlay" onClick={togglePlay} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: 16, border: 'none', cursor: 'pointer' }}>
          <Play size={32} fill="white" color="white" />
        </button>
      )}

      <div className="reel-overlay">
        <div className="reel-user" onClick={() => onOpenProfile?.(reel.user_id)} style={{ cursor: 'pointer' }}>
          <Avatar src={profile?.avatar_url || ''} alt={profile?.username || ''} size="sm" ring />
          <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            {profile?.username}
            {profile?.is_verified && <VerifiedBadge />}
            {profile?.is_owner && <OwnerBadge />}
          </span>
        </div>
        <div className="reel-caption">{reel.caption}</div>
      </div>

      <div className="reel-actions">
        <div className="reel-action" onClick={handleLike}>
          <Heart size={28} fill={liked ? 'var(--error)' : 'none'} color={liked ? 'var(--error)' : 'white'} />
          <span>{likeCount.toLocaleString()}</span>
        </div>
        <div className="reel-action" onClick={() => setShowComments(!showComments)}>
          <MessageCircle size={28} />
          <span>{reel.comment_count.toLocaleString()}</span>
        </div>
        <div className="reel-action" onClick={() => setShowShare(true)}>
          <Send size={28} />
          <span>Share</span>
        </div>
        <div className="reel-action" onClick={handleSave}>
          <Bookmark size={28} fill={saved ? 'var(--primary)' : 'none'} color={saved ? 'var(--primary)' : 'white'} />
          <span>{saveCount.toLocaleString()}</span>
        </div>
        {reel.video_url && (
          <div className="reel-action" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={28} /> : <Volume2 size={28} />}
          </div>
        )}
        {isMyReel && (
          <div className="reel-action" onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={28} />
          </div>
        )}
      </div>

      {showMenu && isMyReel && (
        <div style={{ position: 'absolute', right: 'var(--space-3)', bottom: '180px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 20, minWidth: 160 }}>
          <button className="btn-ghost w-full" style={{ padding: '12px', color: 'var(--error)', textAlign: 'left' }} onClick={handleDelete}>
            <Trash2 size={16} style={{ display: 'inline', marginRight: '8px' }} /> Delete Reel
          </button>
        </div>
      )}

      {/* Comments panel */}
      {showComments && (
        <div className="reel-comments-panel" onClick={e => e.stopPropagation()}>
          <div className="reel-comments-header">
            <span style={{ fontWeight: 700 }}>{comments.length} comments</span>
            <button className="btn-icon" onClick={() => setShowComments(false)}><X size={18} /></button>
          </div>
          <div className="reel-comments-list">
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: 'var(--space-4)' }}>No comments yet</div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="reel-comment">
                  <Avatar src={c.profiles?.avatar_url || ''} alt={c.profiles?.username || ''} size="xs" />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{c.profiles?.username}</span>{' '}
                    <span style={{ fontSize: 14 }}>{c.content}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="reel-comment-input">
            <input
              className="input"
              placeholder="Add a comment..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleComment()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleComment} disabled={!commentText.trim()}>Post</button>
          </div>
        </div>
      )}

      {!reel.video_url && !isPlaying && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', opacity: 0.5 }}>
          <Play size={48} />
        </div>
      )}

      <ShareModal open={showShare} onClose={() => setShowShare(false)} url={shareUrl} text={reel.caption} reelId={reel.id} />
    </div>
  );
};
