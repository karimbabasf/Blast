"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";

export type TabItem = { id: string; label: ReactNode };

const ITEM = "relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap";

// One track holding every tab. The active look is a second copy of the labels, clipped to the
// active tab, so the tile and the text colour move as one piece instead of two animations.
export function TabTrack({
  items,
  active,
  children,
  ...rest
}: {
  items: TabItem[];
  active: string;
  // Renders the real control (a link or a tab button) for one item.
  children: (item: TabItem, className: string) => ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const track = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = track.current;
    const top = cover.current;
    if (!box || !top) return;
    const place = () => {
      const el = box.querySelector<HTMLElement>(`[data-tab-id="${active}"]`);
      if (!el) {
        top.style.clipPath = "inset(0 100% 0 0)";
        return;
      }
      const right = box.clientWidth - el.offsetLeft - el.offsetWidth;
      const bottom = box.clientHeight - el.offsetTop - el.offsetHeight;
      top.style.clipPath = `inset(${el.offsetTop}px ${right}px ${bottom}px ${el.offsetLeft}px round 6px)`;
      // The first placement is not a move, so it must not animate.
      if (!box.dataset.ready) requestAnimationFrame(() => (box.dataset.ready = "true"));
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(box);
    return () => watch.disconnect();
  }, [active, items.length]);

  return (
    <div ref={track} {...rest} className={`group relative flex w-fit max-w-full items-center rounded-lg bg-muted p-1 ${rest.className ?? ""}`}>
      {items.map((item) => (
        <span key={item.id} data-tab-id={item.id} className="relative flex">
          {children(item, `${ITEM} text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground`)}
        </span>
      ))}
      <div
        ref={cover}
        aria-hidden="true"
        style={{ clipPath: "inset(0 100% 0 0)" }}
        className="pointer-events-none absolute inset-0 flex items-center rounded-lg bg-background p-1 will-change-[clip-path] group-data-[ready]:transition-[clip-path] group-data-[ready]:duration-200 group-data-[ready]:ease-out motion-reduce:transition-none"
      >
        {items.map((item) => (
          <span key={item.id} className={`${ITEM} text-foreground`}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
