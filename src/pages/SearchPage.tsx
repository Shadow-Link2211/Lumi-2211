import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { Profile, Post } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import { VerifiedBadge, OwnerBadge } from '../components/Badges';

interface SearchPageProps {
  onOpenProfile: (userId: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onOpenProfile }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [searched, setSearched] = useState(false);

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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
      </div>
      <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
        <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input className="input" style={{ paddingLeft: '40px' }} placeholder="Search users, posts, hashtags..." value={query} onChange={e => setQuery(e.target.value)} />
        {query && (
          <button className="btn-icon" style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)' }} onClick={() => setQuery('')}>
            <X size={18} />
          </button>
        )}
      </div>

      {!query && (
        <div className="empty-state">
          <SearchIcon />
          <p>Search for people, posts, and hashtags</p>
        </div>
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
