// Brand marks from Simple Icons (CC0).
const PATHS = {
  supabase: "M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z",
  vercel: "M24 22.525H0l12-21.05 12 21.05z",
  stripe: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
  anthropic: "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z",
  openai: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
  googlegemini: "M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81",
};

// Each mark keeps its own brand colour: with the agent dots, the only colour on the page.
const COLOR: Record<Brand, string> = {
  supabase: "#3ECF8E",
  vercel: "currentColor",
  stripe: "#635BFF",
  anthropic: "#D97757",
  openai: "#10A37F",
  googlegemini: "#8E75B2",
};

const NAME: Record<Brand, string> = {
  supabase: "Supabase",
  vercel: "Vercel",
  stripe: "Stripe",
  anthropic: "Anthropic",
  openai: "OpenAI",
  googlegemini: "Google Gemini",
};

export type Brand = keyof typeof PATHS;

export function Logo({ brand, className = "size-4" }: { brand: Brand; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={NAME[brand]} className={className} fill={COLOR[brand]}>
      <path d={PATHS[brand]} />
    </svg>
  );
}

// "anthropic/claude-sonnet-5.5" -> anthropic. Labs reached through the AI Gateway.
export function labOf(model: string): Brand | null {
  const p = model.split("/")[0];
  return p === "anthropic" ? "anthropic" : p === "openai" ? "openai" : p === "google" ? "googlegemini" : null;
}

const MARK_CSS = `
.bm-hex { stroke-dasharray: 1; stroke-dashoffset: 1; fill-opacity: 0; animation: bm-draw 380ms ease-out forwards, bm-fill 220ms ease-out 380ms forwards; }
.bm-b { opacity: 0; animation: bm-fill 220ms ease-out 420ms forwards; }
.bm-live { animation: bm-breathe 2.4s ease-in-out infinite; }
@keyframes bm-draw { 99% { stroke-dashoffset: 0; stroke-dasharray: 1; } to { stroke-dashoffset: 0; stroke-dasharray: none; } }
@keyframes bm-fill { to { fill-opacity: 1; opacity: 1; } }
@keyframes bm-breathe { 0%, 100% { filter: drop-shadow(0 0 0 rgb(0 0 0 / 0)); } 50% { filter: drop-shadow(0 0 5px rgb(0 0 0 / 0.35)); } }
@media (prefers-reduced-motion: reduce) { .bm-hex, .bm-b { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; fill-opacity: 1; opacity: 1; } .bm-live { animation: none; } }
`;

// The Blast mark (public/brand/mark.svg): draws in on load, breathes while a hire runs. The dash is dropped
// once drawn, or the stroke's start and end leave a notch at the top corner.
export function BlastMark({ className = "size-6", live = false }: { className?: string; live?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Blast" className={`${className} ${live ? "bm-live" : ""}`}>
      <style>{MARK_CSS}</style>
      <polygon className="bm-hex" pathLength={1} points="50,10 84,30 84,70 50,90 16,70 16,30" fill="#000" stroke="#000" strokeWidth="12" strokeLinejoin="round" />
      <path
        className="bm-b"
        d="M55 54 L55 80 Q55 85.5 60 82.6 L79.5 71.2 Q84 68.5 84 63 L84 56 Q84 51.5 75.5 50.2 Q84 49 84 44 L84 38 Q84 32.5 79.5 35.2 L60 46.7 Q55 49.5 55 54 Z"
        fill="#fff"
      />
    </svg>
  );
}
