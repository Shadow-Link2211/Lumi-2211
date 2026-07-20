import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, X, Clock, TrendingUp, Trash2 } from 'lucide-react';
import { Profile, Post } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { VerifiedBadge, OwnerBadge } from '../components/Badges';
import { useAuth } from '../lib/auth';

interface SearchHistoryEntry {
  id: string;
  query: string;
  searched_at: string;
}

export const SearchPage: React.FC<{ onOpenProfile: (userId: string) => void }> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [searched, setSearched] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [suggested, setSuggested] = useState<Profile[]>([]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', user.id)
      .order('searched_at', { ascending: false })
      .limit(10);
    setHistory((data as SearchHistoryEntry[]) || []);
  }, [user]);

  const loadSuggestions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .order('follower_count', { ascending: false })
      .limit(5);
    setSuggested((data as Profile[]) || []);
  }, [user]);

  useEffect(() => { loadHistory(); loadSuggestions(); }, [loadHistory, loadSuggestions]);

  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setUsers([]);
        setPosts([]);
        setSearched(false);
        return;
      }
      setSearched(true);
      const [userRes, postRes] = await Promise.all([
        supabase.from('profiles').select('*').or(`username.ilike.%${query}%,full_name.ilike.%${query}%`).limit(10),
        supabase.from('posts').select('*, profiles!posts_user_id_fkey(*)').ilike('caption', `%${query}%`).limit(10),
      ]);
      setUsers((userRes.data as Profile[]) || []);
      setPosts((postRes.data as unknown as Post[]) || []);
    };
    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const recordSearch = async (q: string) => {
    if (!user || !q.trim()) return;
    await supabase.from('search_history').insert({ user_id: user.id, query: q.trim() });
    loadHistory();
  };

  const deleteHistoryEntry = async (id: string) => {
    await supabase.from('search_history').delete().eq('id', id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from('search_history').delete().eq('user_id', user.id);
    setHistory([]);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
      </div>
      <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
        <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          className="input"
          style={{ paddingLeft: '40px' }}
          placeholder="Search users, posts, hashtags..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onBlur={() => recordSearch(query)}
          onKeyDown={e => e.key === 'Enter' && recordSearch(query)}
        />
        {query && (
          <button className="btn-icon" style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }} onClick={() => setQuery('')}>
            <X size={18} />
          </button>
        )}
      </div>

      {!query && (
        <>
          {history.length > 0 && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 className="font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Clock size={16} /> Recent
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={clearHistory} style={{ color: 'var(--primary)', fontSize: 13 }}>Clear all</button>
              </div>
              <div className="search-results">
                {history.map(h => (
                  <div key={h.id} className="search-result-item" style={{ cursor: 'pointer' }} onClick={() => setQuery(h.query)}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={16} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                    <div className="search-result-info">
                      <div className="name" style={{ fontSize: 14 }}>{h.query}</div>
                    </div>
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(h.id); }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <TrendingUp size={16} /> Suggested for you
            </h3>
            <div className="search-results">
              {suggested.map(u => (
                <div key={u.id} className="search-result-item" onClick={() => onOpenProfile(u.id)}>
                  <Avatar src={u.avatar_url} alt={u.username} size="md" />
                  <div className="search-result-info">
                    <div className="name">
                      {u.username}
                      {u.is_verified && <VerifiedBadge />}
                      {u.is_owner && <OwnerBadge />}
                    </div>
                    <div className="sub">{u.full_name} · {u.follower_count.toLocaleString()} followers</div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); onOpenProfile(u.id); }}>View</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {searched && users.length === 0 && posts.length === 0 && (
        <div className="empty-state">
          <p>No results found for "{query}"</p>
        </div>
      )}

      {users.length > 0 && (
        <>
          <h3 className="font-semibold mb-4">People</h3>
          <div className="search-results mb-4">
            {users.map(u => (
              <div key={u.id} className="search-result-item" onClick={() => onOpenProfile(u.id)}>
                <Avatar src={u.avatar_url} alt={u.username} size="md" />
                <div className="search-result-info">
                  <div className="name">
                    {u.username}
                    {u.is_verified && <VerifiedBadge />}
                    {u.is_owner && <OwnerBadge />}
                  </div>
                  <div className="sub">{u.full_name} · {u.follower_count.toLocaleString()} followers</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {posts.length > 0 && (
        <>
          <h3 className="font-semibold mb-4">Posts</h3>
          <div className="explore-grid">
            {posts.map(p => (
              <div key={p.id} className="explore-grid-item" onClick={() => onOpenProfile(p.user_id)}>
                <img src={p.image_url} alt={p.caption} loading="lazy" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
