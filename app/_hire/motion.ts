// The one motion scale. Components take their curve and durations from here and from the matching
// CSS variables in globals.css, so no file invents its own timing.
export const OUT = [0.23, 1, 0.32, 1] as const;

export const DUR = {
  // A control giving under the finger.
  press: 0.12,
  // Hover, colour, a small swap.
  quick: 0.16,
  // Something arriving on the page.
  enter: 0.28,
} as const;
