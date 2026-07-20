import React, { useState, useRef, useEffect } from 'react';
import { ImagePlus, Sparkles, RefreshCw, MapPin, Music, Play, Pause, Search, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { supabase, TrendingAudio } from '../lib/supabase';
import { loadYouTubeAPI } from '../lib/youtube';
import { aiGenerateCaption, aiDetectExplicitContent, aiFactCheck } from '../lib/ai';

export const CreatePostPage: React.FC<{ onPosted: () => void }> = ({ onPosted }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [imageData, setImageData] = useState('');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiCaption, setAiCaption] = useState<{ caption: string; hashtags: string; emojis: string } | null>(null);
  const [tracks, setTracks] = useState<TrendingAudio[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrendingAudio | null>(null);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [audioSearch, setAudioSearch] = useState('');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MOODS = ['happy', 'study', 'travel', 'fitness', 'food', 'funny'];

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('trending_audio').select('*').order('use_count', { ascending: false }).limit(20);
      if (data && data.length > 0) setTracks(data as TrendingAudio[]);
      else setTracks([
        { id: '1', title: 'Blinding Lights', artist: 'The Weeknd', video_id: '4NRXx6U8ABQ', use_count: 1200, created_at: '' },
        { id: '2', title: 'As It Was', artist: 'Harry Styles', video_id: 'H5v3kku4y6Q', use_count: 980, created_at: '' },
        { id: '3', title: 'Stay', artist: 'The Kid LAROI', video_id: 'kTJczUoc26U', use_count: 850, created_at: '' },
        { id: '4', title: 'Bad Guy', artist: 'Billie Eilish', video_id: 'DyDfgMOUjCI', use_count: 720, created_at: '' },
        { id: '5', title: 'Levitating', artist: 'Dua Lipa', video_id: 'TUVcZfQe-Kw', use_count: 650, created_at: '' },
      ]);
    };
    load();
  }, []);

  const filteredTracks = audioSearch.trim()
    ? tracks.filter(t => t.title.toLowerCase().includes(audioSearch.toLowerCase()) || t.artist.toLowerCase().includes(audioSearch.toLowerCase()))
    : tracks;

  const previewTrack = async (track: TrendingAudio) => {
    await loadYouTubeAPI();
    if (previewing === track.id) {
      if (playerRef.current) playerRef.current.stopVideo();
      setPreviewing(null);
      return;
    }
    if (!playerRef.current) {
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        height: '0', width: '0',
        videoId: track.video_id,
        playerVars: { autoplay: 1, controls: 0 },
        events: { onReady: (e: any) => e.target.playVideo(), onError: () => setPreviewing(null) },
      });
    } else {
      playerRef.current.loadVideoById(track.video_id);
    }
    setPreviewing(track.id);
  };

  const stopPreview = () => {
    if (playerRef.current) playerRef.current.stopVideo();
    setPreviewing(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generateCaption = () => {
    const c = aiGenerateCaption();
    setAiCaption(c);
    showToast('AI caption generated');
  };

  const applyAiCaption = () => {
    if (!aiCaption) return;
    setCaption(`${aiCaption.caption} ${aiCaption.emojis}\n${aiCaption.hashtags}`);
    setAiCaption(null);
  };

  const toggleMood = (mood: string) => {
    setMoodTags(prev => prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]);
  };

  const handleSubmit = async () => {
    if (!imageData || !user) return;
    setLoading(true);
    const isExplicit = aiDetectExplicitContent(caption);
    const factCheck = aiFactCheck(caption);

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      image_url: imageData,
      caption: caption || '',
      location: location || '',
      is_explicit: isExplicit,
      fact_check_status: user.is_owner ? 'verified' : factCheck.status,
      fact_check_reason: user.is_owner ? 'Owner accounts are exempt from AI fact-checking.' : factCheck.reason,
      mood_tags: moodTags,
      audio_id: selectedTrack?.id || null,
    });

    if (error) {
      showToast('Failed to create post');
    } else {
      if (selectedTrack) {
        await supabase.from('trending_audio').update({ use_count: (selectedTrack.use_count + 1) }).eq('id', selectedTrack.id);
      }
      showToast('Post shared successfully!');
      onPosted();
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Create Post</h1>
      </div>
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <div
          className={`image-upload-area ${imageData ? 'has-image' : ''}`}
          onClick={() => !imageData && fileRef.current?.click()}
        >
          {imageData ? (
            <img src={imageData} alt="Preview" />
          ) : (
            <>
              <ImagePlus size={48} />
              <span>Click to upload an image</span>
              <span className="text-xs">JPG, PNG, WEBP supported</span>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />

        {imageData && (
          <button className="btn btn-ghost btn-sm mt-2" onClick={() => fileRef.current?.click()}>Change Image</button>
        )}

        <div className="divider" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label className="label">Caption</label>
            <textarea
              className="input textarea"
              placeholder="Write a caption..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={2200}
            />
            <div className="text-xs text-tertiary" style={{ textAlign: 'right' }}>{caption.length}/2200</div>
            <button className="btn btn-outline btn-sm mt-2" onClick={generateCaption}>
              <Sparkles size={14} /> Generate AI Caption
            </button>
            {aiCaption && (
              <div className="ai-suggestions mt-2">
                <div className="ai-suggestion-header">
                  <span className="ai-tag-label"><Sparkles size={12} /> AI Generated Caption</span>
                  <button className="btn-icon btn-sm" onClick={generateCaption}><RefreshCw size={14} /></button>
                </div>
                <div className="ai-suggestion-item" onClick={applyAiCaption}>
                  <div style={{ flex: 1 }}>
                    <div>{aiCaption.caption} {aiCaption.emojis}</div>
                    <div className="text-accent text-sm">{aiCaption.hashtags}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label"><MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />Location</label>
            <input className="input" placeholder="Add location" value={location} onChange={e => setLocation(e.target.value)} />
          </div>

          <div>
            <label className="label">Mood Tags</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {MOODS.map(m => (
                <div
                  key={m}
                  className={`mood-chip ${moodTags.includes(m) ? 'active' : ''}`}
                  onClick={() => toggleMood(m)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={!imageData || loading}>
            {loading ? <div className="spinner" style={{ borderTopColor: 'white' }} /> : 'Share Post'}
          </button>

          {/* Music attachment */}
          <div>
            <div className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Music size={14} /> Attach a Song (optional)
            </div>
            {selectedTrack ? (
              <div className="audio-item playing" style={{ marginTop: 'var(--space-2)' }}>
                <div className="audio-thumb"><Music size={20} /></div>
                <div className="audio-info">
                  <div className="title">{selectedTrack.title}</div>
                  <div className="artist">{selectedTrack.artist}</div>
                </div>
                <button className="btn-icon btn-sm" onClick={() => setSelectedTrack(null)}><X size={16} /></button>
              </div>
            ) : (
              <button className="btn btn-outline btn-sm w-full mt-2" onClick={() => setShowAudioPicker(!showAudioPicker)}>
                <Music size={14} /> Choose a song
              </button>
            )}
            {showAudioPicker && !selectedTrack && (
              <div className="ai-suggestions mt-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    className="input"
                    style={{ paddingLeft: '32px', fontSize: 13 }}
                    placeholder="Search songs..."
                    value={audioSearch}
                    onChange={e => setAudioSearch(e.target.value)}
                  />
                </div>
                {filteredTracks.map(t => (
                  <div key={t.id} className="audio-item" style={{ padding: 'var(--space-2)' }} onClick={() => { setSelectedTrack(t); setShowAudioPicker(false); stopPreview(); }}>
                    <div className="audio-thumb" style={{ width: 36, height: 36 }} onClick={(e) => { e.stopPropagation(); previewTrack(t); }}>
                      {previewing === t.id ? <Pause size={16} /> : <Play size={16} />}
                    </div>
                    <div className="audio-info">
                      <div className="title" style={{ fontSize: 13 }}>{t.title}</div>
                      <div className="artist" style={{ fontSize: 12 }}>{t.artist}</div>
                    </div>
                  </div>
                ))}
                <div ref={playerContainerRef} style={{ display: 'none' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
