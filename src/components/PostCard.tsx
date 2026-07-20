import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Repeat2, ShieldCheck, ShieldAlert, ShieldX, Sparkles, RefreshCw, Music, Play, Pause } from 'lucide-react';
import { Post, Comment, TrendingAudio } from '../lib/supabase';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { ShareModal } from './ShareModal';
import { OwnerBadge, VerifiedBadge } from './Badges';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { AI_COMMENT_SUGGESTIONS } from '../lib/mockData';
import { supabase } from '../lib/supabase';
import { useLiked } from '../lib/useSocial';
import { loadYouTubeAPI } from '../lib/youtube';
import { aiSummarizeCaption, aiFactCheck } from '../lib/ai';

interface PostCardProps {
  post: Post;
  onOpenProfile?: (userId: string) => void;
  onDelete?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onOpenProfile, onDelete }) => {
  const { user, settings, isOwner } = useAuth();
  const { showToast } = useToast();
  const { liked, toggleLike } = useLiked({ post_id: post.id });
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [showAiComments, setShowAiComments] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showFactCheck, setShowFactCheck] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [explicitBlur, setExplicitBlur] = useState(post.is_explicit && settings?.explicit_content_filter);
  const [showMenu, setShowMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [audioTrack, setAudioTrack] = useState<TrendingAudio | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const shareUrl = `${window.location.origin}/?post=${post.id}`;

  const isMyPost = user?.id === post.user_id;
  const postOwner = post.profiles;
  const showFactBadge = !postOwner?.is_owner && settings?.fake_news_checker !== false;
  const longCaption = post.caption.length > 120;

  // Realtime like/comment count sync across screens
  useEffect(() => {
    const channel = supabase
      .channel(`post-counts-${post.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${post.id}` },
        (payload: any) => {
          setLikeCount(payload.new.like_count);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  // Load attached audio track
  useEffect(() => {
    setAudioTrack(null);
    setIsPlaying(false);
    if (!post.audio_id) return;
    const load = async () => {
      const source = post.audio ?? null;
      if (source) { setAudioTrack(source); return; }
      const { data } = await supabase.from('trending_audio').select('*').eq('id', post.audio_id).maybeSingle();
      if (data) setAudioTrack(data as TrendingAudio);
    };
    load();
  }, [post.audio_id, post.audio]);

  // Auto-play music while the post card is visible; stop on unmount
  useEffect(() => {
    if (!audioTrack) return;
    let observer: IntersectionObserver | null = null;
    const start = async () => {
      await loadYouTubeAPI();
      if (!playerRef.current && playerContainerRef.current) {
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          height: '0', width: '0',
          videoId: audioTrack.video_id,
          playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: audioTrack.video_id },
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
    };
    const stop = () => {
      if (playerRef.current) { try { playerRef.current.pauseVideo(); } catch {} setIsPlaying(false); }
    };
    const wrapper = document.getElementById(`post-media-${post.id}`);
    if (wrapper) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      }, { threshold: 0.6 });
      observer.observe(wrapper);
    }
    return () => {
      if (observer) observer.disconnect();
      if (playerRef.current) { try { playerRef.current.destroy(); } catch {} playerRef.current = null; }
    };
  }, [audioTrack, post.id]);

  const togglePlay = () => {
    if (!playerRef.current || !audioTrack) return;
    if (isPlaying) { playerRef.current.pauseVideo(); setIsPlaying(false); }
    else { playerRef.current.playVideo(); setIsPlaying(true); }
  };

  const handleLike = async () => {
    const wasLiked = liked;
    await toggleLike();
    if (!wasLiked) {
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
      setLikeCount(c => c + 1);
      supabase.from('notifications').insert({ recipient_id: post.user_id, actor_id: user?.id, type: 'like', post_id: post.id }).then();
    } else {
      setShowBreak(true);
      setTimeout(() => setShowBreak(false), 800);
      setLikeCount(c => Math.max(0, c - 1));
    }
  };

  const handleSave = () => {
    if (!saved) {
      setSaved(true);
      supabase.from('saves').insert({ user_id: user?.id, post_id: post.id }).then();
      showToast('Saved to collection');
    } else {
      setSaved(false);
      supabase.from('saves').delete().eq('user_id', user?.id).eq('post_id', post.id).then();
    }
  };

  const handleShare = () => {
    setShowShare(true);
  };

  const handleRepost = () => {
    showToast('Reposted to your feed');
  };

  const loadComments = async () => {
    const { data } = await supabase.from('comments').select('*, profiles!comments_user_id_fkey(*)').eq('post_id', post.id).order('created_at', { ascending: false });
    if (data) setComments(data as unknown as Comment[]);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !user) return;
    const { data } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: user.id,
      content: commentText.trim(),
      is_ai_generated: false,
    }).select('*, profiles!comments_user_id_fkey(*)').single();
    if (data) {
      setComments([data as unknown as Comment, ...comments]);
      supabase.from('notifications').insert({ recipient_id: post.user_id, actor_id: user.id, type: 'comment', post_id: post.id }).then();
    }
    setCommentText('');
  };

  const generateAiComments = () => {
    setAiSuggestions(AI_COMMENT_SUGGESTIONS(post.caption));
    setShowAiComments(true);
  };

  const insertAiComment = (text: string) => {
    setCommentText(text);
    setShowAiComments(false);
  };

  const factCheckIcon = () => {
    switch (post.fact_check_status) {
      case 'verified': return <><ShieldCheck size={12} /> Verified</>;
      case 'suspicious': return <><ShieldAlert size={12} /> Suspicious</>;
      case 'likely_false': return <><ShieldX size={12} /> Likely False</>;
    }
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (onDelete) onDelete(post.id);
  };

  return (
    <article className="post-card">
      <div className="post-header">
        <div className="post-user" onClick={() => onOpenProfile?.(post.user_id)} style={{ cursor: 'pointer' }}>
          <Avatar src={postOwner?.avatar_url || ''} alt={postOwner?.username || ''} size="sm" ring />
          <div style={{ minWidth: 0 }}>
            <div className="username-text">
              {postOwner?.username}
              {postOwner?.is_verified && <VerifiedBadge />}
              {postOwner?.is_owner && <OwnerBadge />}
            </div>
            {post.location && <div className="location-text">{post.location}</div>}
          </div>
        </div>
        {isMyPost && (
          <div style={{ position: 'relative' }}>
            <button className="btn-icon" onClick={() => setShowMenu(!showMenu)}><MoreHorizontal size={20} /></button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 10, minWidth: 160 }}>
                <button className="btn-ghost w-full" style={{ padding: '12px', color: 'var(--error)', textAlign: 'left' }} onClick={handleDelete}>Delete Post</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div id={`post-media-${post.id}`} className="post-image-wrapper post-image-wrapper-contain" onDoubleClick={handleLike}>
        <img src={post.image_url} alt={post.caption} className={explicitBlur ? 'post-image-blur' : ''} loading="lazy" />
        {explicitBlur && (
          <div className="post-explicit-overlay">
            <ShieldAlert size={32} />
            <span>Explicit content filtered</span>
            <button className="btn btn-sm btn-outline" onClick={() => setExplicitBlur(false)}>View anyway</button>
          </div>
        )}
        {showHeart && <div className="heart-burst"><Heart size={80} fill="white" /></div>}
        {showBreak && <div className="heart-break"><Heart size={80} fill="white" /></div>}
        {audioTrack && (
          <div className="post-music-bar">
            <button className="btn-icon" onClick={togglePlay} style={{ color: 'white', width: 28, height: 28, flexShrink: 0 }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="post-music-title">{audioTrack.title}</div>
              <div className="post-music-artist">{audioTrack.artist}</div>
            </div>
            <Music size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
          </div>
        )}
        <div ref={playerContainerRef} style={{ display: 'none' }} />
      </div>

      <div className="post-actions">
        <button className="btn-icon" onClick={handleLike} style={{ color: liked ? 'var(--error)' : undefined }}>
          <Heart size={24} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button className="btn-icon" onClick={toggleComments}><MessageCircle size={24} /></button>
        <button className="btn-icon" onClick={handleShare}><Send size={24} /></button>
        <button className="btn-icon" onClick={handleRepost}><Repeat2 size={24} /></button>
        <div className="spacer" />
        <button className="btn-icon" onClick={handleSave} style={{ color: saved ? 'var(--accent)' : undefined }}>
          <Bookmark size={24} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="post-likes">{likeCount.toLocaleString()} likes</div>

      {showFactBadge && (
        <div className="post-caption" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span className={`fact-badge ${post.fact_check_status}`} onClick={() => setShowFactCheck(true)}>
            {factCheckIcon()}
          </span>
        </div>
      )}

      <div className="post-caption">
        <span className="username-text">{postOwner?.username}</span>
        {showSummary ? aiSummarizeCaption(post.caption) : post.caption}
        {longCaption && (
          <span className="caption-summary" onClick={() => setShowSummary(!showSummary)}>
            <Sparkles size={12} />
            {showSummary ? 'Show original' : 'Summarize'}
          </span>
        )}
      </div>

      {post.comment_count > 0 && !showComments && (
        <div className="post-comments-preview" onClick={toggleComments}>
          View all {post.comment_count} comments
        </div>
      )}

      {showComments && (
        <div className="post-comment-list">
          {comments.map(c => (
            <div key={c.id} className="post-comment-item">
              <Avatar src={c.profiles?.avatar_url || ''} alt={c.profiles?.username || ''} size="sm" />
              <div className="content">
                <span className="username-text">{c.profiles?.username}</span>
                {c.content}
                {c.is_ai_generated && <span className="ai-tag">AI</span>}
              </div>
            </div>
          ))}
          {comments.length === 0 && <div className="text-muted text-sm">No comments yet</div>}
        </div>
      )}

      <div className="post-time">{new Date(post.created_at).toLocaleDateString()}</div>

      <div className="post-comment-input">
        <input
          className="input"
          placeholder="Add a comment..."
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitComment()}
        />
        <button className="btn-icon" onClick={generateAiComments} title="AI Comment Assistant">
          <Sparkles size={20} style={{ color: 'var(--secondary)' }} />
        </button>
        {commentText && <button className="btn btn-sm btn-ghost" style={{ color: 'var(--accent)' }} onClick={submitComment}>Post</button>}
      </div>

      {showAiComments && (
        <div className="ai-suggestions" style={{ margin: 'var(--space-3)' }}>
          <div className="ai-suggestion-header">
            <span className="ai-tag-label"><Sparkles size={12} /> AI Comment Suggestions</span>
            <button className="btn-icon btn-sm" onClick={() => setAiSuggestions(AI_COMMENT_SUGGESTIONS(post.caption))}>
              <RefreshCw size={14} />
            </button>
          </div>
          {aiSuggestions.map((s, i) => (
            <div key={i} className="ai-suggestion-item" onClick={() => insertAiComment(s)}>
              <span style={{ flex: 1 }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      <ShareModal open={showShare} onClose={() => setShowShare(false)} url={shareUrl} text={post.caption} />

      <Modal open={showFactCheck} onClose={() => setShowFactCheck(false)} title="AI Fact Check Analysis">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className={`fact-badge ${post.fact_check_status}`} style={{ alignSelf: 'flex-start', fontSize: 14, padding: '6px 12px' }}>
            {factCheckIcon()}
          </div>
          <p className="text-muted">{post.fact_check_reason || aiFactCheck(post.caption).reason}</p>
          <div className="text-xs text-tertiary">
            Analysis performed by Lumi AI. This is an automated assessment and may not be definitive.
          </div>
        </div>
      </Modal>
    </article>
  );
};
