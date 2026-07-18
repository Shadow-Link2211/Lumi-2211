import React from 'react';

interface ToggleProps {
  active: boolean;
  onChange: (value: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ active, onChange }) => {
  return (
    <div
      className={`toggle ${active ? 'active' : ''}`}
      onClick={() => onChange(!active)}
      role="switch"
      aria-checked={active}
    />
  );
};
