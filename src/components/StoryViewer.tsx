import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Languages, Music, Play, Pause } from 'lucide-react';
import { Story, TrendingAudio } from '../lib/supabase';
import { Avatar } from './Avatar';
import { OwnerBadge, VerifiedBadge } from './Badges';
import { supabase } from '../lib/supabase';
import { loadYouTubeAPI } from '../lib/youtube';

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
];

export const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [showTranslate, setShowTranslate] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [targetLang, setTargetLang] = useState('es');
  const [audioTrack, setAudioTrack] = useState<TrendingAudio | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const story = stories[index];
  const isVideo = story?.media_type === 'video';

  // Load attached audio track when story changes
  useEffect(() => {
    setAudioTrack(null);
    setIsPlaying(false);
    if (!story?.audio_id) return;
    const loadTrack = async () => {
      const { data } = await supabase.from('trending_audio').select('*').eq('id', story.audio_id).maybeSingle();
      if (data) {
        const track = data as TrendingAudio;
        setAudioTrack(track);
        // Auto-play attached audio
        await loadYouTubeAPI();
        if (!playerRef.current) {
          playerRef.current = new window.YT.Player(playerContainerRef.current, {
            height: '0', width: '0',
            videoId: track.video_id,
            playerVars: { autoplay: 1, controls: 0 },
            events: {
              onReady: (e: any) => { e.target.playVideo(); setIsPlaying(true); },
              onError: () => setIsPlaying(false),
              onStateChange: (e: any) => {
                if (e.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
                if (e.data === window.YT.PlayerState.ENDED || e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
              },
            },
          });
        } else {
          playerRef.current.loadVideoById(track.video_id);
        }
      }
    };
    loadTrack();
  }, [story?.audio_id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (playerRef.current) playerRef.current.destroy(); };
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    setPaused(false);
    // Video stories advance when the video ends; image stories use the chosen duration.
    if (isVideo) return;
    const duration = story?.duration ? story.duration * 1000 : 5000;
    const step = 50;
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (paused) return p;
        if (p >= 100) {
          if (index < stories.length - 1) setIndex(index + 1);
          else onClose();
          return 0;
        }
        return p + (step / duration) * 100;
      });
    }, step);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [index, isVideo, paused]);

  // Track video progress for video stories
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const v = videoRef.current;
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    const onEnded = () => {
      if (index < stories.length - 1) setIndex(index + 1);
      else onClose();
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    v.play().catch(() => {});
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
    };
  }, [isVideo, index]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      if (e.key === 'ArrowRight' && index < stories.length - 1) setIndex(index + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index]);

  const handleTranslate = () => {
    if (!showTranslate) {
      setTranslatedText(`[${targetLang.toUpperCase()}] ${story?.caption || ''}`);
    }
    setShowTranslate(!showTranslate);
  };

  const togglePlay = () => {
    if (!playerRef.current || !audioTrack) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
  };

  if (!story) return null;
  const profile = story.profiles;

  return (
    <div className="story-viewer" onClick={onClose}>
      <div className="story-viewer-content" onClick={e => e.stopPropagation()}>
        <div className="story-progress-bar">
          {stories.map((_, i) => (
            <div key={i} className="story-progress-segment">
              <div className="story-progress-fill" style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        <div className="story-viewer-header">
          <Avatar src={profile?.avatar_url || ''} alt={profile?.username || ''} size="sm" />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 600, fontSize: 14 }}>
              {profile?.username}
              {profile?.is_verified && <VerifiedBadge />}
              {profile?.is_owner && <OwnerBadge />}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{new Date(story.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <button className="btn-icon" style={{ color: 'white' }} onClick={onClose}><X size={24} /></button>
        </div>

        {isVideo ? (
          <video
            ref={videoRef}
            src={story.media_url}
            className="story-viewer-video"
            playsInline
            autoPlay
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
            }}
          />
        ) : (
          <img src={story.media_url} alt={story.caption} className="story-viewer-image" />
        )}

        {story.caption && (
          <div className="story-viewer-caption">{story.caption}</div>
        )}

        {/* Now playing bar for attached audio */}
        {audioTrack && (
          <div style={{
            position: 'absolute', bottom: 'var(--space-6)', right: 'var(--space-4)', left: 'var(--space-4)',
            background: 'rgba(0,0,0,0.6)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'white', zIndex: 15,
          }}>
            <button className="btn-icon" style={{ color: 'white', width: 32, height: 32, flexShrink: 0 }} onClick={togglePlay}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audioTrack.title}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{audioTrack.artist}</div>
            </div>
            <Music size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
          </div>
        )}

        {showTranslate && (
          <div className="translate-panel" style={{ bottom: audioTrack ? '100px' : 'var(--space-6)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <select className="input" style={{ flex: 1 }} value={targetLang} onChange={e => { setTargetLang(e.target.value); setTranslatedText(`[${e.target.value.toUpperCase()}] ${story.caption}`); }}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>
            <div className="original">Original: {story.caption}</div>
            <div className="translated">{translatedText}</div>
          </div>
        )}

        <div style={{ position: 'absolute', top: 'var(--space-5)', right: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', zIndex: 15 }}>
          <button className="btn-icon" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={handleTranslate} title="Translate Story">
            <Languages size={20} />
          </button>
        </div>

        {index > 0 && <div className="story-nav prev" onClick={() => setIndex(index - 1)}><ChevronLeft size={24} /></div>}
        {index < stories.length - 1 && <div className="story-nav next" onClick={() => setIndex(index + 1)}><ChevronRight size={24} /></div>}

        <div ref={playerContainerRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};
