'use client';

import React, { useEffect, useState, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number; // in seconds
  delay?: number; // in ms
  prefix?: string;
  suffix?: string;
  separator?: string;
  decimals?: number;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 1.4,
  delay = 0,
  prefix = '',
  suffix = '',
  separator = '.',
  decimals = 0,
  className = '',
}) => {
  const [value, setValue] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const valueRef = useRef(from);
  const prevTo = useRef(to);

  valueRef.current = value;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }

    const animateTo = (startVal: number, targetVal: number) => {
      let startTimestamp: number | null = null;
      let frameId: number;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = startVal + (targetVal - startVal) * easeOut;
        setValue(current);

        if (progress < 1) {
          frameId = requestAnimationFrame(step);
        } else {
          setValue(targetVal);
        }
      };
      frameId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(frameId);
    };

    if (hasAnimated.current) {
      if (prevTo.current !== to) {
        prevTo.current = to;
        return animateTo(valueRef.current, to);
      }
      return;
    }

    let cancelAnim: (() => void) | undefined;
    let timer: NodeJS.Timeout | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          prevTo.current = to;
          timer = setTimeout(() => {
            cancelAnim = animateTo(from, to);
          }, delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
      if (cancelAnim) cancelAnim();
    };
  }, [from, to, duration, delay]);

  const formatNumber = (num: number): string => {
    const isNeg = num < 0;
    const absVal = Math.abs(num);
    const fixed = absVal.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');

    let formattedInt = intPart;
    if (separator) {
      formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    }

    let res = formattedInt;
    if (decimals > 0 && decPart !== undefined) {
      res = `${formattedInt},${decPart}`;
    }
    return isNeg ? `-${res}` : res;
  };

  const isNeg = value < 0;
  const numFormatted = formatNumber(value);

  return (
    <span ref={ref} className={className}>
      {isNeg && prefix ? `-${prefix.trim()}${prefix.endsWith(' ') ? ' ' : ''}` : prefix}
      {isNeg ? numFormatted.slice(1) : numFormatted}
      {suffix}
    </span>
  );
};

export default CountUp;
