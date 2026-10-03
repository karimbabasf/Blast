// Scripted specialists: roles whose tryouts replay a fixed run (steps, checks, the finished work) so the
// demo is instant and the same every time. Web design is the first.

import type { Check, Role } from "@/lib/market/types";

type ScriptStep = { name: string; input: unknown; output: unknown };
export type Script = { steps: ScriptStep[]; checks: Check[]; judge: number; reason: string; reply: string; cost_usd: number };

export const SCRIPTED_ROLES = new Set<Role>(["web_design"]);

const PALETTE = ["#2B1D14", "#F4EBDD", "#C65D3B", "#6E8B74", "#E0A84F"];

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
  const quoted = job.match(/"([^"]{2,40})"/)?.[1];
  const named = job.match(/\b(?:called|named|for)\s+((?:[A-Z][\w'&-]*\s?){1,3})/)?.[1]?.trim();
  return quoted ?? (named && !/^(My|A|An|The|Our)$/.test(named) ? named : "Select Coffee");
}

const SCRIPTS: Record<string, (job: string) => Script> = {
  "design-ines": (job) => {
    const name = businessName(job);
    return {
      steps: [
        { name: "read_brief", input: { job: job.slice(0, 120) }, output: { business: name, goal: "landing page", must_have: ["menu", "hours", "order ahead"] } },
        { name: "pick_palette", input: { mood: "warm, Oaxacan, modern" }, output: { palette: PALETTE, source: "Studio North brand library, 12,000 palettes" } },
        { name: "pick_type", input: { voice: "confident, friendly" }, output: { display: "Plus Jakarta Sans 800", body: "DM Sans", license: "OFL, free for web" } },
        { name: "art_direct_photos", input: { shots: ["hero cup", "pour over", "farm", "cherries", "pan dulce", "interior"] }, output: { photos: 6, license: "made for this brand", hosted: "Supabase Storage" } },
        { name: "compose_layout", input: { sections: ["hero", "story", "menu", "photos", "visit"] }, output: { grid: "12 columns", breakpoints: [375, 768, 1280] } },
        { name: "check_contrast", input: { pairs: 8 }, output: { passed: 8, lowest: "7.4:1, AAA" } },
        { name: "publish_site", input: { format: "one HTML file" }, output: { status: "live", url: "blast /d/<hire>" } },
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
      { name: "compose_layout", input: { template: "cafe-03" }, output: { sections: ["hero", "menu"] } },
      { name: "deliver_design", input: { format: "one HTML file" }, output: { bytes: 3100, status: "delivered" } },
    ],
    checks: DESIGN_CHECKS([true, true, false, false, true, true]),
    judge: 6.0,
    reason: "Failed: Menu, hours and an order button; Text contrast AA or better. Judges 6.0/10: generic template, no hours, tan on white buttons at 2.1:1.",
    reply: "Delivered a landing page from template cafe-03.",
    cost_usd: 0.0061,
  }),
  "design-generalist": (job) => ({
    steps: [{ name: "deliver_design", input: { format: "one HTML file", note: job.slice(0, 60) }, output: { bytes: 2200, status: "delivered" } }],
    checks: DESIGN_CHECKS([true, true, false, false, false, false]),
    judge: 4.5,
    reason: "Failed: Menu, hours and an order button; Text contrast AA or better; Works on a phone (375 px); Fonts licensed for the web. Judges 4.5/10: plain page, fixed 1200 px width, a paid font with no license.",
    reply: "Here is a simple landing page.",
    cost_usd: 0.0034,
  }),
};

export function scriptFor(agentId: string, job: string): Script | null {
  return SCRIPTS[agentId]?.(job) ?? null;
}

export function designPage(job: string) {
  const name = businessName(job);
  const [espresso, crema, terracotta, agave, gold] = PALETTE;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:${crema};color:${espresso};-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}nav{display:flex;justify-content:space-between;align-items:center;padding:22px 0}
.logo{font-family:'Plus Jakarta Sans';font-weight:800;font-size:20px;letter-spacing:-.02em}.logo span{color:${terracotta}}
nav a{color:${espresso};text-decoration:none;margin-left:24px;font-weight:500;font-size:15px}
.btn{display:inline-block;background:${espresso};color:${crema};padding:14px 22px;border-radius:999px;font-weight:700;text-decoration:none;font-size:15px}
.btn.alt{background:transparent;color:${espresso};box-shadow:inset 0 0 0 2px ${espresso}}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;padding:56px 0 72px}
h1{font-family:'Plus Jakarta Sans';font-weight:800;font-size:clamp(44px,7vw,84px);line-height:.95;letter-spacing:-.04em}
h1 em{font-style:normal;color:${terracotta}}.lead{font-size:19px;line-height:1.55;margin:22px 0 30px;max-width:30ch;opacity:.86}
.cup{aspect-ratio:1;border-radius:36px;background:radial-gradient(circle at 50% 42%,${espresso} 0 27%,#4a3022 28% 31%,${crema} 32% 34%,transparent 35%),linear-gradient(160deg,${gold},${terracotta});box-shadow:0 30px 60px -20px rgba(43,29,20,.45);position:relative}
.cup:after{content:'Oaxaca, single origin';position:absolute;left:20px;bottom:20px;background:${crema};padding:8px 14px;border-radius:999px;font-weight:700;font-size:13px}
.band{background:${espresso};color:${crema};padding:72px 0}h2{font-family:'Plus Jakarta Sans';font-weight:800;font-size:40px;letter-spacing:-.03em;margin-bottom:28px}
.menu{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.item{background:rgba(244,235,221,.07);border-radius:20px;padding:22px}
.item b{display:block;font-size:18px;margin-bottom:6px}.item p{opacity:.75;font-size:14px;line-height:1.5}.price{color:${gold};font-weight:700;margin-top:14px;display:block}
.story{display:grid;grid-template-columns:1fr 1fr;gap:48px;padding:80px 0;align-items:center}.story p{font-size:18px;line-height:1.65;opacity:.88}
.tag{display:inline-block;background:${agave};color:${crema};padding:6px 12px;border-radius:999px;font-size:13px;font-weight:700;margin-bottom:16px}
.visit{background:${terracotta};color:${crema};border-radius:32px;padding:48px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;margin-bottom:64px}
.visit p{font-size:17px;line-height:1.6}.visit .btn{background:${crema};color:${espresso}}footer{padding:28px 0 40px;font-size:14px;opacity:.7}
@media(max-width:768px){.hero,.story,.visit{grid-template-columns:1fr}.menu{grid-template-columns:1fr 1fr}nav a:not(.btn){display:none}}
</style></head><body>
<div class="wrap"><nav><div class="logo">${name.split(" ")[0]}<span>.</span></div><div><a href="#menu">Menu</a><a href="#story">Story</a><a class="btn" href="#visit">Order ahead</a></div></nav>
<section class="hero"><div><h1>Coffee from <em>Oaxaca</em>, poured in the Mission.</h1><p class="lead">${name} roasts single origin beans from the Sierra Sur every Tuesday. Order ahead and skip the line.</p><a class="btn" href="#visit">Order ahead</a> <a class="btn alt" href="#menu">See the menu</a></div><div class="cup" role="img" aria-label="A cup of coffee"></div></section></div>
<section class="band" id="menu"><div class="wrap"><h2>The menu</h2><div class="menu">
<div class="item"><b>Cafe de olla</b><p>Piloncillo, cinnamon, slow brewed in clay.</p><span class="price">$4.50</span></div>
<div class="item"><b>Oaxaca pour over</b><p>Pluma Hidalgo, stone fruit and cocoa.</p><span class="price">$5.25</span></div>
<div class="item"><b>Horchata latte</b><p>House horchata, double shot, oat on request.</p><span class="price">$6.00</span></div>
<div class="item"><b>Concha</b><p>Baked at 6 am by Panaderia Luna.</p><span class="price">$3.75</span></div>
</div></div></section>
<div class="wrap"><section class="story" id="story"><div><span class="tag">Since 2019</span><h2>Two families, one roaster.</h2></div><p>We buy straight from three farms near Pluma Hidalgo and pay above fair trade. Every bag on the shelf names the farmer who grew it.</p></section>
<section class="visit" id="visit"><div><h2>Visit us</h2><p>24th St, San Francisco. Mon to Fri 7 to 5, weekends 8 to 4.</p></div><a class="btn" href="#">Order ahead</a></section>
<footer>${name}. Designed by Ines, Studio North, hired on Blast.</footer></div></body></html>`;
  return { title: `${name} landing page`, palette: PALETTE, fonts: { display: "Plus Jakarta Sans", body: "DM Sans" }, html };
}
