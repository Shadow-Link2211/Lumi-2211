import { Post } from './supabase';
import { AI_CAPTIONS } from './mockData';

export const aiSummarizeCaption = (caption: string): string => {
  if (caption.length <= 120) return caption;
  const sentences = caption.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length <= 2) return caption;
  return sentences.slice(0, 2).join('. ').trim() + '.';
};

export const aiFactCheck = (caption: string): { status: 'verified' | 'suspicious' | 'likely_false'; reason: string } => {
  const suspiciousKeywords = ['breaking', 'shocking truth', 'they don\'t want you to know', 'miracle cure', '100% guaranteed'];
  const falseKeywords = ['definitely real', 'proven fact', 'doctors hate', 'secret cure'];
  const lower = caption.toLowerCase();
  if (falseKeywords.some(k => lower.includes(k))) {
    return { status: 'likely_false', reason: 'This post contains language commonly associated with misinformation. The claims appear unsubstantiated and use manipulative framing typical of false content.' };
  }
  if (suspiciousKeywords.some(k => lower.includes(k))) {
    return { status: 'suspicious', reason: 'This post uses attention-grabbing language that may exaggerate or mislead. While not necessarily false, the claims should be verified with additional sources.' };
  }
  return { status: 'verified', reason: 'No misleading claims detected. This content appears to be authentic and does not contain language patterns associated with misinformation.' };
};

export const aiGenerateCaption = (imageDescription?: string) => {
  const idx = Math.floor(Math.random() * AI_CAPTIONS.length);
  return AI_CAPTIONS[idx];
};

export const aiDetectExplicitContent = (caption: string): boolean => {
  const explicitKeywords = ['nsfw', 'explicit', 'adult only', '18+'];
  return explicitKeywords.some(k => caption.toLowerCase().includes(k));
};

export const aiMoodFilter = <T extends { mood_tags?: string[] }>(items: T[], mood: string): T[] => {
  if (!mood || mood === 'all') return items;
  return items.filter(item => item.mood_tags?.includes(mood));
};
