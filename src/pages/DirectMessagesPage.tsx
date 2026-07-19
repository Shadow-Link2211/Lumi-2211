import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Search, MessageCircle, Edit2, Trash2, Copy, Forward, Smile, Paperclip, X, VolumeX, Ban, Trash, Tag } from 'lucide-react';
import { Conversation, Message, Profile, Reaction } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { OwnerBadge, VerifiedBadge } from '../components/Badges';
import { useAuth } from '../lib/auth';
import { formatLastSeen } from '../lib/presence';
import { requestNotificationPermission, showMessageNotification, setOpenConversation } from '../lib/notifications';

interface DirectMessagesProps {
  initialUserId?: string;
  onOpenProfile: (userId: string) => void;
}

interface ConversationWithOther extends Conversation {
  other_user: Profile;
  unread_count: number;
  nickname?: string;
  muted?: boolean;
}

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉', '👏'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25MB

interface ContextMenuState { x: number; y: number; message: Message; }
interface ChatContextMenuState { x: number; y: number; conv: ConversationWithOther; }
interface ForwardState { message: Message; }
interface AttachmentPreview { url: string; type: 'image' | 'video'; file: File; }

export const DirectMessagesPage: React.FC<DirectMessagesProps> = ({ initialUserId, onOpenProfile }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithOther[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationWithOther | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, { is_online: boolean; last_seen_at: string }>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [chatContextMenu, setChatContextMenu] = useState<ChatContextMenuState | null>(null);
  const [reactionMenu, setReactionMenu] = useState<{ x: number; y: number; messageId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardState, setForwardState] = useState<ForwardState | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [forwardResults, setForwardResults] = useState<Profile[]>([]);
  const [attachment, setAttachment] = useState<AttachmentPreview | null>(null);
  const [nicknameModal, setNicknameModal] = useState<Profile | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingReactionIds = useRef<Set<string>>(new Set());

  const activeConvRef = useRef<ConversationWithOther | null>(null);
  const userRef = useRef(user);
  useEffect(() => { activeConvRef.current = activeConv; setOpenConversation(activeConv?.id || null); }, [activeConv]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => { requestNotificationPermission(); }, []);

  // Load conversations with the OTHER participant's profile + per-user metadata
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('conversations')
      .select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)')
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    if (!data) return;

    // Per-user metadata
    const convIds = data.map(c => c.id);
    const otherIds = data.map(c => c.participant_one === user.id ? c.participant_two : c.participant_one);

    const [{ data: hidden }, { data: muted }, { data: nicknames }] = await Promise.all([
      supabase.from('hidden_conversations').select('conversation_id').eq('user_id', user.id).in('conversation_id', convIds),
      supabase.from('muted_chats').select('conversation_id').eq('user_id', user.id).in('conversation_id', convIds),
      supabase.from('contact_nicknames').select('contact_id, nickname').eq('user_id', user.id).in('contact_id', otherIds),
    ]);
    const hiddenSet = new Set((hidden || []).map(h => h.conversation_id));
    const mutedSet = new Set((muted || []).map(m => m.conversation_id));
    const nicknameMap: Record<string, string> = {};
    (nicknames || []).forEach(n => { nicknameMap[n.contact_id] = n.nickname; });

    const convs: ConversationWithOther[] = data
      .filter(c => !hiddenSet.has(c.id))
      .map(c => {
        const isOne = c.participant_one === user.id;
        const other = (isOne ? c.p2 : c.p1) as Profile;
        const otherId = isOne ? c.participant_two : c.participant_one;
        return {
          ...c,
          other_user: other || { id: otherId, username: 'User', full_name: '', avatar_url: '', is_online: false, last_seen_at: '', onboarded: false } as Profile,
          unread_count: 0,
          nickname: nicknameMap[otherId],
          muted: mutedSet.has(c.id),
        };
      });

    const unreadByConv: Record<string, number> = {};
    await Promise.all(convs.map(async c => {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', user.id).eq('is_read', false);
      unreadByConv[c.id] = count || 0;
    }));
    const withUnread = convs.map(c => ({ ...c, unread_count: unreadByConv[c.id] || 0 }));

    const active = activeConvRef.current;
    setConversations(withUnread.map(c => (active && c.id === active.id ? { ...c, unread_count: 0, nickname: active.nickname, muted: active.muted } : c)));

    if (otherIds.length > 0) {
      const { data: presenceData } = await supabase.from('profiles').select('id, is_online, last_seen_at').in('id', otherIds);
      if (presenceData) {
        const map: Record<string, { is_online: boolean; last_seen_at: string }> = {};
        presenceData.forEach(p => { map[p.id] = { is_online: p.is_online, last_seen_at: p.last_seen_at }; });
        setPresenceMap(map);
      }
    }
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadReactionsFor = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return [];
    const { data } = await supabase.from('reactions').select('*').in('message_id', messageIds);
    return (data as Reaction[]) || [];
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('dm-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new as Message;
        const currentUser = userRef.current;
        const active = activeConvRef.current;
        if (!currentUser) return;
        const { data: senderProfile } = await supabase.from('profiles').select('*').eq('id', msg.sender_id).maybeSingle();

        if (active && msg.conversation_id === active.id) {
          const fullMsg = { ...msg, sender: senderProfile as Profile };
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, fullMsg]);
          if (msg.sender_id !== currentUser.id) {
            supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then();
          }
        } else if (msg.sender_id !== currentUser.id) {
          setConversations(prev => prev.map(c => c.id === msg.conversation_id ? { ...c, unread_count: c.unread_count + 1 } : c));
          if (senderProfile) {
            const conv = (await supabase.from('conversations').select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)').eq('id', msg.conversation_id).maybeSingle()).data;
            const isOne = conv?.participant_one === currentUser.id;
            const otherId = isOne ? conv?.participant_two : conv?.participant_one;
            showMessageNotification({
              messageId: msg.id,
              senderName: (senderProfile as Profile).username,
              senderAvatar: (senderProfile as Profile).avatar_url || undefined,
              messagePreview: msg.content || (msg.media_type === 'image' ? '📷 Photo' : '🎥 Video'),
              conversationId: msg.conversation_id,
              otherUserId: otherId || '',
            });
          }
        }
        loadConversations();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as Message;
        const active = activeConvRef.current;
        if (active && updated.conversation_id === active.id) {
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
        loadConversations();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const deleted = payload.old as { id: string };
        setMessages(prev => prev.filter(m => m.id !== deleted.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => {
        const r = payload.new as Reaction;
        // Skip if this is our own pending reaction (already applied optimistically)
        if (pendingReactionIds.current.has(r.id)) return;
        setMessages(prev => prev.map(m => {
          if (m.id !== r.message_id) return m;
          if ((m.reactions || []).some(x => x.id === r.id)) return m; // dedupe
          return { ...m, reactions: [...(m.reactions || []), r] };
        }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, (payload) => {
        const r = payload.old as Reaction;
        setMessages(prev => prev.map(m => {
          if (m.id !== r.message_id) return m;
          return { ...m, reactions: (m.reactions || []).filter(x => x.id !== r.id) };
        }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const p = payload.new as Profile;
        setPresenceMap(prev => ({ ...prev, [p.id]: { is_online: p.is_online, last_seen_at: p.last_seen_at } }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadConversations]);

  useEffect(() => {
    if (initialUserId && user) startConversation(initialUserId);
  }, [initialUserId, user]);

  // Load messages for active conversation + mark as read
  useEffect(() => {
    if (!activeConv || !user) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(*)')
        .eq('conversation_id', activeConv.id)
        .order('created_at', { ascending: true });
      if (data) {
        const allMsgs = data as unknown as Message[];
        // Filter out messages hidden by this user (delete-for-me)
        const { data: hidden } = await supabase.from('hidden_messages').select('message_id').eq('user_id', user.id).in('message_id', allMsgs.map(m => m.id));
        const hiddenSet = new Set((hidden || []).map(h => h.message_id));
        const msgs = allMsgs.filter(m => !hiddenSet.has(m.id));
        const reactions = await loadReactionsFor(msgs.map(m => m.id));
        const reactionsByMsg: Record<string, Reaction[]> = {};
        reactions.forEach(r => { (reactionsByMsg[r.message_id] = reactionsByMsg[r.message_id] || []).push(r); });
        setMessages(msgs.map(m => ({ ...m, reactions: reactionsByMsg[m.id] || [] })));
      }
      await supabase.from('messages').update({ is_read: true }).eq('conversation_id', activeConv.id).neq('sender_id', user.id).eq('is_read', false);
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, unread_count: 0 } : c));
    };
    loadMessages();
  }, [activeConv, user, loadReactionsFor]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startConversation = async (otherUserId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('conversations')
      .select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${otherUserId}),and(participant_one.eq.${otherUserId},participant_two.eq.${user.id})`)
      .maybeSingle();
    if (existing) {
      const isOne = existing.participant_one === user.id;
      const other = (isOne ? existing.p2 : existing.p1) as Profile;
      setActiveConv({ ...(existing as unknown as Conversation), other_user: other, unread_count: 0 });
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ participant_one: user.id, participant_two: otherUserId })
        .select('*, p1:profiles!conversations_participant_one_fkey(*), p2:profiles!conversations_participant_two_fkey(*)')
        .single();
      if (newConv) {
        const isOne = newConv.participant_one === user.id;
        const other = (isOne ? newConv.p2 : newConv.p1) as Profile;
        setActiveConv({ ...(newConv as unknown as Conversation), other_user: other, unread_count: 0 });
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`).neq('id', user?.id || '').limit(10);
    if (data) setSearchResults(data as Profile[]);
  };

  // ===== Media attachment =====
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      if (file.size > MAX_IMAGE_BYTES) { alert('Image must be under 10MB'); return; }
      setAttachment({ url: URL.createObjectURL(file), type: 'image', file });
    } else if (file.type.startsWith('video/')) {
      if (file.size > MAX_VIDEO_BYTES) { alert('Video must be under 25MB'); return; }
      setAttachment({ url: URL.createObjectURL(file), type: 'video', file });
    } else {
      alert('Please select an image or video file');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadMedia = async (file: File): Promise<{ url: string; type: string } | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('chat-media').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) return null;
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
    return { url: pub.publicUrl, type: file.type.startsWith('image/') ? 'image' : 'video' };
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !attachment) || !activeConv || !user) return;
    const content = messageText.trim();
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    if (attachment) {
      const uploaded = await uploadMedia(attachment.file);
      if (uploaded) { mediaUrl = uploaded.url; mediaType = uploaded.type; }
    }
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId, conversation_id: activeConv.id, sender_id: user.id, content,
      is_read: false, created_at: new Date().toISOString(), edited_at: null,
      media_url: mediaUrl, media_type: mediaType, media_thumbnail_url: null,
      sender: user, reactions: [],
    };
    setMessages(prev => [...prev, optimistic]);
    setMessageText('');
    setAttachment(null);

    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: user.id, content, media_url: mediaUrl, media_type: mediaType })
      .select('*, sender:profiles!messages_sender_id_fkey(*)')
      .single();
    if (data) {
      const realMsg = data as unknown as Message;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...realMsg, reactions: [] } : m));
      const preview = content || (mediaType === 'image' ? '📷 Photo' : '🎥 Video');
      await supabase.from('conversations').update({ last_message: preview, last_message_at: new Date().toISOString() }).eq('id', activeConv.id);
      await supabase.from('notifications').insert({ recipient_id: activeConv.other_user.id, actor_id: user.id, type: 'message', message_id: realMsg.id });
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  // ===== Edit / Unsend =====
  const startEdit = (msg: Message) => { setEditingId(msg.id); setEditText(msg.content); setContextMenu(null); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const saveEdit = async (msg: Message) => {
    if (!editText.trim() || !user) return;
    await supabase.from('messages').update({ content: editText.trim(), edited_at: new Date().toISOString() }).eq('id', msg.id);
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() } : m));
    cancelEdit();
  };
  const unsendMessage = async (msg: Message) => {
    if (!user) return;
    setContextMenu(null);
    await supabase.from('messages').delete().eq('id', msg.id);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  };

  // ===== Delete for me (local only) =====
  const deleteForMe = async (msg: Message) => {
    if (!user) return;
    setContextMenu(null);
    await supabase.from('hidden_messages').insert({ user_id: user.id, message_id: msg.id });
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  };

  // ===== Context menu (message) =====
  const openContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 280);
    setContextMenu({ x, y, message: msg });
    setReactionMenu(null);
  };
  const copyMessage = (msg: Message) => { navigator.clipboard?.writeText(msg.content); setContextMenu(null); };

  // ===== Chat context menu =====
  const openChatContextMenu = (e: React.MouseEvent, conv: ConversationWithOther) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setChatContextMenu({ x, y, conv });
  };

  const toggleMute = async (conv: ConversationWithOther) => {
    if (!user) return;
    setChatContextMenu(null);
    if (conv.muted) {
      await supabase.from('muted_chats').delete().eq('user_id', user.id).eq('conversation_id', conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, muted: false } : c));
      if (activeConv?.id === conv.id) setActiveConv({ ...activeConv, muted: false });
    } else {
      await supabase.from('muted_chats').insert({ user_id: user.id, conversation_id: conv.id });
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, muted: true } : c));
      if (activeConv?.id === conv.id) setActiveConv({ ...activeConv, muted: true });
    }
  };

  const blockUser = async (conv: ConversationWithOther) => {
    if (!user) return;
    setChatContextMenu(null);
    if (!confirm(`Block ${conv.other_user.username}? They won't be able to message you.`)) return;
    await supabase.from('blocked_users').insert({ user_id: user.id, blocked_user_id: conv.other_user.id });
    // Hide the conversation for this user
    await supabase.from('hidden_conversations').insert({ user_id: user.id, conversation_id: conv.id });
    setActiveConv(null);
    loadConversations();
  };

  const deleteChatHistory = async (conv: ConversationWithOther) => {
    if (!user) return;
    setChatContextMenu(null);
    if (!confirm('Delete this chat for yourself? The other person will still see it.')) return;
    await supabase.from('hidden_conversations').insert({ user_id: user.id, conversation_id: conv.id });
    setActiveConv(null);
    loadConversations();
  };

  // ===== Nicknames =====
  const openNicknameModal = (contact: Profile) => {
    setNicknameModal(contact);
    const existing = conversations.find(c => c.other_user.id === contact.id)?.nickname || '';
    setNicknameValue(existing);
    setChatContextMenu(null);
  };
  const saveNickname = async () => {
    if (!user || !nicknameModal) return;
    const trimmed = nicknameValue.trim();
    if (trimmed) {
      await supabase.from('contact_nicknames').upsert({ user_id: user.id, contact_id: nicknameModal.id, nickname: trimmed, updated_at: new Date().toISOString() });
    } else {
      await supabase.from('contact_nicknames').delete().eq('user_id', user.id).eq('contact_id', nicknameModal.id);
    }
    setConversations(prev => prev.map(c => c.other_user.id === nicknameModal.id ? { ...c, nickname: trimmed || undefined } : c));
    if (activeConv?.other_user.id === nicknameModal.id) setActiveConv({ ...activeConv, nickname: trimmed || undefined });
    setNicknameModal(null);
    setNicknameValue('');
  };

  // ===== Reactions (fixed: dedupe + pending tracking) =====
  const openReactionMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault(); e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 260);
    const y = Math.min(e.clientY, window.innerHeight - 60);
    setReactionMenu({ x, y, messageId: msg.id });
  };

  const toggleReaction = async (msg: Message, emoji: string) => {
    if (!user) return;
    setReactionMenu(null);
    const existing = (msg.reactions || []).find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      // Remove: track pending so we don't double-apply our own realtime echo
      pendingReactionIds.current.add(existing.id);
      await supabase.from('reactions').delete().eq('id', existing.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: (m.reactions || []).filter(r => r.id !== existing.id) } : m));
      setTimeout(() => pendingReactionIds.current.delete(existing.id), 2000);
    } else {
      // Remove any prior reaction by this user on this message (one per user)
      const prior = (msg.reactions || []).filter(r => r.user_id === user.id);
      if (prior.length > 0) {
        prior.forEach(p => pendingReactionIds.current.add(p.id));
        await supabase.from('reactions').delete().eq('user_id', user.id).eq('message_id', msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: (m.reactions || []).filter(r => r.user_id !== user.id) } : m));
        setTimeout(() => prior.forEach(p => pendingReactionIds.current.delete(p.id)), 2000);
      }
      const { data } = await supabase.from('reactions').insert({ message_id: msg.id, user_id: user.id, emoji }).select().single();
      if (data) {
        pendingReactionIds.current.add(data.id);
        setMessages(prev => prev.map(m => {
          if (m.id !== msg.id) return m;
          if ((m.reactions || []).some(x => x.id === data.id)) return m;
          return { ...m, reactions: [...(m.reactions || []), data as Reaction] };
        }));
        setTimeout(() => pendingReactionIds.current.delete(data.id), 2000);
      }
    }
  };

  // ===== Forward =====
  const openForward = (msg: Message) => { setForwardState({ message: msg }); setContextMenu(null); };
  const handleForwardSearch = async () => {
    if (!forwardSearch.trim()) { setForwardResults([]); return; }
    const { data } = await supabase.from('profiles').select('*').or(`username.ilike.%${forwardSearch}%,full_name.ilike.%${forwardSearch}%`).neq('id', user?.id || '').limit(10);
    setForwardResults((data as Profile[]) || []);
  };
  const forwardTo = async (target: Profile) => {
    if (!user || !forwardState) return;
    const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant_one.eq.${user.id},participant_two.eq.${target.id}),and(participant_one.eq.${target.id},participant_two.eq.${user.id})`).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: newConv } = await supabase.from('conversations').insert({ participant_one: user.id, participant_two: target.id }).select('id').single();
      convId = newConv?.id;
    }
    if (convId) {
      await supabase.from('messages').insert({ conversation_id: convId, sender_id: user.id, content: forwardState.message.content, media_url: forwardState.message.media_url, media_type: forwardState.message.media_type });
      await supabase.from('conversations').update({ last_message: forwardState.message.content || '📷 Photo', last_message_at: new Date().toISOString() }).eq('id', convId);
      await supabase.from('notifications').insert({ recipient_id: target.id, actor_id: user.id, type: 'message' });
    }
    setForwardState(null); setForwardSearch(''); setForwardResults([]);
  };

  // Close menus on outside click
  useEffect(() => {
    const close = () => { setContextMenu(null); setReactionMenu(null); setChatContextMenu(null); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, []);

  if (!user) return null;

  const renderReactions = (msg: Message) => {
    const grouped: Record<string, Reaction[]> = {};
    (msg.reactions || []).forEach(r => { (grouped[r.emoji] = grouped[r.emoji] || []).push(r); });
    const entries = Object.entries(grouped);
    if (entries.length === 0) return null;
    return (
      <div className="message-reactions">
        {entries.map(([emoji, reactions]) => (
          <button key={emoji} className="reaction-chip" onClick={(e) => { e.stopPropagation(); toggleReaction(msg, emoji); }}>
            <span>{emoji}</span><span className="count">{reactions.length}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderMedia = (msg: Message) => {
    if (!msg.media_url) return null;
    if (msg.media_type === 'image') {
      return <img src={msg.media_url} alt="attachment" className="message-media" loading="lazy" />;
    }
    if (msg.media_type === 'video') {
      return <video src={msg.media_url} controls className="message-media" />;
    }
    return null;
  };

  const displayName = (c: ConversationWithOther) => c.nickname || c.other_user?.username;

  return (
    <div className="page-container wide">
      <div className="page-header"><h1 className="page-title">Messages</h1></div>
      <div className="dm-layout">
        <div className={`dm-sidebar ${activeConv ? 'hidden-mobile' : ''}`}>
          <div className="dm-sidebar-header">{user.username}</div>
          <div className="dm-search">
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input className="input" style={{ paddingLeft: '36px' }} placeholder="Search..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); handleSearch(); }} />
            </div>
          </div>
          <div className="dm-conversation-list">
            {searchResults.length > 0 ? (
              searchResults.map(p => (
                <div key={p.id} className="dm-conversation-item" onClick={() => { startConversation(p.id); setSearchResults([]); setSearchQuery(''); }}>
                  <Avatar src={p.avatar_url} alt={p.username} size="md" />
                  <div className="dm-conversation-info"><div className="name">{p.username}</div><div className="last-msg">{p.full_name}</div></div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="dm-empty"><MessageCircle size={40} /><p className="font-semibold">No messages yet</p><p className="text-sm">Search for someone to start chatting</p></div>
            ) : (
              conversations.map(c => {
                const presence = presenceMap[c.other_user.id];
                const online = presence?.is_online;
                return (
                  <div key={c.id} className={`dm-conversation-item ${activeConv?.id === c.id ? 'active' : ''}`} onClick={() => setActiveConv(c)} onContextMenu={(e) => openChatContextMenu(e, c)}>
                    <div style={{ position: 'relative' }}>
                      <Avatar src={c.other_user?.avatar_url || ''} alt={c.other_user?.username || ''} size="md" />
                      {online && <span className="presence-dot online" />}
                    </div>
                    <div className="dm-conversation-info">
                      <div className="name" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        {displayName(c)}
                        {c.other_user?.is_verified && <VerifiedBadge />}
                        {c.other_user?.is_owner && <OwnerBadge />}
                        {c.muted && <VolumeX size={12} style={{ color: 'var(--text-tertiary)' }} />}
                      </div>
                      <div className="last-msg ellipsis">{c.last_message || 'Start a conversation'}</div>
                    </div>
                    {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`dm-chat ${!activeConv ? 'hidden-mobile' : ''}`}>
          {activeConv ? (
            <>
              <div className="dm-chat-header" onClick={() => onOpenProfile(activeConv.other_user?.id || '')} style={{ cursor: 'pointer' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar src={activeConv.other_user?.avatar_url || ''} alt={activeConv.other_user?.username || ''} size="sm" />
                  {presenceMap[activeConv.other_user.id]?.is_online && <span className="presence-dot online" />}
                </div>
                <div>
                  <div className="font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    {displayName(activeConv)}
                    {activeConv.nickname && <span className="nickname-tag">@{activeConv.other_user?.username}</span>}
                    {activeConv.other_user?.is_verified && <VerifiedBadge />}
                    {activeConv.other_user?.is_owner && <OwnerBadge />}
                  </div>
                  <div className="text-sm text-muted" style={{ fontSize: 12 }}>
                    {formatLastSeen(presenceMap[activeConv.other_user.id]?.last_seen_at || null, presenceMap[activeConv.other_user.id]?.is_online || false)}
                  </div>
                </div>
              </div>
              <div className="dm-messages">
                {messages.map(m => {
                  const isMine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`dm-message-row ${isMine ? 'mine' : 'theirs'}`} onContextMenu={(e) => openContextMenu(e, m)}>
                      <div className={`dm-message ${isMine ? 'sent' : 'received'}`}>
                        {editingId === m.id ? (
                          <div className="edit-row">
                            <input className="input edit-input" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(m); if (e.key === 'Escape') cancelEdit(); }} autoFocus />
                            <button className="btn btn-primary btn-sm" onClick={() => saveEdit(m)}>Save</button>
                            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            {renderMedia(m)}
                            {m.content && <span className="message-content">{m.content}</span>}
                            {m.edited_at && <span className="edited-indicator">Edited</span>}
                          </>
                        )}
                      </div>
                      {editingId !== m.id && renderReactions(m)}
                      {editingId !== m.id && (
                        <button className="reaction-trigger" onClick={(e) => openReactionMenu(e, m)} title="React"><Smile size={16} /></button>
                      )}
                    </div>
                  );
                })}
                {messages.length === 0 && <div className="text-muted text-sm" style={{ textAlign: 'center', margin: 'auto' }}>Say hello!</div>}
                <div ref={messagesEndRef} />
              </div>
              {attachment && (
                <div className="attachment-preview-bar">
                  <div className="attachment-preview">
                    {attachment.type === 'image' ? <img src={attachment.url} alt="preview" /> : <video src={attachment.url} />}
                    <button className="attachment-remove" onClick={() => setAttachment(null)}><X size={14} /></button>
                  </div>
                </div>
              )}
              <div className="dm-input-bar">
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Attach"><Paperclip size={20} /></button>
                <input className="input" placeholder="Message..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!messageText.trim() && !attachment}><Send size={16} /></button>
              </div>
            </>
          ) : (
            <div className="dm-empty"><MessageCircle size={48} /><p className="font-semibold">Your Messages</p><p className="text-sm">Select a conversation or search for someone to start messaging</p></div>
          )}
        </div>
      </div>

      {/* Message context menu */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="context-menu-item" onClick={() => openForward(contextMenu.message)}><Forward size={16} /><span>Forward</span></div>
          <div className="context-menu-item" onClick={() => copyMessage(contextMenu.message)}><Copy size={16} /><span>Copy</span></div>
          <div className="context-menu-item danger" onClick={() => deleteForMe(contextMenu.message)}><Trash2 size={16} /><span>Delete for me</span></div>
          {contextMenu.message.sender_id === user.id && (
            <>
              <div className="context-menu-item" onClick={() => startEdit(contextMenu.message)}><Edit2 size={16} /><span>Edit</span></div>
              <div className="context-menu-item danger" onClick={() => unsendMessage(contextMenu.message)}><Trash2 size={16} /><span>Unsend</span></div>
            </>
          )}
        </div>
      )}

      {/* Chat context menu */}
      {chatContextMenu && (
        <div className="context-menu" style={{ left: chatContextMenu.x, top: chatContextMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="context-menu-item" onClick={() => toggleMute(chatContextMenu.conv)}>
            <VolumeX size={16} /><span>{chatContextMenu.conv.muted ? 'Unmute Chat' : 'Mute Chat'}</span>
          </div>
          <div className="context-menu-item" onClick={() => openNicknameModal(chatContextMenu.conv.other_user)}><Tag size={16} /><span>Nickname</span></div>
          <div className="context-menu-item danger" onClick={() => blockUser(chatContextMenu.conv)}><Ban size={16} /><span>Block User</span></div>
          <div className="context-menu-item danger" onClick={() => deleteChatHistory(chatContextMenu.conv)}><Trash size={16} /><span>Delete Chat History</span></div>
        </div>
      )}

      {/* Reaction picker */}
      {reactionMenu && (
        <div className="reaction-picker" style={{ left: reactionMenu.x, top: reactionMenu.y }} onClick={e => e.stopPropagation()}>
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} className="reaction-emoji" onClick={() => { const msg = messages.find(m => m.id === reactionMenu.messageId); if (msg) toggleReaction(msg, emoji); }}>{emoji}</button>
          ))}
        </div>
      )}

      {/* Forward modal */}
      {forwardState && (
        <div className="modal-overlay" onClick={() => { setForwardState(null); setForwardSearch(''); setForwardResults([]); }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Forward Message</h2><button className="btn-icon" onClick={() => { setForwardState(null); setForwardSearch(''); setForwardResults([]); }}>✕</button></div>
            <div className="modal-body">
              <div className="forward-preview">"{forwardState.message.content || (forwardState.message.media_type === 'image' ? '📷 Photo' : '🎥 Video')}"</div>
              <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input className="input" style={{ paddingLeft: '36px' }} placeholder="Search people..." value={forwardSearch} onChange={e => { setForwardSearch(e.target.value); handleForwardSearch(); }} />
              </div>
              <div className="forward-results">
                {forwardResults.map(p => (
                  <div key={p.id} className="forward-result-item" onClick={() => forwardTo(p)}>
                    <Avatar src={p.avatar_url} alt={p.username} size="sm" />
                    <div><div className="font-semibold" style={{ fontSize: 14 }}>{p.username}</div><div className="text-sm text-muted" style={{ fontSize: 12 }}>{p.full_name}</div></div>
                  </div>
                ))}
                {forwardResults.length === 0 && forwardSearch && <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>No users found</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nickname modal */}
      {nicknameModal && (
        <div className="modal-overlay" onClick={() => { setNicknameModal(null); setNicknameValue(''); }}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Nickname</h2><button className="btn-icon" onClick={() => { setNicknameModal(null); setNicknameValue(''); }}>✕</button></div>
            <div className="modal-body">
              <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>Set a private nickname for <strong>{nicknameModal.username}</strong>. Only you will see it.</p>
              <input className="input" placeholder="Enter nickname..." value={nicknameValue} onChange={e => setNicknameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveNickname()} autoFocus />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setNicknameModal(null); setNicknameValue(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNickname}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
