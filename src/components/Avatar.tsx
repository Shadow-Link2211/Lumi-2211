import React, { useState } from 'react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  className?: string;
}

const FALLBACK = `https://ui-avatars.com/api/?background=ff6b35&color=fff&name=U`;

export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', ring = false, className = '' }) => {
  const [errored, setErrored] = useState(false);
  const sizeClass = `avatar avatar-${size}`;
  const resolvedSrc = (!src || errored)
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(alt || 'U')}&background=ff6b35&color=fff`
    : src;

  const img = (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`${sizeClass} ${className}`}
      loading="lazy"
      onError={() => setErrored(true)}
      referrerPolicy="no-referrer"
    />
  );

  if (ring) {
    return <div className="avatar-ring">{img}</div>;
  }
  return img;
};
