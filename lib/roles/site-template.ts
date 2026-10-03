// The site Ines (Studio North) delivers for the Select Coffee demo: one standalone HTML document.

export const SITE_PALETTE: string[] = ["#1E120C", "#F3EADC", "#C2502D", "#E9A23B", "#5D7356"];

export const SITE_FONTS = { display: "Bricolage Grotesque", body: "DM Sans" };

const IMG = "https://gqpsujsmjuuqfkvfklmr.supabase.co/storage/v1/object/public/media/select-coffee/";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MENU_BAR: [string, string, string][] = [
  ["Cafe de olla", "", "5.50"],
  ["Oaxaca pour over", "", "6.50"],
  ["Horchata latte", "", "6.00"],
  ["Carajillo tonic", "Mezcal free.", "7.00"],
  ["Espresso", "", "4.50"],
  ["Pan dulce", "", "4.00"],
];

const MENU_SHELF: [string, string, string][] = [
  ["Sierra Sur beans", "12 oz bag.", "22.00"],
  ["Pluma Hidalgo natural", "12 oz bag.", "22.00"],
];

function rows(items: [string, string, string][]): string {
  return items
    .map(
      ([n, d, p]) =>
        `<li class="row"><div><h4>${n}</h4>${d ? `<p>${d}</p>` : ""}</div><span class="dots" aria-hidden="true"></span><span class="price">$${p}</span></li>`
    )
    .join("");
}

const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const BEAN = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><ellipse cx="16" cy="16" rx="10" ry="13.5" transform="rotate(28 16 16)" fill="currentColor"/><path d="M11.2 5.6c4.6 4 1.2 9.6 4.4 13.4 2 2.4 3.6 4.8 3.4 7.6" stroke="#1E120C" stroke-width="2" stroke-linecap="round"/></svg>`;

export function selectSite(name: string = "Select Coffee"): string {
  const clean = name.trim() || "Select Coffee";
  const full = esc(clean);
  const words = clean.split(/\s+/);
  const mark = esc(words[0]);
  const rest = esc(words.slice(1).join(" "));
  // The wordmark fills the hero width whatever the name's length.
  const wordVw = Math.min(21, 118 / Math.max(words[0].length, 4)).toFixed(2);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${full}</title>
<meta name="description" content="${full}: coffee from Oaxaca's Sierra Sur, on 24th Street in the Mission District.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="${IMG}hero.jpg">
<style>
:root{--esp:#1E120C;--esp2:#2B1A12;--crema:#F3EADC;--paper:#FBF6EE;--terra:#C2502D;--terra-d:#A23F20;--mari:#E9A23B;--agave:#5D7356;--soft:#6A5243;--line:rgba(30,18,12,.14);
--d:"Bricolage Grotesque",ui-sans-serif,sans-serif;--b:"DM Sans",ui-sans-serif,sans-serif;--ease:cubic-bezier(.16,1,.3,1);--g:clamp(18px,4vw,56px)}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scrollbar-color:var(--terra) var(--crema)}
body{background:var(--crema);color:var(--esp);font:400 17px/1.6 var(--b);font-optical-sizing:auto;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::selection{background:var(--mari);color:var(--esp)}
a{color:inherit}
:focus-visible{outline:2px solid var(--mari);outline-offset:3px;border-radius:4px}
img{display:block;width:100%;height:100%;object-fit:cover}
h1,h2,h3,h4{font-family:var(--d);font-optical-sizing:auto;text-wrap:balance}
.wrap{max-width:1360px;margin:0 auto;padding:0 var(--g)}
.btn{display:inline-flex;align-items:center;gap:.6em;font:600 16px/1 var(--b);text-decoration:none;background:var(--terra);color:#fff;padding:1em 1.45em;border-radius:999px;min-height:48px;transition:background .3s var(--ease),transform .3s var(--ease)}
.btn:hover{background:var(--terra-d);transform:translateY(-2px)}
.btn svg{width:18px;height:18px;transition:transform .3s var(--ease)}
.btn:hover svg{transform:translateX(3px)}
.btn.light{background:var(--paper);color:var(--esp)}
.btn.light:hover{background:#fff}
/* hero */
.hero{position:relative;height:100svh;min-height:640px;max-height:1000px;color:var(--paper);background:#5A2E1B;overflow:hidden;isolation:isolate;display:grid;grid-template-rows:auto 1fr auto}
.hero .ph{position:absolute;inset:0;z-index:-2;animation:settle 2.2s var(--ease) both}
.hero .ph img{object-position:62% 50%}
.hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(20,11,7,.55) 0%,rgba(20,11,7,0) 20%),linear-gradient(90deg,rgba(20,11,7,.72) 0%,rgba(20,11,7,.25) 48%,rgba(20,11,7,0) 72%),linear-gradient(0deg,rgba(20,11,7,.86) 0%,rgba(20,11,7,.2) 36%,rgba(20,11,7,0) 52%)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:24px;height:76px;padding:0 var(--g)}
.logo{display:flex;align-items:center;gap:10px;font:700 21px/1 var(--d);letter-spacing:-.03em;text-decoration:none}
.logo svg{width:24px;height:24px;color:var(--mari)}
.links{display:flex;align-items:center;gap:30px;font-weight:500;font-size:15px}
.links a:not(.btn){text-decoration:none;opacity:.85;transition:opacity .2s}
.links a:not(.btn):hover{opacity:1;text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1.5px}
.links .btn{min-height:42px;padding:.75em 1.2em;font-size:15px}
.lead{align-self:center;padding:0 var(--g);max-width:640px;animation:fade 1.1s .35s var(--ease) both}
.lead h1{font-weight:650;font-size:clamp(2.1rem,4.3vw,3.6rem);line-height:1.02;letter-spacing:-.035em}
.lead h1 em{font-style:normal;color:var(--mari)}
.lead p{margin-top:20px;max-width:40ch;font-size:clamp(16px,1.3vw,18px);line-height:1.55;color:rgba(251,246,238,.86)}
.lead .cta{display:flex;align-items:center;gap:22px;margin-top:30px;flex-wrap:wrap}
.open{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:500;color:rgba(251,246,238,.92)}
.open i{width:8px;height:8px;border-radius:50%;background:#8FD08A;box-shadow:0 0 0 4px rgba(143,208,138,.22)}
.base{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:0 var(--g) clamp(18px,3vh,30px)}
.word{font:800 ${wordVw}vw/.78 var(--d);letter-spacing:-.055em;margin-left:-.04em;display:flex;align-items:flex-end;gap:.12em;animation:rise 1.4s .1s var(--ease) both}
.word small{font:600 clamp(15px,1.5vw,21px)/1.2 var(--b);letter-spacing:0;padding-bottom:.5em;color:var(--mari)}
.today{flex:none;width:clamp(240px,24vw,300px);background:var(--paper);color:var(--esp);border-radius:14px;padding:18px 20px 20px;box-shadow:0 24px 50px -24px rgba(0,0,0,.6);animation:fade 1.1s .7s var(--ease) both;margin-bottom:clamp(4px,1vw,14px)}
.today .t{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--soft);padding-bottom:12px;border-bottom:1px solid var(--line)}
.today .t b{color:var(--agave);font-weight:600}
.today .d{display:flex;gap:14px;align-items:center;padding:14px 0}
.today .d img{width:58px;height:58px;border-radius:10px;flex:none}
.today h3{font-weight:650;font-size:19px;letter-spacing:-.02em;line-height:1.15}
.today .d p{font-size:13.5px;color:var(--soft);line-height:1.35;margin-top:2px}
.today .btn{width:100%;justify-content:center;font-size:15px}
/* strip */
.strip{background:var(--terra);color:var(--paper);overflow:hidden;white-space:nowrap;padding:16px 0;font:600 clamp(17px,1.6vw,22px)/1 var(--d);letter-spacing:-.01em}
.strip div{display:inline-flex;gap:28px;padding-right:28px;animation:slide 38s linear infinite}
.strip span{display:inline-flex;align-items:center;gap:28px}
.strip span::after{content:"";width:7px;height:7px;border-radius:50%;background:var(--mari)}
/* story */
section{padding:clamp(80px,11vw,152px) 0}
.say{font:600 clamp(1.9rem,4.2vw,3.7rem)/1.08 var(--d);letter-spacing:-.035em;max-width:22ch}
.say .pill{display:inline-block;vertical-align:middle;width:1.9em;height:.92em;border-radius:999px;overflow:hidden;margin:0 .08em;transform:translateY(-.06em)}
.say em{font-style:normal;color:var(--terra)}
.story .grid2{display:grid;grid-template-columns:7fr 5fr;gap:clamp(36px,6vw,96px);margin-top:clamp(56px,7vw,96px);align-items:end}
.farm{aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:#7C8466}
.story .txt p{font-size:clamp(17px,1.35vw,19px);color:var(--soft);max-width:42ch}
.story .txt p+p{margin-top:16px}
.facts{list-style:none;margin-top:36px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;border-top:1px solid var(--line);padding-top:22px}
.facts b{display:block;font:700 clamp(22px,2.2vw,30px)/1 var(--d);letter-spacing:-.03em;color:var(--terra)}
.facts span{display:block;margin-top:6px;font-size:14px;color:var(--soft);line-height:1.35}
/* menu */
.menu{background:var(--esp);color:var(--paper)}
.menu .top{display:grid;grid-template-columns:7fr 5fr;gap:clamp(36px,6vw,96px);align-items:end}
.h2{font-weight:700;font-size:clamp(2.4rem,5.4vw,4.8rem);line-height:.95;letter-spacing:-.04em}
.menu .top p{color:rgba(243,234,220,.72);max-width:38ch}
.cols{display:grid;grid-template-columns:7fr 5fr;gap:clamp(36px,6vw,96px);margin-top:clamp(44px,6vw,80px)}
.cols h3{font:600 13px/1 var(--b);letter-spacing:.14em;text-transform:uppercase;color:var(--mari);padding-bottom:16px;border-bottom:1px solid rgba(243,234,220,.22)}
.list{list-style:none}
.row{display:flex;align-items:baseline;gap:14px;padding:20px 0;border-bottom:1px solid rgba(243,234,220,.12)}
.row>div{flex:0 1 auto;max-width:72%}
.row h4{font-weight:600;font-size:clamp(20px,1.9vw,25px);letter-spacing:-.02em;line-height:1.15}
.row p{font-size:15px;color:rgba(243,234,220,.66);margin-top:4px;line-height:1.45}
.dots{flex:1;align-self:flex-start;margin-top:.9em;border-bottom:1px dashed rgba(243,234,220,.22);min-width:20px}
.price{font:600 20px/1 var(--d);font-variant-numeric:tabular-nums;align-self:flex-start;margin-top:.2em;transition:color .3s}
.row:hover .price{color:var(--mari)}
.shelf .pour{aspect-ratio:4/3;border-radius:14px;overflow:hidden;margin-top:28px;background:#6B4330}
.note{margin-top:18px;font-size:14px;color:rgba(243,234,220,.62)}
/* band */
.band{padding:clamp(10px,1.2vw,16px);background:var(--crema)}
.grid{display:grid;grid-template-columns:5fr 4fr 3fr;grid-template-rows:1fr 1fr;height:clamp(520px,52vw,820px);gap:clamp(10px,1.2vw,16px)}
.grid figure{border-radius:14px;overflow:hidden;background:#B67A52}
.g-int{grid-row:1/3}
.g-cher{grid-column:2/4}
.g-con{background:#D9A770!important}
.g-word{display:flex;flex-direction:column;justify-content:space-between;padding:clamp(18px,2vw,30px);background:var(--agave);color:var(--paper);border-radius:14px}
.g-word b{font:700 clamp(1.7rem,2.6vw,2.6rem)/1 var(--d);letter-spacing:-.035em}
.g-word p{font-size:15px;max-width:28ch;color:rgba(251,246,238,.9);line-height:1.45}
.grid img{transition:transform 1.4s var(--ease)}
.grid figure:hover img{transform:scale(1.03)}
/* visit */
.visit .wrap{display:grid;grid-template-columns:7fr 5fr;gap:clamp(36px,6vw,96px);align-items:end}
.visit .h2{font-size:clamp(2.5rem,5.8vw,5.2rem)}
.visit .h2 em{font-style:normal;color:var(--terra)}
.visit .lede{margin-top:22px;font-size:clamp(17px,1.35vw,19px);color:var(--soft);max-width:40ch}
.visit .btn{margin-top:32px;font-size:17px}
.hours{list-style:none;font-variant-numeric:tabular-nums}
.hours li{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--line);font-size:17px}
.hours li span:last-child{font-weight:600}
.addr{margin-top:26px;font-size:17px;line-height:1.55}
.addr a{color:var(--terra);font-weight:600;text-underline-offset:4px}
footer{background:var(--esp);color:rgba(243,234,220,.72);padding:clamp(48px,6vw,80px) 0 28px;overflow:hidden}
footer .big{font:800 ${wordVw}vw/.8 var(--d);letter-spacing:-.055em;color:var(--paper);margin-left:-.04em}
footer .meta{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:28px;font-size:14px;border-top:1px solid rgba(243,234,220,.16);padding-top:20px}
/* motion */
@keyframes rise{from{transform:translateY(40%);opacity:0;filter:blur(10px)}to{transform:none;opacity:1;filter:none}}
@keyframes fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes settle{from{opacity:0;transform:scale(1.07);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
@keyframes slide{to{transform:translateX(-100%)}}
.js .rv{opacity:0;transform:translateY(26px);transition:opacity 1s var(--ease),transform 1.1s var(--ease)}
.js .rv.in{opacity:1;transform:none}
.js figure.rv{transform:translateY(18px) scale(.985);clip-path:inset(8% 0 0 0 round 14px);transition:opacity 1.1s var(--ease),transform 1.3s var(--ease),clip-path 1.3s var(--ease)}
.js figure.rv.in{transform:none;clip-path:inset(0 0 0 0 round 14px)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.js .rv{opacity:1;transform:none;clip-path:none}html{scroll-behavior:auto}}
/* responsive */
@media (max-width:900px){
.links a:not(.btn){display:none}
.story .grid2,.menu .top,.cols,.visit .wrap{grid-template-columns:1fr}
.grid{grid-template-columns:1fr 1fr;grid-template-rows:none;height:auto}
.g-int{grid-row:auto;grid-column:1/3;aspect-ratio:4/3}
.g-cher{grid-column:1/3;aspect-ratio:16/9}
.g-con{aspect-ratio:1}
}
@media (max-width:640px){
.hero{height:auto;min-height:100svh;max-height:none}
.nav{height:66px}
.links .btn{display:none}
.hero::after{background:linear-gradient(180deg,rgba(20,11,7,.55) 0%,rgba(20,11,7,.15) 30%,rgba(20,11,7,.55) 60%,rgba(20,11,7,.9) 100%)}
.lead{align-self:end;padding-bottom:20px}
.base{flex-direction:column;align-items:stretch;gap:20px}
.word{font-size:${Math.min(Number(wordVw) * 1.15, 24).toFixed(2)}vw}
.today{width:100%;margin:0}
.facts{gap:12px}
.grid{grid-template-columns:1fr}
.g-int,.g-cher{grid-column:auto}
.row>div{max-width:78%}
}
</style>
</head>
<body>
<main id="top">
<section class="hero" style="padding:0" aria-label="${full}">
<div class="ph"><img src="${IMG}hero.jpg" alt="A cup of cafe de olla on a terracotta counter in morning light"></div>
<header class="nav">
<a class="logo" href="#top" aria-label="${full} home">${BEAN}${full}</a>
<nav class="links" aria-label="Main"><a href="#story">Our coffee</a><a href="#menu">Menu</a><a href="#visit">Visit</a><a class="btn light" href="#visit">Order ahead</a></nav>
</header>
<div class="lead">
<h1>Oaxacan coffee, roasted a few blocks away, <em>poured on 24th Street.</em></h1>
<p>Beans from three family farms in Oaxaca's Sierra Sur, shade grown at 1,400 m near Pluma Hidalgo. Order ahead from your phone and pick up at the window.</p>
<div class="cta"><a class="btn" href="#visit">Order ahead ${ARROW}</a><span class="open"><i></i>Mon to Fri 7am to 5pm, Sat and Sun 8am to 4pm</span></div>
</div>
<div class="base">
<div class="word" aria-hidden="true">${mark}${rest ? `<small>${rest}</small>` : ""}</div>
<aside class="today" aria-label="Order the house special">
<div class="t"><span>Order ahead</span><b>Pick up at the window</b></div>
<div class="d"><img src="${IMG}hero.jpg" alt="" style="object-position:45% 60%"><div><h3>Cafe de olla</h3><p>$5.50, no app needed.</p></div></div>
<a class="btn" href="#menu">Order a cafe de olla ${ARROW}</a>
</aside>
</div>
</section>
<div class="strip" aria-hidden="true"><div><span>Cafe de olla</span><span>Oaxaca pour over</span><span>Horchata latte</span><span>Carajillo tonic</span><span>Pan dulce</span><span>Beans to take home</span></div><div><span>Cafe de olla</span><span>Oaxaca pour over</span><span>Horchata latte</span><span>Carajillo tonic</span><span>Pan dulce</span><span>Beans to take home</span></div></div>
<section class="story" id="story"><div class="wrap">
<h2 class="say rv">Shade grown at 1,400 m <span class="pill"><img src="${IMG}cherries.jpg" alt=""></span> near Pluma Hidalgo, roasted in 12 kg batches, and poured <em>in the Mission.</em></h2>
<div class="grid2">
<figure class="farm rv"><img src="${IMG}farm.jpg" alt="Misty coffee farm in the mountains of Oaxaca" loading="lazy"></figure>
<div class="txt rv">
<p>Our beans come from three family farms in Oaxaca's Sierra Sur, near Pluma Hidalgo, where the coffee grows in the shade at 1,400 m.</p>
<p>We roast them a few blocks from the shop, 12 kg at a time. Harvest runs November to February.</p>
<ul class="facts"><li><b>3</b><span>family farms in the Sierra Sur</span></li><li><b>1,400 m</b><span>shade grown</span></li><li><b>12 kg</b><span>per roast</span></li></ul>
</div>
</div>
</div></section>
<section class="menu" id="menu"><div class="wrap">
<div class="top rv"><h2 class="h2">The menu</h2><p>Oat, almond and whole milk at no extra cost.</p></div>
<div class="cols">
<div class="rv"><h3>At the bar</h3><ul class="list">${rows(MENU_BAR)}</ul></div>
<div class="rv shelf"><h3>To take home</h3><ul class="list">${rows(MENU_SHELF)}</ul><figure class="pour"><img src="${IMG}pour.jpg" alt="A barista's hands making a pour over" loading="lazy"></figure><p class="note">Order ahead and we will have it ready at the window.</p></div>
</div>
</div></section>
<section class="band" aria-label="Inside ${full}"><div class="grid">
<figure class="g-int rv"><img src="${IMG}interior.jpg" alt="The cafe interior with papel picado and plants in morning light" loading="lazy"></figure>
<figure class="g-cher rv"><img src="${IMG}cherries.jpg" alt="Ripe red coffee cherries on the branch" loading="lazy"></figure>
<figure class="g-con rv"><img src="${IMG}concha.jpg" alt="A tray of fresh conchas" loading="lazy"></figure>
<div class="g-word rv"><b>Harvest runs November to February.</b><p>Three family farms in Oaxaca's Sierra Sur, roasted a few blocks away.</p></div>
</div></section>
<section class="visit" id="visit"><div class="wrap">
<div class="rv">
<h2 class="h2">Come by, or <em>order ahead</em> and skip the line.</h2>
<p class="lede">Order from your phone and pick it up at the window on 24th Street. No app needed.</p>
<a class="btn" href="#visit">Start an order ${ARROW}</a>
</div>
<div class="rv">
<ul class="hours"><li><span>Monday to Friday</span><span>7am to 5pm</span></li><li><span>Saturday and Sunday</span><span>8am to 4pm</span></li></ul>
<p class="addr">${full}<br>24th Street, Mission District<br>San Francisco, California<br><a href="https://maps.google.com/?q=24th+Street+Mission+District+San+Francisco">Get directions</a></p>
</div>
</div></section>
</main>
<footer><div class="wrap">
<div class="big" aria-hidden="true">${mark}</div>
<div class="meta"><span>&copy; ${full}, 24th Street, San Francisco</span><span>Designed by Ines, Studio North. Hired by Claude Code on Blast.</span></div>
</div></footer>
<script>
(function(){var d=document.documentElement;if(!("IntersectionObserver" in window))return;d.classList.add("js");
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px",threshold:.08});
document.querySelectorAll(".rv").forEach(function(el){el.style.transitionDelay=(Array.prototype.indexOf.call(el.parentNode.children,el)%3*90)+"ms";io.observe(el)})})();
</script>
</body>
</html>`;
}
