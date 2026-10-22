import React, { useEffect, useRef, useState } from 'react';

interface CountUpTextProps {
  value: number;
  formatter: (val: number) => string;
  durationMs?: number;
  className?: string;
}

function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export const CountUpText: React.FC<CountUpTextProps> = ({
  value,
  formatter,
  durationMs = 420,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    prevValueRef.current = value;

    if (durationMs <= 0 || Math.abs(endVal - startVal) < 0.01) {
      setDisplayValue(endVal);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayValue(current);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return <span className={className}>{formatter(displayValue)}</span>;
};
