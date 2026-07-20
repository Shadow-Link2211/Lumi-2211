import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Music, Play, Pause } from 'lucide-react';
import { Post, Reel, Comment, TrendingAudio } from '../lib/supabase';
import { Avatar } from './Avatar';
import { OwnerBadge, VerifiedBadge } from './Badges';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { useLiked, useSaved } from '../lib/useSocial';
import { supabase } from '../lib/supabase';
import { loadYouTubeAPI } from '../lib/youtube';

interface PostViewerProps {
  posts: Post[];
  reels: Reel[];
  initialType: 'post' | 'reel';
  initialIndex: number;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onDeletePost?: (id: string) => void;
  onDeleteReel?: (id: string) => void;
}

export const PostViewer: React.FC<PostViewerProps> = ({ posts, reels, initialType, initialIndex, onClose, onOpenProfile, onDeletePost, onDeleteReel }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [type, setType] = useState<'post' | 'reel'>(initialType);
  const [index, setIndex] = useState(initialIndex);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioPlayerRef = useRef<any>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const [audioTrack, setAudioTrack] = useState<TrendingAudio | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const items = type === 'post' ? posts : reels;
  const current = items[index];

  const { liked, toggleLike } = useLiked(type === 'post' ? { post_id: current?.id } : { reel_id: current?.id });
  const { saved, toggleSave } = useSaved(type === 'post' ? { post_id: current?.id } : { reel_id: current?.id });
  const [likeCount, setLikeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);

  useEffect(() => {
    if (!current) return;
    if (type === 'post') {
      setLikeCount((current as Post).like_count);
      setSaveCount((current as Post).save_count);
    } else {
      setLikeCount((current as Reel).like_count);
      setSaveCount((current as Reel).save_count);
    }
  }, [current, type]);

  // Realtime count sync
  useEffect(() => {
    if (!current) return;
    const table = type === 'post' ? 'posts' : 'reels';
    const channel = supabase
      .channel(`viewer-${table}-${current.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `id=eq.${current.id}` }, (payload: any) => {
        setLikeCount(payload.new.like_count);
        setSaveCount(payload.new.save_count);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [current?.id, type]);

  // Load comments
  useEffect(() => {
    if (!current) return;
    const targetTable = type === 'post' ? 'post_id' : 'reel_id';
    const load = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*, profiles!comments_user_id_fkey(*)')
        .eq(targetTable, current.id)
        .order('created_at', { ascending: true });
      setComments((data as unknown as Comment[]) || []);
    };
    load();
  }, [current?.id, type]);

  // Load audio
  useEffect(() => {
    setAudioTrack(null);
    setIsPlaying(false);
    if (audioPlayerRef.current) { try { audioPlayerRef.current.destroy(); } catch {} audioPlayerRef.current = null; }
    if (!current) return;
    const audioId = type === 'post' ? (current as Post).audio_id : (current as Reel).audio_id;
    if (!audioId) return;
    const load = async () => {
      const { data } = await supabase.from('trending_audio').select('*').eq('id', audioId).maybeSingle();
      if (data) {
        setAudioTrack(data as TrendingAudio);
        await loadYouTubeAPI();
        if (audioContainerRef.current) {
          audioPlayerRef.current = new window.YT.Player(audioContainerRef.current, {
            height: '0', width: '0',
            videoId: (data as TrendingAudio).video_id,
            playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: (data as TrendingAudio).video_id },
            events: {
              onReady: (e: any) => { e.target.playVideo(); setIsPlaying(true); },
              onError: () => setIsPlaying(false),
              onStateChange: (e: any) => {
                if (e.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
                if (e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
              },
            },
          });
        }
      }
    };
    load();
    return () => { if (audioPlayerRef.current) { try { audioPlayerRef.current.destroy(); } catch {} audioPlayerRef.current = null; } };
  }, [current?.id, type]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      if (e.key === 'ArrowRight' && index < items.length - 1) setIndex(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, items.length]);

  const handleLike = async () => {
    const wasLiked = liked;
    await toggleLike();
    if (!wasLiked) {
      setLikeCount(c => c + 1);
      if (current) supabase.from('notifications').insert({ recipient_id: current.user_id, actor_id: user?.id, type: type === 'post' ? 'like' : 'reel_like', [type === 'post' ? 'post_id' : 'reel_id']: current.id }).then();
    } else {
      setLikeCount(c => Math.max(0, c - 1));
    }
  };

  const handleSave = async () => {
    const wasSaved = saved;
    await toggleSave();
    if (!wasSaved) { setSaveCount(c => c + 1); showToast('Saved'); }
    else { setSaveCount(c => Math.max(0, c - 1)); showToast('Removed from saved'); }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !current || !user) return;
    const targetTable = type === 'post' ? 'post_id' : 'reel_id';
    const { data } = await supabase
      .from('comments')
      .insert({ user_id: user.id, [targetTable]: current.id, content: commentText.trim() })
      .select('*, profiles!comments_user_id_fkey(*)')
      .single();
    if (data) {
      setComments(prev => [...prev, data as unknown as Comment]);
      setCommentText('');
      supabase.from('notifications').insert({ recipient_id: current.user_id, actor_id: user.id, type: 'comment', [targetTable]: current.id }).then();
    }
  };

  const toggleAudioPlay = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) { audioPlayerRef.current.pauseVideo(); setIsPlaying(false); }
    else { audioPlayerRef.current.playVideo(); setIsPlaying(true); }
  };

  if (!current) return null;
  const profile = type === 'post' ? (current as Post).profiles : (current as Reel).profiles;
  const imageUrl = type === 'post' ? (current as Post).image_url : ((current as Reel).thumbnail_url || (current as Reel).video_url);
  const videoUrl = type === 'reel' ? (current as Reel).video_url : null;
  const caption = (current as any).caption || '';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0,0,0,0.92)', zIndex: 100 }}>
      <button className="btn-icon" style={{ position: 'fixed', top: 16, right: 16, color: 'white', zIndex: 200 }} onClick={onClose}><X size={28} /></button>
      {index > 0 && <button className="btn-icon" style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'white', background: 'rgba(255,255,255,0.15)' }} onClick={() => setIndex(index - 1)}><ChevronLeft size={28} /></button>}
      {index < items.length - 1 && <button className="btn-icon" style={{ position: 'fixed', right: 56, top: '50%', transform: 'translateY(-50%)', color: 'white', background: 'rgba(255,255,255,0.15)' }} onClick={() => setIndex(index + 1)}><ChevronRight size={28} /></button>}
      <div className="ig-viewer" onClick={e => e.stopPropagation()}>
        {/* Left: Media */}
        <div className="ig-viewer-media">
          {videoUrl ? (
            <video ref={videoRef} src={videoUrl} controls autoPlay loop playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <img src={imageUrl} alt={caption} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          )}
        </div>
        {/* Right: Info panel */}
        <div className="ig-viewer-panel">
          <div className="ig-viewer-header">
            <Avatar src={profile?.avatar_url || ''} alt={profile?.username || ''} size="sm" />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <span style={{ fontWeight: 700, fontSize: 14, cursor: 'pointer' }} onClick={() => { onOpenProfile(current.user_id); onClose(); }}>
                {profile?.username}
              </span>
              {profile?.is_verified && <VerifiedBadge />}
              {profile?.is_owner && <OwnerBadge />}
            </div>
            <button className="btn-icon"><MoreHorizontal size={20} /></button>
          </div>
          {/* Caption */}
          <div className="ig-viewer-caption">
            <Avatar src={profile?.avatar_url || ''} alt={profile?.username || ''} size="xs" />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{profile?.username}</span>{' '}
              <span style={{ fontSize: 14 }}>{caption}</span>
            </div>
          </div>
          {/* Audio */}
          {audioTrack && (
            <div className="ig-viewer-audio">
              <button className="btn-icon" onClick={toggleAudioPlay} style={{ width: 32, height: 32, flexShrink: 0 }}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audioTrack.title}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{audioTrack.artist}</div>
              </div>
              <Music size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
              <div ref={audioContainerRef} style={{ display: 'none' }} />
            </div>
          )}
          {/* Comments */}
          <div className="ig-viewer-comments">
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: 'var(--space-4)' }}>No comments yet</div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="ig-viewer-comment">
                  <Avatar src={c.profiles?.avatar_url || ''} alt={c.profiles?.username || ''} size="xs" />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{c.profiles?.username}</span>{' '}
                    <span style={{ fontSize: 14 }}>{c.content}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Actions */}
          <div className="ig-viewer-actions">
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn-icon" onClick={handleLike}>
                <Heart size={24} fill={liked ? 'var(--error)' : 'none'} color={liked ? 'var(--error)' : 'currentColor'} />
              </button>
              <button className="btn-icon" onClick={() => setShowComments(!showComments)}>
                <MessageCircle size={24} />
              </button>
              <button className="btn-icon" onClick={() => showToast('Share coming soon')}>
                <Send size={24} />
              </button>
            </div>
            <button className="btn-icon" onClick={handleSave}>
              <Bookmark size={24} fill={saved ? 'var(--primary)' : 'none'} color={saved ? 'var(--primary)' : 'currentColor'} />
            </button>
          </div>
          {/* Counts */}
          <div className="ig-viewer-counts">
            <span style={{ fontWeight: 700, fontSize: 14 }}>{likeCount.toLocaleString()} likes</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{saveCount.toLocaleString()} saves</span>
          </div>
          {/* Timestamp */}
          <div className="ig-viewer-timestamp">
            {new Date((current as any).created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          {/* Comment input */}
          <div className="ig-viewer-comment-input">
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
      </div>
    </div>
  );
};
