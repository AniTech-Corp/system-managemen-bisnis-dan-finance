'use client';

import React, { useRef, useState, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  contentClassName?: string;
  spotlightColor?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  contentClassName = '',
  spotlightColor = 'rgba(78, 155, 255, 0.15)',
  style = {},
  onClick,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current || isTouchDevice) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => {
    if (!isTouchDevice) setOpacity(1);
  };

  const handleMouseLeave = () => {
    if (!isTouchDevice) setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={style}
      className={`relative rounded-xl border-0 bg-[#0E131B] overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* Desktop dynamic spotlight */}
      {!isTouchDevice && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out z-0"
          style={{
            opacity,
            background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
          }}
        />
      )}

      {/* Mobile touch-safe ambient glow */}
      {isTouchDevice && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40 z-0"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${spotlightColor}, transparent 70%)`,
          }}
        />
      )}

      {/* Card Content with relative positioning to stay above spotlight */}
      <div className={`relative z-10 w-full h-full ${contentClassName || 'flex flex-col'}`}>{children}</div>
    </div>
  );
};

export default SpotlightCard;
export { SpotlightCard };
