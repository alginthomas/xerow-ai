/**
 * Thinking Indicator Component
 * Shows animated indicator while assistant is thinking/generating
 * Similar to brackett's "Brikki-bubbling" animation
 */

import { useState, useEffect } from "react";
import * as m from "motion/react-m";

interface ThinkingIndicatorProps {
  className?: string;
  cycleInterval?: number;
}

const thinkingMessages = [
  "Thinking...",
  "Processing...",
  "Analyzing...",
];

// Bubbling animation similar to brackett's Brikki-bubbling
function BubblingIndicator() {
  return (
    <m.div
      className="inline-block w-3 h-3 bg-primary/70 rounded-full"
      animate={{
        scale: [1, 1.4, 1.4, 1, 1],
        rotate: [0, 0, 180, 180, 0],
        borderRadius: ["50%", "50%", "50%", "50%", "50%"],
      }}
      transition={{
        duration: 2,
        ease: "easeInOut",
        times: [0, 0.2, 0.5, 0.8, 1],
        repeat: Infinity,
        repeatDelay: 0.7,
      }}
      aria-hidden="true"
    />
  );
}

export function ThinkingIndicator({
  className = "",
  cycleInterval = 2500,
}: ThinkingIndicatorProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Cycle through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, cycleInterval);

    return () => clearInterval(interval);
  }, [cycleInterval]);

  return (
    <div className={`flex items-center gap-2.5 text-muted-foreground text-sm font-medium ${className}`}>
      <BubblingIndicator />
      <span
        key={currentMessageIndex}
        className="animate-in fade-in duration-300"
      >
        {thinkingMessages[currentMessageIndex]}
      </span>
    </div>
  );
}
