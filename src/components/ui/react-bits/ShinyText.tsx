'use client';

import React from 'react';

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number; // duration in seconds
  className?: string;
  color?: string;
  shineColor?: string;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 3.5,
  className = '',
  color = '#A9B4C7',
  shineColor = '#FFFFFF',
}) => {
  if (disabled) {
    return <span className={className}>{text}</span>;
  }

  return (
    <>
      <span
        className={`inline-block transition-all ${className}`}
        style={{
          backgroundImage: `linear-gradient(120deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: `klirShinyText ${speed}s linear infinite`,
        }}
      >
        {text}
      </span>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes klirShinyText {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `
      }} />
    </>
  );
};

export default ShinyText;
