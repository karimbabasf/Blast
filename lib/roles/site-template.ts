// The site Ines (Studio North) delivers for the Select Coffee demo: one standalone HTML document.

export const SITE_PALETTE: string[] = ["#24160F", "#F5ECDF", "#B8482A", "#E9A23B", "#5D7356"];

export const SITE_FONTS = { display: "Bricolage Grotesque", body: "DM Sans" };

const IMG = "https://gqpsujsmjuuqfkvfklmr.supabase.co/storage/v1/object/public/media/xochitl/";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MENU_BAR: [string, string, string][] = [
  ["Cafe de olla", "Brewed in clay with piloncillo and canela. The one we are known for.", "5.50"],
  ["Oaxaca pour over", "Single origin from Pluma Hidalgo, poured to order.", "6.50"],
  ["Horchata latte", "House horchata, rice and cinnamon, over a double shot.", "6.00"],
  ["Carajillo tonic", "Cold brew, tonic, orange peel. Mezcal free, all morning.", "7.00"],
  ["Espresso", "Our Sierra Sur blend, short and sweet.", "4.50"],
];

const MENU_SHELF: [string, string, string][] = [
  ["Sierra Sur beans", "Whole bean, 12 oz, roasted in small batches.", "22.00"],
  ["Pluma Hidalgo natural", "Whole bean, 12 oz, dried on the farm patio.", "22.00"],
  ["Pan dulce", "Conchas and more from our neighbors on 24th, daily.", "4.00"],
];

function rows(items: [string, string, string][]): string {
  return items
    .map(
      ([n, d, p]) =>
        `<li class="row"><div><h4>${n}</h4><p>${d}</p></div><span class="price">$${p}</span></li>`
    )
    .join("");
}

export function xochitlSite(name: string = "Select Coffee"): string {
  const full = esc(name.trim() || "Select Coffee");
  const mark = esc((name.trim() || "Select").split(/\s+/)[0]);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${full}</title>
<meta name="description" content="${full}: specialty coffee from Oaxaca's Sierra Sur, on 24th Street in the Mission.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="${IMG}hero.jpg">
<style>
:root{--esp:#24160F;--esp2:#3A2419;--crema:#F5ECDF;--paper:#FBF6EE;--terra:#B8482A;--terra-d:#9C3B1F;--mari:#E9A23B;--agave:#5D7356;--ink-soft:#6B5446;--line:rgba(36,22,15,.14);
--d:"Bricolage Grotesque",ui-sans-serif,sans-serif;--b:"DM Sans",ui-sans-serif,sans-serif;--ease:cubic-bezier(.16,1,.3,1);--g:clamp(20px,5vw,72px)}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scrollbar-color:var(--terra) var(--crema)}
body{background:var(--crema);color:var(--esp);font:400 17px/1.6 var(--b);font-optical-sizing:auto;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::selection{background:var(--mari);color:var(--esp)}
a{color:inherit}
:focus-visible{outline:2px solid var(--mari);outline-offset:3px;border-radius:4px}
img{display:block;width:100%;height:100%;object-fit:cover}
h1,h2,h3,h4{font-family:var(--d);font-optical-sizing:auto;text-wrap:balance}
.wrap{max-width:1320px;margin:0 auto;padding:0 var(--g)}
.btn{display:inline-flex;align-items:center;gap:.6em;font:600 16px/1 var(--b);text-decoration:none;background:var(--terra);color:#fff;padding:1.05em 1.5em;border-radius:999px;transition:background .3s var(--ease),transform .3s var(--ease),box-shadow .3s var(--ease);box-shadow:0 8px 24px -10px rgba(184,72,42,.7)}
.btn:hover{background:var(--terra-d);transform:translateY(-2px);box-shadow:0 14px 30px -12px rgba(184,72,42,.8)}
.btn svg{width:18px;height:18px;transition:transform .3s var(--ease)}
.btn:hover svg{transform:translateX(3px)}
/* nav */
.nav{position:absolute;inset:0 0 auto;z-index:5;color:var(--paper)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:88px;max-width:none}
.mark{font:800 28px/1 var(--d);letter-spacing:-.04em;text-decoration:none;display:flex;align-items:center;gap:10px}
.mark svg{width:26px;height:26px;color:var(--mari)}
.links{display:flex;align-items:center;gap:34px;font-weight:500;font-size:15px}
.links a:not(.btn){text-decoration:none;opacity:.86;transition:opacity .2s}
.links a:not(.btn):hover{opacity:1;text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1.5px}
.nav .btn{padding:.85em 1.3em;font-size:15px}
/* hero */
.hero{position:relative;height:100svh;min-height:640px;max-height:1080px;color:var(--paper);background:#8C4A2C linear-gradient(160deg,#B8693F,#5A2E1B);overflow:hidden;isolation:isolate}
.hero .ph{position:absolute;inset:0;z-index:-2;animation:settle 2.4s var(--ease) both}
.hero .ph img{object-position:60% 55%}
.hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(28,15,9,.78) 0%,rgba(28,15,9,.42) 42%,rgba(28,15,9,0) 70%),linear-gradient(0deg,rgba(28,15,9,.72) 0%,rgba(28,15,9,0) 46%),linear-gradient(180deg,rgba(28,15,9,.45) 0%,rgba(28,15,9,0) 22%)}
.hero .wrap{position:absolute;inset:auto 0 0;max-width:none;padding-bottom:clamp(36px,6vh,72px)}
.hero h1{font-weight:750;font-size:clamp(3.1rem,7.6vw,6rem);line-height:.92;letter-spacing:-.032em;max-width:11ch}
.hero h1 .l{display:block;overflow:hidden;padding-bottom:.06em}
.hero h1 .l span{display:block;animation:rise 1.3s var(--ease) both}
.hero h1 .l:nth-child(2) span{animation-delay:.12s}
.hero h1 .l:nth-child(3) span{animation-delay:.24s}
.hero h1 em{font-style:normal;color:var(--mari)}
.hero-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:32px;margin-top:clamp(24px,4vh,40px);animation:fade 1.2s .55s var(--ease) both}
.hero-foot p{max-width:36ch;font-size:clamp(16px,1.35vw,19px);line-height:1.5;color:rgba(251,246,238,.88)}
.hero-cta{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
.open{display:inline-flex;align-items:center;gap:10px;font-size:14px;font-weight:500;letter-spacing:.01em;color:rgba(251,246,238,.9)}
.open i{width:8px;height:8px;border-radius:50%;background:#8FD08A;box-shadow:0 0 0 4px rgba(143,208,138,.22)}
/* origin */
section{padding:clamp(88px,12vw,168px) 0}
.origin .wrap{display:grid;grid-template-columns:5fr 7fr;gap:clamp(40px,6vw,96px);align-items:center}
.h2{font-weight:700;font-size:clamp(2.3rem,4.6vw,4rem);line-height:.98;letter-spacing:-.035em}
.lede{margin-top:28px;font-size:clamp(17px,1.4vw,19px);color:var(--ink-soft);max-width:44ch}
.lede+.lede{margin-top:16px}
.facts{list-style:none;margin-top:40px;display:grid;grid-template-columns:repeat(3,auto);gap:28px;justify-content:start;border-top:1px solid var(--line);padding-top:24px}
.facts b{display:block;font:700 26px/1 var(--d);letter-spacing:-.03em;color:var(--terra)}
.facts span{font-size:14px;color:var(--ink-soft)}
.pics{position:relative;padding-bottom:18%}
.pics .farm{aspect-ratio:16/10;border-radius:6px;overflow:hidden;background:#7C8466}
.pics .cher{position:absolute;width:42%;aspect-ratio:1;right:-4%;bottom:0;border-radius:6px;overflow:hidden;background:#9E2E1F;border:10px solid var(--crema);box-shadow:0 30px 60px -30px rgba(36,22,15,.5)}
.cap{position:absolute;left:0;bottom:0;font-size:14px;color:var(--ink-soft);max-width:26ch}
/* menu */
.menu{background:var(--esp);color:var(--paper)}
.menu .head{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;flex-wrap:wrap}
.menu .head p{color:rgba(245,236,223,.7);max-width:38ch}
.cols{display:grid;grid-template-columns:7fr 5fr;gap:clamp(40px,7vw,120px);margin-top:clamp(48px,6vw,80px)}
.cols h3{font:600 14px/1 var(--b);letter-spacing:.14em;text-transform:uppercase;color:var(--mari);padding-bottom:18px;border-bottom:1px solid rgba(245,236,223,.22)}
.list{list-style:none}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:22px 0;border-bottom:1px solid rgba(245,236,223,.12);transition:padding .4s var(--ease)}
.row:hover{padding-left:8px}
.row h4{font-weight:600;font-size:clamp(21px,2vw,26px);letter-spacing:-.02em;line-height:1.15}
.row p{font-size:15px;color:rgba(245,236,223,.66);margin-top:4px}
.price{font:600 20px/1 var(--d);font-variant-numeric:tabular-nums;color:var(--paper)}
.row:hover .price{color:var(--mari)}
.note{margin-top:28px;font-size:14px;color:rgba(245,236,223,.6)}
/* band */
.band{padding:clamp(12px,1.4vw,20px);background:var(--paper)}
.grid{display:grid;grid-template-columns:4fr 5fr 3fr;grid-template-rows:58% 1fr;height:clamp(560px,60vw,920px);gap:clamp(12px,1.4vw,20px)}
.grid figure{border-radius:6px;overflow:hidden;background:#B67A52}
.g-pour{grid-row:1/3}
.g-int{grid-column:2/4}
.g-con{background:#D9A770!important}
.g-word{display:flex;flex-direction:column;justify-content:space-between;padding:clamp(20px,2.4vw,36px);background:var(--terra);color:var(--paper);border-radius:6px}
.g-word b{font:750 clamp(2.4rem,4.4vw,4.4rem)/.9 var(--d);letter-spacing:-.04em}
.g-word p{font-size:15px;max-width:30ch;color:rgba(251,246,238,.9)}
.grid img{transition:transform 1.4s var(--ease)}
.grid figure:hover img{transform:scale(1.035)}
/* visit */
.visit .wrap{display:grid;grid-template-columns:7fr 5fr;gap:clamp(40px,7vw,120px);align-items:end}
.visit .h2{font-size:clamp(2.6rem,6vw,5.6rem);line-height:.92;letter-spacing:-.04em}
.visit .h2 em{font-style:normal;color:var(--terra)}
.visit .btn{margin-top:40px;font-size:17px}
.hours{list-style:none;font-variant-numeric:tabular-nums}
.hours li{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--line);font-size:17px}
.hours li span:last-child{font-weight:600}
.addr{margin-top:28px;font-size:17px;line-height:1.5}
.addr a{color:var(--terra);font-weight:600;text-underline-offset:4px}
footer{border-top:1px solid var(--line);padding:28px 0 36px;font-size:14px;color:var(--ink-soft)}
footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
/* motion */
@keyframes rise{from{transform:translateY(105%)}to{transform:none}}
@keyframes fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes settle{from{opacity:0;transform:scale(1.08);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
.js .rv{opacity:0;transform:translateY(28px);transition:opacity 1s var(--ease),transform 1.1s var(--ease)}
.js .rv.in{opacity:1;transform:none}
.js figure.rv{transform:translateY(20px) scale(.985);clip-path:inset(8% 0 0 0 round 6px);transition:opacity 1.1s var(--ease),transform 1.3s var(--ease),clip-path 1.3s var(--ease)}
.js figure.rv.in{transform:none;clip-path:inset(0 0 0 0 round 6px)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.js .rv{opacity:1;transform:none;clip-path:none}html{scroll-behavior:auto}}
/* responsive */
@media (max-width:900px){
.links a:not(.btn){display:none}
.origin .wrap,.cols,.visit .wrap{grid-template-columns:1fr}
.hero-foot{flex-direction:column;align-items:flex-start}
.grid{grid-template-columns:1fr 1fr;grid-template-rows:none;height:auto}
.g-con{aspect-ratio:1}
.g-int{aspect-ratio:16/9}
.g-pour{grid-row:auto;grid-column:1/3;aspect-ratio:4/4.4}
.g-int{grid-column:1/3}
}
@media (max-width:520px){
.nav .wrap{height:72px}
.mark{font-size:24px}
.hero{min-height:600px}
.hero::after{background:linear-gradient(0deg,rgba(28,15,9,.85) 0%,rgba(28,15,9,.35) 55%,rgba(28,15,9,.4) 100%)}
.hero h1{font-size:clamp(2.9rem,14vw,4rem)}
.facts{grid-template-columns:1fr 1fr 1fr;gap:16px}
.facts b{font-size:21px}
.pics .cher{border-width:6px}
.cap{display:none}
.pics{padding-bottom:22%}
.grid{grid-template-columns:1fr}
.g-pour,.g-int{grid-column:auto}
.g-int{aspect-ratio:4/3}
.row h4{font-size:20px}
}
</style>
</head>
<body>
<header class="nav"><div class="wrap">
<a class="mark" href="#top" aria-label="${full} home"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><ellipse cx="16" cy="16" rx="10" ry="13.5" transform="rotate(28 16 16)" fill="currentColor"/><path d="M11.2 5.6c4.6 4 1.2 9.6 4.4 13.4 2 2.4 3.6 4.8 3.4 7.6" stroke="#24160F" stroke-width="2" stroke-linecap="round"/></svg>${full}</a>
<nav class="links" aria-label="Main"><a href="#origin">Origin</a><a href="#menu">Menu</a><a href="#visit">Visit</a><a class="btn" href="#visit">Order ahead</a></nav>
</div></header>
<main id="top">
<section class="hero" style="padding:0" aria-label="${full}">
<div class="ph"><img src="${IMG}hero.jpg" alt="A cup of cafe de olla on a terracotta counter in morning light"></div>
<div class="wrap">
<h1><span class="l"><span>From the</span></span><span class="l"><span><em>Sierra Sur</em></span></span><span class="l"><span>to 24th Street.</span></span></h1>
<div class="hero-foot">
<p>Single origin coffee from small farms near Pluma Hidalgo, Oaxaca. Roasted in small batches, brewed in clay, poured in the Mission.</p>
<div class="hero-cta"><span class="open"><i></i>Open today, 7 to 5</span><a class="btn" href="#visit">Order ahead <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
</div>
</div>
</section>
<section class="origin" id="origin"><div class="wrap">
<div class="rv">
<h2 class="h2">Grown in the clouds above Pluma Hidalgo.</h2>
<p class="lede">Our beans come from a handful of family farms in Oaxaca's Sierra Sur, where coffee grows slowly under shade trees and morning fog. We buy from the same growers every harvest and pay them well above market.</p>
<p class="lede">Then we roast it a few blocks from the shop, in small batches, so every cup tastes like the mountain it came from: brown sugar, orange peel, cacao.</p>
<ul class="facts"><li><b>Oaxaca</b><span>Sierra Sur</span></li><li><b>Shade</b><span>grown, hand picked</span></li><li><b>Small</b><span>batch roasted</span></li></ul>
</div>
<div class="pics">
<figure class="farm rv"><img src="${IMG}farm.jpg" alt="Misty coffee farm in the mountains of Oaxaca" loading="lazy"></figure>
<figure class="cher rv"><img src="${IMG}cherries.jpg" alt="Ripe red coffee cherries on the branch" loading="lazy"></figure>
<p class="cap">Harvest season in the Sierra Sur, November to February.</p>
</div>
</div></section>
<section class="menu" id="menu"><div class="wrap">
<div class="head rv"><h2 class="h2">The menu</h2><p>Every drink starts with the same Oaxacan beans. Oat, almond and whole milk at no extra cost.</p></div>
<div class="cols">
<div class="rv"><h3>At the bar</h3><ul class="list">${rows(MENU_BAR)}</ul></div>
<div class="rv"><h3>To take home</h3><ul class="list">${rows(MENU_SHELF)}</ul><p class="note">Order ahead and we will have it ready at the window.</p></div>
</div>
</div></section>
<section class="band" aria-label="Inside ${full}"><div class="grid">
<figure class="g-pour rv"><img src="${IMG}pour.jpg" alt="A barista's hands making a pour over" loading="lazy"></figure>
<figure class="g-int rv"><img src="${IMG}interior.jpg" alt="The cafe interior with papel picado and plants in morning light" loading="lazy"></figure>
<figure class="g-con rv"><img src="${IMG}concha.jpg" alt="A tray of fresh conchas" loading="lazy"></figure>
<div class="g-word rv"><b>Select</b><p>Three farms, one roaster, picked lot by lot. We only pour the coffee we would choose for ourselves.</p></div>
</div></section>
<section class="visit" id="visit"><div class="wrap">
<div class="rv">
<h2 class="h2">Come by, or <em>order ahead</em> and skip the line.</h2>
<a class="btn" href="#visit">Order ahead <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
</div>
<div class="rv">
<ul class="hours"><li><span>Monday to Friday</span><span>7am to 5pm</span></li><li><span>Saturday and Sunday</span><span>8am to 4pm</span></li></ul>
<p class="addr">${full}<br>24th Street, Mission District<br>San Francisco, California<br><a href="https://maps.google.com/?q=24th+Street+Mission+District+San+Francisco">Get directions</a></p>
</div>
</div></section>
</main>
<footer><div class="wrap"><span>&copy; ${full}</span><span>Designed by Ines, Studio North. Hired by Claude Code on Blast.</span></div></footer>
<script>
(function(){var d=document.documentElement;if(!("IntersectionObserver" in window))return;d.classList.add("js");
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{rootMargin:"0px 0px -8% 0px",threshold:.08});
document.querySelectorAll(".rv").forEach(function(el,i){el.style.transitionDelay=(el.parentNode.children.length>1?Array.prototype.indexOf.call(el.parentNode.children,el)%3*90:0)+"ms";io.observe(el)})})();
</script>
</body>
</html>`;
}
