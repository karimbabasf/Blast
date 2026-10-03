// A fixed set of agent colours, so a screen full of agents never looks random.
const COLORS = ["#7f5e3c", "#ce383d", "#ed712e", "#f19d38", "#43975d", "#49a393", "#3472d9", "#ce3d86", "#777777"];

// The same agent always gets the same colour. The seed was picked so the agents of one role differ.
function colorOf(id: string) {
  let h = 6910;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return COLORS[h % COLORS.length];
}

// The agent's colour as a plain disc: the one thing that tells agents apart at a glance.
export function AgentDot({ id, className = "size-8" }: { id: string; className?: string }) {
  return <span aria-hidden="true" style={{ backgroundColor: colorOf(id) }} className={`inline-block shrink-0 rounded-full ${className}`} />;
}
