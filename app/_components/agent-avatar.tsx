import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentLogo } from "./agent-logo";

const SIZES = {
  xs: { box: "size-6", icon: "size-3", text: "text-[0.625rem]" },
  sm: { box: "size-8", icon: "size-3.5", text: "text-xs" },
  md: { box: "size-10", icon: "size-4.5", text: "text-sm" },
  lg: { box: "size-12", icon: "size-5", text: "text-base" },
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
  const logo = useAgentLogo(card.id);
  const s = SIZES[size];

  return (
    <span
      role="img"
      aria-label={card.name}
      title={card.name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-foreground/10 transition-colors duration-200 ease-out",
        s.box,
        className,
      )}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- a generated data URL
        <img
          src={logo}
          alt=""
          width={64}
          height={64}
          className="absolute inset-0 size-full rounded-full object-cover"
        />
      ) : (
        <span aria-hidden="true" className={cn("font-semibold", s.text)}>
          {card.name.slice(0, 1)}
        </span>
      )}
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
