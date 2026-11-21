import type { ReactNode } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  yOffset?: number;
  className?: string;
}

export function ScrollReveal({
  children,
  delay = 0,
  yOffset = 14,
  className = '',
}: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 'some' }}
      transition={{
        duration: 0.28,
        delay: Math.min(delay, 0.12),
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="h-[2.5px] w-full bg-accent-yellow origin-left pointer-events-none"
    />
  );
}
