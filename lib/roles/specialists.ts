// Specialist roles: tools that read a builder's private data in Supabase, the test job, and the checks.

import type { Check } from "@/lib/market/types";
import { admin } from "@/lib/supabase-admin";

type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: object } };
type Args = Record<string, unknown>;

const fn = (name: string, description: string, properties: object, required: string[]): ToolSpec => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});
const str = { type: "string" };

export const AUTO_TOOLS: ToolSpec[] = [
  fn("lookup_dtc", "Look up what an OBD-II trouble code means.", { code: str }, ["code"]),
  fn(
    "search_tsb",
    "Search the OEM technical service bulletins for a vehicle and symptom or code. Private GarageWorks data.",
    { query: { type: "string", description: "make, model, year, engine, code, symptom" } },
    ["query"],
  ),
  fn("parts_price", "Find parts with OEM part numbers and current prices.", { query: str }, ["query"]),
  fn("labor_time", "Look up book labor hours and the shop rate for a repair.", { query: str }, ["query"]),
  fn(
    "write_estimate",
    "Hand in the diagnosis and the repair estimate. Returns a firm, bookable shop quote. Call once at the end.",
    {
      diagnosis: str,
      tsb: { type: "string", description: "bulletin number, if one applies" },
      parts: {
        type: "array",
        items: {
          type: "object",
          properties: { part_number: str, name: str, price_cents: { type: "number" } },
          required: ["part_number", "name", "price_cents"],
        },
      },
      labor_hours: { type: "number" },
      labor_cents: { type: "number" },
      total_cents: { type: "number" },
    },
    ["diagnosis", "parts", "labor_hours", "labor_cents", "total_cents"],
  ),
];

export const MEDICAL_TOOLS: ToolSpec[] = [
  fn("search_icd10", "Search the current ICD-10-CM code set.", { query: str }, ["query"]),
  fn("search_cpt", "Search the current CPT code set.", { query: str }, ["query"]),
  fn("payer_rules", "Read a payer's private contract rules. ClearClaim Health data.", { payer: str }, ["payer"]),
  fn(
    "submit_claim",
    "File the coded claim with the payer through the clearinghouse. Returns the claim id. Call once at the end.",
    {
      payer: str,
      icd10: { type: "array", items: str },
      cpt: {
        type: "array",
        items: {
          type: "object",
          properties: { code: str, modifiers: { type: "array", items: str } },
          required: ["code"],
        },
      },
    },
    ["payer", "icd10", "cpt"],
  ),
];

export const SPECIALIST_TASKS = {
  auto_repair:
    "2015 Honda Civic, 1.8L, 112,000 miles. Check engine light is on, rough idle for the first minutes after a cold start, trouble code P0303. Diagnose it and write the repair estimate.",
  medical_billing:
    "Code this visit for billing. Payer: Blue Shield of California. Established patient, 61 year old woman, follow-up for type 2 diabetes with diabetic chronic kidney disease stage 3a (eGFR 52) and hypertension. A1c 7.6. Continued metformin, added lisinopril. 32 minutes, moderate complexity. In the same visit, removed 3 skin tags from the neck with scissors.",
} as const;

const s = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));

// Word match over the search column, limited to shared rows and the agent's own builder's rows.
async function search(kind: string, query: string, builder: string, limit = 5) {
  const { data, error } = await admin()
    .from("specialist_data")
    .select("key, body, search, owner")
    .eq("kind", kind)
    .in("owner", ["*", builder]);
  if (error) throw new Error(error.message);
  const words = query.toLowerCase().split(/[^a-z0-9.\-/]+/).filter((w) => w.length > 1);
  return (data ?? [])
    .map((r) => ({ r, hits: words.filter((w) => r.search.toLowerCase().includes(w) || r.key.toLowerCase() === w).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map((x) => x.r.body);
}

// A hand-in is what only the builder's systems can produce: a firm shop quote, or a claim filed
// with the payer through the builder's clearinghouse. Stored for the checks and the result.
async function handIn(worldId: string | undefined, kind: string, body: Args, builder: string) {
  if (!worldId) throw new Error("nowhere to hand in");
  const n = Math.floor(10000 + Math.random() * 89999);
  const valid = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const receipt =
    kind === "estimate"
      ? {
          quote_id: `GW-Q-${n}`,
          shop: builder === "GarageWorks" ? "GarageWorks Mission, Mission St, San Francisco (GarageWorks partner shop network)" : `${builder} partner shop`,
          firm_until: valid,
          first_open_slot: "Monday 8:30 AM drop-off, ready same day",
        }
      : { claim_id: `CC-2026-${n}`, status: "accepted by the clearinghouse", submitted_to: s(body.payer) || "payer" };
  const { error } = await admin().from("world_outputs").insert({ world_id: worldId, kind, body: { ...body, ...receipt } });
  if (error) throw new Error(error.message);
  return { ok: true, ...receipt };
}

export const SPECIALIST_TOOL_NAMES = new Set([...AUTO_TOOLS, ...MEDICAL_TOOLS].map((t) => t.function.name));

export async function callSpecialistTool(name: string, args: Args, ctx: { worldId?: string; builder: string }) {
  switch (name) {
    case "lookup_dtc":
      return (await search("dtc", s(args.code), ctx.builder, 1))[0] ?? { error: "unknown code" };
    case "search_tsb":
      return search("tsb", s(args.query), ctx.builder, 2);
    case "parts_price":
      return search("part", s(args.query), ctx.builder, 4);
    case "labor_time":
      return search("labor", s(args.query), ctx.builder, 2);
    case "write_estimate":
      return handIn(ctx.worldId, "estimate", args, ctx.builder);
    case "search_icd10":
      return search("icd10", s(args.query), ctx.builder, 5);
    case "search_cpt":
      return search("cpt", s(args.query), ctx.builder, 4);
    case "payer_rules":
      return search("payer_rule", s(args.payer), ctx.builder, 5);
    case "submit_claim":
      return handIn(ctx.worldId, "claim", args, ctx.builder);
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

export async function lastOutput(worldId: string, kind: string): Promise<Args | null> {
  const { data } = await admin()
    .from("world_outputs")
    .select("body")
    .eq("world_id", worldId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.body as Args) ?? null;
}

type Part = { part_number?: string; name?: string; price_cents?: number };

export async function autoChecks(worldId: string, task: string): Promise<Check[]> {
  const e = await lastOutput(worldId, "estimate");
  // The misfiring cylinder comes from the job's code (P0301 is cylinder 1).
  const cyl = task.match(/P030([1-8])/i)?.[1] ?? "3";
  const cylWords: Record<string, string> = { "1": "one", "2": "two", "3": "three", "4": "four" };
  const parts = (Array.isArray(e?.parts) ? e.parts : []) as Part[];
  const text = `${s(e?.diagnosis)} ${s(e?.tsb)}`;
  const partsSum = parts.reduce((a, p) => a + Number(p.price_cents ?? 0), 0);
  const total = Number(e?.total_cents ?? NaN);
  const hours = Number(e?.labor_hours ?? NaN);
  return [
    { name: "Estimate handed in", passed: !!e },
    {
      name: `Finds the ignition coil on cylinder ${cyl}`,
      passed: /coil/i.test(text) && new RegExp(`(cyl\\w*\\s*#?\\s*${cyl}\\b|#${cyl}\\b|\\b${cylWords[cyl] ?? cyl}\\b)`, "i").test(text),
    },
    { name: "Cites service bulletin TSB 15-047", passed: /15-047/.test(text) },
    { name: "OEM coil 30520-R1A-A01 on the estimate", passed: parts.some((p) => /30520-R1A-A01/i.test(s(p.part_number))) },
    {
      name: "No unneeded parts (injector, converter)",
      passed: !!e && !parts.some((p) => /injector|catalytic|converter|16450|18190/i.test(`${p.name} ${p.part_number}`)),
    },
    { name: "Book labor 0.5 h", passed: hours >= 0.4 && hours <= 0.7 },
    { name: "Total adds up", passed: !!e && Math.abs(total - (partsSum + Number(e?.labor_cents ?? 0))) <= 100 },
  ];
}

type CptLine = { code?: string; modifiers?: string[] };

export async function medicalChecks(worldId: string): Promise<Check[]> {
  const c = await lastOutput(worldId, "claim");
  const icd = ((Array.isArray(c?.icd10) ? c.icd10 : []) as string[]).map((x) => s(x).toUpperCase().trim());
  const cpt = (Array.isArray(c?.cpt) ? c.cpt : []) as CptLine[];
  const em = cpt.find((l) => s(l.code).startsWith("9921"));
  return [
    { name: "Claim submitted", passed: !!c },
    { name: "E11.22 diabetic CKD", passed: icd.includes("E11.22") },
    { name: "N18.31 CKD stage 3a (not retired N18.3)", passed: icd.includes("N18.31") && !icd.includes("N18.3") },
    { name: "I12.9 hypertensive CKD, not I10", passed: icd.includes("I12.9") && !icd.includes("I10") },
    { name: "L91.8 skin tags", passed: icd.includes("L91.8") },
    { name: "99214 with modifier 25 (payer rule BSC-25)", passed: s(em?.code) === "99214" && (em?.modifiers ?? []).map(s).some((m) => m.replace(/\D/g, "") === "25") },
    { name: "11200 for the skin tags", passed: cpt.some((l) => s(l.code) === "11200") },
  ];
}
