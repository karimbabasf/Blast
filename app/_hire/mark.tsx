"use client";

import { useEffect, useState } from "react";
import { BlastMark } from "./logos";

// The header is rendered by every page, so without this the mark would redraw on each visit to a
// new page. It draws once, on the first page of a visit, and stays still after that.
let drawn = false;

export function HeaderMark({ className }: { className?: string }) {
  const [draw] = useState(() => !drawn);
  useEffect(() => {
    drawn = true;
  }, []);
  return <BlastMark className={className} draw={draw} />;
}
