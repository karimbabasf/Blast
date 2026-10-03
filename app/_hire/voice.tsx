"use client";

import { Loader2, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const round =
  "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-50";

// Reads the text aloud through /api/speak. The audio is made once and replayed after that.
export function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "busy" | "playing">("idle");
  const [failed, setFailed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audio.current?.pause();
      if (audio.current) URL.revokeObjectURL(audio.current.src);
    },
    [],
  );

  async function toggle() {
    if (state === "playing") {
      audio.current?.pause();
      setState("idle");
      return;
    }
    setFailed(false);
    try {
      if (!audio.current) {
        setState("busy");
        const res = await fetch("/api/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
        if (!res.ok) throw new Error("speech failed");
        const el = new Audio(URL.createObjectURL(await res.blob()));
        el.onended = () => setState("idle");
        audio.current = el;
      }
      audio.current.currentTime = 0;
      await audio.current.play();
      setState("playing");
    } catch {
      setFailed(true);
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={state === "busy"}
      className={`${round} h-9 w-44 gap-2 bg-(--hire) text-sm font-medium text-white hover:bg-(--hire)/90`}
    >
      {state === "busy" ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : state === "playing" ? (
        <Square aria-hidden="true" className="size-3.5 fill-current" />
      ) : (
        <Volume2 aria-hidden="true" className="size-4" />
      )}
      <span aria-live="polite">{state === "busy" ? "Preparing…" : state === "playing" ? "Stop" : failed ? "Try Again" : "Hear the Result"}</span>
    </button>
  );
}
