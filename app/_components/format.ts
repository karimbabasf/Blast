const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function money(cents: number) {
  return usd.format(cents / 100);
}

export const SKILL_LABEL = { script: "Script", voice: "Voice" } as const;
