"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TabTrack } from "./tab-track";

const LINKS = [
  { id: "/", label: "Dashboard" },
  { id: "/hub", label: "Hub" },
];

export function Nav() {
  const path = usePathname();
  // The pressed tab wins until the new page is in, so the tile moves on the press.
  const [pressed, setPressed] = useState<{ href: string; from: string } | null>(null);
  const active = pressed && pressed.from === path ? pressed.href : path;

  return (
    <nav aria-label="Main" className="min-w-0 overflow-x-auto">
      <TabTrack items={LINKS} active={active}>
        {(item, className) => (
          <Link
            href={item.id}
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => setPressed({ href: item.id, from: path })}
            className={className}
          >
            {item.label}
          </Link>
        )}
      </TabTrack>
    </nav>
  );
}
