import React, { useState, useRef } from 'react';
import { ImagePlus, Sparkles, RefreshCw, MapPin } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
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
  const fileRef = useRef<HTMLInputElement>(null);

  const MOODS = ['happy', 'study', 'travel', 'fitness', 'food', 'funny'];

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
    });

    if (error) {
      showToast('Failed to create post');
    } else {
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
        </div>
      </div>
    </div>
  );
};
