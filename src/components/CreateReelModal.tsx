import React, { useState, useRef } from 'react';
import { X, Film, Send } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';

interface CreateReelModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export const CreateReelModal: React.FC<CreateReelModalProps> = ({ onClose, onCreated }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [videoData, setVideoData] = useState('');
  const [thumbnailData, setThumbnailData] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      showToast('Video must be under 30MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setVideoData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleThumbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setThumbnailData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleShare = async () => {
    if (!videoData || !user) return;
    setLoading(true);
    const { error } = await supabase.from('reels').insert({
      user_id: user.id,
      video_url: videoData,
      thumbnail_url: thumbnailData || '',
      caption: caption || '',
    });
    if (error) {
      showToast('Failed to share reel');
    } else {
      showToast('Reel shared!');
      onCreated();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Reel</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div
            className="image-upload-area"
            onClick={() => videoRef.current?.click()}
            style={{ aspectRatio: '9/16', maxHeight: 320, cursor: 'pointer' }}
          >
            {videoData ? (
              <video src={videoData} controls style={{ width: '100%', maxHeight: 320, borderRadius: 'var(--radius-lg)' }} />
            ) : (
              <>
                <Film size={48} />
                <span>Select a video for your reel</span>
                <span className="text-xs">MP4, WEBM · max 30MB</span>
              </>
            )}
          </div>
          <input ref={videoRef} type="file" accept="video/*" onChange={handleVideoChange} style={{ display: 'none' }} />
          {videoData && (
            <>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => videoRef.current?.click()}>Change Video</button>
              <div className="mt-3">
                <label className="label">Thumbnail (optional)</label>
                <div
              className="image-upload-area"
              onClick={() => thumbRef.current?.click()}
              style={{ height: 80, padding: 'var(--space-2)', cursor: 'pointer' }}
            >
              {thumbnailData ? (
                <img src={thumbnailData} alt="Thumbnail" style={{ height: '100%', borderRadius: 'var(--radius-md)' }} />
              ) : (
                <span className="text-sm">Choose a custom thumbnail</span>
              )}
            </div>
            <input ref={thumbRef} type="file" accept="image/*" onChange={handleThumbChange} style={{ display: 'none' }} />
          </div>
          <input
            className="input mt-3"
            placeholder="Add a caption..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            maxLength={2200}
          />
          <button className="btn btn-primary w-full mt-4" onClick={handleShare} disabled={loading}>
            {loading ? <div className="spinner" style={{ borderTopColor: 'white' }} /> : <><Send size={16} /> Share Reel</>}
          </button>
        </>
      )}
      </div>
      </div>
    </div>
  );
};
