import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import { money } from "./format";

// Counts from the old amount to the new one, so money visibly moves.
export function MoneyTicker({ cents }: { cents: number }) {
  const text = useRef<HTMLSpanElement>(null);
  const [first] = useState(cents);
  const value = useMotionValue(cents);

  useEffect(() => {
    const controls = animate(value, cents, {
      duration: 0.6,
      ease: [0.23, 1, 0.32, 1],
    });
    return () => controls.stop();
  }, [cents, value]);

  useMotionValueEvent(value, "change", (latest) => {
    if (text.current) text.current.textContent = money(Math.round(latest));
  });

  return <span ref={text}>{money(first)}</span>;
}
