"use client";

import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const round =
  "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-50";

// Record, send to /api/transcribe, hand the words back. Press again to stop.
export function MicButton({ onText, onError }: { onText: (text: string) => void; onError: (message: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "busy">("idle");
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("busy");
        try {
          const blob = new Blob(chunks, { type: rec.mimeType });
          const res = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": blob.type }, body: blob });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Could not hear that. Try again.");
          if (data.text) onText(data.text);
          else onError("Heard nothing. Hold the mic closer and try again.");
        } catch (err) {
          onError(err instanceof Error ? err.message : "Could not hear that. Try again.");
        } finally {
          setState("idle");
        }
      };
      recorder.current = rec;
      rec.start();
      setState("recording");
    } catch {
      onError("Allow the microphone in the browser to speak your request.");
    }
  }

  return (
    <button
      type="button"
      disabled={state === "busy"}
      aria-pressed={state === "recording"}
      aria-label={state === "recording" ? "Stop Recording" : "Speak Your Request"}
      onClick={() => (state === "recording" ? recorder.current?.stop() : void start())}
      className={`${round} size-9 ${
        state === "recording" ? "animate-pulse bg-destructive text-white" : "bg-muted text-foreground hover:bg-secondary"
      }`}
    >
      {state === "busy" ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : state === "recording" ? (
        <Square aria-hidden="true" className="size-3.5 fill-current" />
      ) : (
        <Mic aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

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
