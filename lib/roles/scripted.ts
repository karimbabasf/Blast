// Scripted specialists: roles whose tryouts replay a fixed run (steps, checks, the finished work) so the
// demo is instant and the same every time. Web design is the first.

import type { Check, Role } from "@/lib/market/types";
import { SITE_FONTS, SITE_PALETTE, selectSite } from "./site-template";

type ScriptStep = { name: string; input: unknown; output: unknown };
export type Script = { steps: ScriptStep[]; checks: Check[]; judge: number; reason: string; reply: string; cost_usd: number };

export const SCRIPTED_ROLES = new Set<Role>(["web_design"]);

const PALETTE = SITE_PALETTE;

const DESIGN_CHECKS = (passed: boolean[]): Check[] =>
  [
    "Delivered as one working HTML file",
    "Uses the business name and voice",
    "Menu, hours and an order button",
    "Text contrast AA or better",
    "Works on a phone (375 px)",
    "Fonts licensed for the web",
  ].map((name, i) => ({ name, passed: passed[i] }));

export function businessName(job: string): string {
  if (/select coffee/i.test(job)) return "Select Coffee";
  const named = job.match(/\b(?:called|named)\s+((?:[A-Z][\w'&-]*\s?){1,3})/)?.[1]?.trim();
  return named && !/^(My|A|An|The|Our)$/.test(named) ? named : "Select Coffee";
}

const SCRIPTS: Record<string, (job: string) => Script> = {
  "design-ines": (job) => {
    const name = businessName(job);
    return {
      steps: [
        { name: "read_brief", input: { job: job.slice(0, 120) }, output: { business: name, goal: "landing page", must_have: ["menu", "hours", "order ahead"] } },
        { name: "study_street", input: { place: "24th St, Mission District" }, output: { neighbors: "bakeries, taquerias, murals", feel: "warm, loud, early mornings" } },
        { name: "pick_palette", input: { mood: "warm, Oaxacan, modern" }, output: { palette: PALETTE, source: "Studio North brand library, 12,000 palettes" } },
        { name: "pick_type", input: { voice: "confident, friendly" }, output: { display: SITE_FONTS.display, body: SITE_FONTS.body, license: "OFL, free for web" } },
        { name: "art_direct_photos", input: { shots: ["hero cup", "pour over", "farm", "cherries", "pan dulce", "interior"] }, output: { photos: 6, license: "made for this brand" } },
        { name: "compose_layout", input: { sections: ["hero", "story", "menu", "photos", "visit"] }, output: { grid: "12 columns", breakpoints: [375, 768, 1280] } },
        { name: "check_contrast", input: { pairs: 9 }, output: { passed: 9, lowest: "7.1:1, AAA" } },
        { name: "test_on_phone", input: { width: 375 }, output: { overflow: "none", tap_targets: "all 44 px or more" } },
      ],
      checks: DESIGN_CHECKS([true, true, true, true, true, true]),
      judge: 9.8,
      reason: "All checks passed. Judges 9.6/10: a warm, specific page with every section asked for; strong contrast and a clean phone layout.",
      reply: `Delivered a finished landing page for ${name}: warm palette, licensed type, menu, hours and an order button, AAA contrast, built for phones first.`,
      cost_usd: 0.0412,
    };
  },
  "design-tile": (job) => ({
    steps: [
      { name: "read_brief", input: { job: job.slice(0, 120) }, output: { business: businessName(job), goal: "landing page" } },
      { name: "pick_palette", input: { mood: "coffee" }, output: { palette: ["#6F4E37", "#FFFFFF", "#D2B48C"], source: "template set" } },
      { name: "load_template", input: { template: "cafe-03" }, output: { sections: ["hero", "menu"], photos: "stock" } },
      { name: "fill_template", input: { fields: ["name", "tagline", "menu"] }, output: { filled: 3, skipped: ["hours"] } },
      { name: "deliver_design", input: { format: "one HTML file" }, output: { bytes: 3100, status: "delivered" } },
    ],
    checks: DESIGN_CHECKS([true, true, false, false, true, true]),
    judge: 6.0,
    reason: "Failed: Menu, hours and an order button; Text contrast AA or better. Judges 6.0/10: generic template, no hours, tan on white buttons at 2.1:1.",
    reply: "Delivered a landing page from template cafe-03.",
    cost_usd: 0.0061,
  }),
  "design-generalist": (job) => ({
    steps: [
      { name: "read_brief", input: { job: job.slice(0, 120) }, output: { business: businessName(job) } },
      { name: "write_html", input: { width: "1200 px fixed" }, output: { sections: ["header", "text"], font: "Gotham, unlicensed" } },
      { name: "deliver_design", input: { format: "one HTML file", note: job.slice(0, 60) }, output: { bytes: 2200, status: "delivered" } },
    ],
    checks: DESIGN_CHECKS([true, true, false, false, false, false]),
    judge: 4.5,
    reason: "Failed: Menu, hours and an order button; Text contrast AA or better; Works on a phone (375 px); Fonts licensed for the web. Judges 4.5/10: plain page, fixed 1200 px width, a paid font with no license.",
    reply: "Here is a simple landing page.",
    cost_usd: 0.0034,
  }),
};

// What the hired designer does after the hire: builds and publishes the real site, shown on stage as the delivery.
export function deliveryFor(job: string): ScriptStep[] {
  const name = businessName(job);
  return [
    { name: "build_page", input: { phase: "delivery", sections: 5 }, output: { html: "one file, 0 dependencies", sections: ["hero", "story", "menu", "photos", "visit"] } },
    { name: "place_photos", input: { phase: "delivery", photos: 6 }, output: { hero: "cafe de olla, morning light", placed: 6 } },
    { name: "write_copy", input: { phase: "delivery", voice: "warm, specific" }, output: { headline: `${name}, from Oaxaca to 24th Street`, menu_items: 8 } },
    { name: "publish_site", input: { phase: "delivery", format: "one HTML file" }, output: { status: "live", url: "blast /d/<hire>" } },
  ];
}

export function scriptFor(agentId: string, job: string): Script | null {
  return SCRIPTS[agentId]?.(job) ?? null;
}

export function designPage(job: string) {
  const name = businessName(job);
  return { title: `${name} website`, palette: SITE_PALETTE, fonts: SITE_FONTS, html: selectSite(name) };
}
