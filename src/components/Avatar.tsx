import React from 'react';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, size = 'md', ring = false, className = '' }) => {
  const sizeClass = `avatar avatar-${size}`;
  if (ring) {
    return (
      <div className="avatar-ring">
        <img
          src={src || `https://ui-avatars.com/api/?name=${encodeURIComponent(alt)}&background=ff6b35&color=fff`}
          alt={alt}
          className={`${sizeClass} ${className}`}
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <img
      src={src || `https://ui-avatars.com/api/?name=${encodeURIComponent(alt)}&background=ff6b35&color=fff`}
      alt={alt}
      className={`${sizeClass} ${className}`}
      loading="lazy"
    />
  );
};
