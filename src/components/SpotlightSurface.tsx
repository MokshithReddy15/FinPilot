import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';

interface SpotlightSurfaceProps {
  children: React.ReactNode;
  className?: string;
  enableTilt?: boolean;
  delay?: number;
}

export const SpotlightSurface: React.FC<SpotlightSurfaceProps> = ({
  children,
  className = '',
  enableTilt = false,
  delay = 0,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--mouse-x', `${x}px`);
    el.style.setProperty('--mouse-y', `${y}px`);

    if (enableTilt) {
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ry = ((x - cx) / cx) * 3.5;
      const rx = -((y - cy) / cy) * 3.5;
      setTilt({ rx, ry });
    }
  };

  const handleMouseLeave = () => {
    if (enableTilt) {
      setTilt({ rx: 0, ry: 0 });
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        rotateX: tilt.rx,
        rotateY: tilt.ry,
      }}
      transition={{
        opacity: { duration: 0.28, delay },
        y: { type: 'spring', stiffness: 320, damping: 28, delay },
        rotateX: { type: 'spring', stiffness: 260, damping: 22 },
        rotateY: { type: 'spring', stiffness: 260, damping: 22 },
      }}
      style={enableTilt ? { transformPerspective: 1000 } : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`spotlight-card ${className}`}
    >
      {children}
    </motion.div>
  );
};
