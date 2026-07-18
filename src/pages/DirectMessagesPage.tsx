import React, { useState, useEffect, useRef } from 'react';
import { Send, Search, MessageCircle } from 'lucide-react';
import { Conversation, Message, Profile } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../lib/auth';

interface DirectMessagesProps {
  initialUserId?: string;
  onOpenProfile: (userId: string) => void;
}

export const DirectMessagesPage: React.FC<DirectMessagesProps> = ({ initialUserId, onOpenProfile }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const loadConversations = async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*, other:profiles!conversations_participant_two_fkey(*)')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      if (data) {
        const convs = data.map(c => {
          const otherId = c.participant_one === user.id ? c.participant_two : c.participant_one;
          const other = c.participant_one === user.id ? null : c.other;
          return { ...c, other_user: other || { id: otherId, username: 'User', avatar_url: '', full_name: '' } as Profile };
        });
        setConversations(convs as unknown as Conversation[]);
      }
    };
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (initialUserId && user) {
      startConversation(initialUserId);
    }
  }, [initialUserId, user]);

  useEffect(() => {
    if (!activeConv) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(*)')
        .eq('conversation_id', activeConv.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as unknown as Message[]);
    };
    loadMessages();
    const channel = supabase.channel(`messages:${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startConversation = async (otherUserId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${otherUserId}),and(participant_one.eq.${otherUserId},participant_two.eq.${user.id})`)
      .maybeSingle();
    if (existing) {
      const otherUser = { id: otherUserId, username: 'User', avatar_url: '', full_name: '' } as Profile;
      setActiveConv({ ...(existing as unknown as Conversation), other_user: otherUser });
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ participant_one: user.id, participant_two: otherUserId })
        .select().single();
      if (newConv) {
        const otherUser = { id: otherUserId, username: 'User', avatar_url: '', full_name: '' } as Profile;
        setActiveConv({ ...(newConv as unknown as Conversation), other_user: otherUser });
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
      .neq('id', user?.id || '')
      .limit(10);
    if (data) setSearchResults(data as Profile[]);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !activeConv || !user) return;
    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: activeConv.id, sender_id: user.id, content: messageText.trim() })
      .select('*, sender:profiles!messages_sender_id_fkey(*)')
      .single();
    if (data) {
      setMessages(prev => [...prev, data as unknown as Message]);
      await supabase.from('conversations').update({ last_message: messageText.trim(), last_message_at: new Date().toISOString() }).eq('id', activeConv.id);
    }
    setMessageText('');
  };

  if (!user) return null;

  return (
    <div className="page-container wide">
      <div className="page-header">
        <h1 className="page-title">Messages</h1>
      </div>
      <div className="dm-layout">
        <div className={`dm-sidebar ${activeConv ? 'hidden-mobile' : ''}`}>
          <div className="dm-sidebar-header">{user.username}</div>
          <div className="dm-search">
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                className="input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); handleSearch(); }}
              />
            </div>
          </div>
          <div className="dm-conversation-list">
            {searchResults.length > 0 ? (
              searchResults.map(p => (
                <div key={p.id} className="dm-conversation-item" onClick={() => { startConversation(p.id); setSearchResults([]); setSearchQuery(''); }}>
                  <Avatar src={p.avatar_url} alt={p.username} size="md" />
                  <div className="dm-conversation-info">
                    <div className="name">{p.username}</div>
                    <div className="last-msg">{p.full_name}</div>
                  </div>
                </div>
              ))
            ) : conversations.length === 0 ? (
              <div className="dm-empty">
                <MessageCircle size={40} />
                <p className="font-semibold">No messages yet</p>
                <p className="text-sm">Search for someone to start chatting</p>
              </div>
            ) : (
              conversations.map(c => (
                <div key={c.id} className={`dm-conversation-item ${activeConv?.id === c.id ? 'active' : ''}`} onClick={() => setActiveConv(c)}>
                  <Avatar src={c.other_user?.avatar_url || ''} alt={c.other_user?.username || ''} size="md" />
                  <div className="dm-conversation-info">
                    <div className="name">{c.other_user?.username}</div>
                    <div className="last-msg ellipsis">{c.last_message || 'Start a conversation'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`dm-chat ${!activeConv ? 'hidden-mobile' : ''}`}>
          {activeConv ? (
            <>
              <div className="dm-chat-header" onClick={() => onOpenProfile(activeConv.other_user?.id || '')} style={{ cursor: 'pointer' }}>
                <Avatar src={activeConv.other_user?.avatar_url || ''} alt={activeConv.other_user?.username || ''} size="sm" />
                <div className="font-semibold">{activeConv.other_user?.username}</div>
              </div>
              <div className="dm-messages">
                {messages.map(m => (
                  <div key={m.id} className={`dm-message ${m.sender_id === user.id ? 'sent' : 'received'}`}>
                    {m.content}
                  </div>
                ))}
                {messages.length === 0 && <div className="text-muted text-sm" style={{ textAlign: 'center', margin: 'auto' }}>Say hello!</div>}
                <div ref={messagesEndRef} />
              </div>
              <div className="dm-input-bar">
                <input
                  className="input"
                  placeholder="Message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                />
                <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!messageText.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="dm-empty">
              <MessageCircle size={48} />
              <p className="font-semibold">Your Messages</p>
              <p className="text-sm">Select a conversation or search for someone to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
