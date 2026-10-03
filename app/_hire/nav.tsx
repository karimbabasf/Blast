"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/hires", label: "My hires" },
  { href: "/hub", label: "Hub" },
  { href: "/", label: "Hire a specialist" },
  { href: "/post", label: "Post your specialist" },
];

// One track holding every tab; the white tile slides to the tab that was pressed.
export function Nav() {
  const path = usePathname();
  // The pressed tab wins until the new page is in, so the tile moves on the press.
  const [pressed, setPressed] = useState<{ href: string; from: string } | null>(null);
  const active = pressed && pressed.from === path ? pressed.href : path;

  return (
    <nav aria-label="Main" className="flex min-w-0 items-center overflow-x-auto rounded-full bg-muted p-1 text-sm">
      {LINKS.map((l) => {
        const current = active === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            onClick={() => setPressed({ href: l.href, from: path })}
            className={`relative h-8 rounded-full px-3.5 leading-8 whitespace-nowrap transition-colors duration-200 ease-out ${
              current ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {current ? (
              <motion.span
                layoutId="nav-tile"
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-foreground/5"
              />
            ) : null}
            <span className="relative">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
