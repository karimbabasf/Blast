import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// A fixed set of agent colours, so a screen full of agents never looks random.
const COLORS = ["#7f5e3c", "#ce383d", "#ed712e", "#f19d38", "#43975d", "#49a393", "#3472d9", "#ce3d86", "#777777"];

// The same agent always gets the same colour. The seed was picked so the agents of one role differ.
function colorOf(id: string) {
  let h = 6910;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return COLORS[h % COLORS.length];
}

const SIZES = {
  xs: { box: "size-6" },
  sm: { box: "size-8" },
  md: { box: "size-10" },
  lg: { box: "size-12" },
};

export function AgentAvatar({
  card,
  size = "md",
  status,
  verified,
  className,
}: {
  card: { id: string; name: string };
  size?: keyof typeof SIZES;
  status?: "working";
  verified?: boolean;
  className?: string;
}) {
  const s = SIZES[size];

  return (
    <span
      role="img"
      aria-label={card.name}
      title={card.name}
      style={{ backgroundColor: colorOf(card.id) }}
      className={cn(
        "relative inline-flex shrink-0 rounded-full",
        s.box,
        className,
      )}
    >
      {status === "working" && (
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 size-2.5 animate-pulse rounded-full bg-muted-foreground ring-2 ring-card"
        />
      )}
      {verified && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-success text-white ring-2 ring-card"
        >
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      )}
    </span>
  );
}

export function EmptyAvatar({ size = "sm" }: { size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 rounded-full border border-dashed border-foreground/20",
        SIZES[size].box,
      )}
    />
  );
}
