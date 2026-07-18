import React from 'react';
import { BadgeCheck, Crown } from 'lucide-react';

export const OwnerBadge: React.FC = () => (
  <span className="owner-badge">
    <Crown size={10} /> Owner
  </span>
);

export const VerifiedBadge: React.FC = () => (
  <span className="verified-badge">
    <BadgeCheck size={14} fill="currentColor" />
  </span>
);
