import React from 'react';

interface RiskBadgeProps {
  label: string;
  level: 'GREEN' | 'YELLOW' | 'RED';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ label, level }) => {
  const colors = {
    GREEN: 'bg-green-900/30 text-green-400 border-green-800',
    YELLOW: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    RED: 'bg-red-900/30 text-red-400 border-red-800 animate-pulse',
  };

  return (
    <span className={`text-xs px-2 py-0.5 border rounded ${colors[level]} mr-2 mb-1 inline-block`}>
      {label}
    </span>
  );
};