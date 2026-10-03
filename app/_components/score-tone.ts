// Green for a strong score, amber for a middling one, red for a weak one.
export function scoreTone(score: number) {
  if (score >= 8) return "bg-success/10 text-success";
  if (score >= 5) return "bg-warning/15 text-warning";
  return "bg-destructive/10 text-destructive";
}
