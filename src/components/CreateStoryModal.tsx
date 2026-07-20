import React, { useState, useRef, useEffect } from 'react';
import { X, ImagePlus, Video, Send, Music, Play, Pause, Search, Clock } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { supabase, TrendingAudio } from '../lib/supabase';
import { loadYouTubeAPI } from '../lib/youtube';

interface CreateStoryModalProps {
  onClose: () => void;
}

const DURATION_OPTIONS = [3, 5, 10, 15, 20, 30, 45, 60];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [mediaData, setMediaData] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [duration, setDuration] = useState(5);
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<TrendingAudio[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrendingAudio | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [audioSearch, setAudioSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('video/')) {
      if (file.size > 30 * 1024 * 1024) {
        showToast('Video must be under 30MB');
        return;
      }
      setMediaType('video');
    } else {
      setMediaType('image');
    }
    const reader = new FileReader();
    reader.onload = () => setMediaData(reader.result as string);
    reader.readAsDataURL(file);
  };

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

  const handleShare = async () => {
    if (!mediaData || !user) return;
    setLoading(true);
    if (previewing) stopPreview();
    const { error } = await supabase.from('stories').insert({
      user_id: user.id,
      media_url: mediaData,
      media_type: mediaType,
      caption: caption || '',
      duration: mediaType === 'image' ? duration : 60,
      audio_id: selectedTrack?.id || null,
    });
    if (error) {
      showToast('Failed to share story');
    } else {
      if (selectedTrack) {
        await supabase.from('trending_audio').update({ use_count: (selectedTrack.use_count + 1) }).eq('id', selectedTrack.id);
      }
      showToast('Story shared!');
      onClose();
    }
    setLoading(false);
  };

  const filteredTracks = audioSearch.trim()
    ? tracks.filter(t => t.title.toLowerCase().includes(audioSearch.toLowerCase()) || t.artist.toLowerCase().includes(audioSearch.toLowerCase()))
    : tracks;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add to Your Story</h2>
          <button className="btn-icon" onClick={() => { stopPreview(); onClose(); }}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div
            className={`image-upload-area ${mediaData ? 'has-image' : ''}`}
            onClick={() => !mediaData && fileRef.current?.click()}
            style={{ aspectRatio: '9/16', maxHeight: 400 }}
          >
            {mediaData ? (
              mediaType === 'video' ? (
                <video src={mediaData} controls style={{ width: '100%', maxHeight: 400, borderRadius: 'var(--radius-lg)' }} />
              ) : (
                <img src={mediaData} alt="Story preview" style={{ objectFit: 'cover' }} />
              )
            ) : (
              <>
                <ImagePlus size={48} />
                <span>Select a photo or video for your story</span>
                <span className="text-xs">Images & videos up to 30MB</span>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ display: 'none' }} />
          {mediaData && (
            <>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  {mediaType === 'video' ? <><Video size={14} /> Change Video</> : <><ImagePlus size={14} /> Change Photo</>}
                </button>
                {mediaType === 'video' && (
                  <span className="text-xs text-tertiary" style={{ alignSelf: 'center' }}>Video stories play for their full duration</span>
                )}
              </div>
              <input
                className="input mt-3"
                placeholder="Add a caption..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={100}
              />

              {mediaType === 'image' && (
                <div className="mt-3">
                  <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> Display Duration ({duration}s)
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                    {DURATION_OPTIONS.map(d => (
                      <button
                        key={d}
                        className={`btn btn-sm ${duration === d ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setDuration(d)}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio attachment */}
              <div className="mt-4">
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
              </div>

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

              <button className="btn btn-primary w-full mt-4" onClick={handleShare} disabled={loading}>
                {loading ? <div className="spinner" style={{ borderTopColor: 'white' }} /> : <><Send size={16} /> Share Story</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
