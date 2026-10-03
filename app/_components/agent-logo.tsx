"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Dithering } from "@paper-design/shaders-react";

// Shader logos for the agents (Paper shaders, Apache-2.0). Every agent gets
// the same dithered sphere in its own colour.

// Twelve hues picked by eye to look different from each other, with no
// purple. Evenly spaced hues do not work: a third of the wheel reads as green.
const HUES = [0, 18, 32, 46, 58, 84, 135, 165, 186, 204, 224, 330];

// One hue per agent. Neighbours in the list are five steps apart, so agents
// that sit next to each other never look alike.
function agentHue(index: number) {
  return HUES[(index * 5) % HUES.length];
}

// ---- a tiny store of the finished logo images, keyed by agent id

let images: ReadonlyMap<string, string> = new Map();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getImages = () => images;

export function useAgentLogo(id: string) {
  return useSyncExternalStore(subscribe, getImages, getImages).get(id);
}

// Draws one logo off to the side, saves it as an image, then goes away.
function Tile({ id, hue }: { id: string; hue: number }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const canvas = box.current?.querySelector("canvas");
      const gl = canvas?.getContext("webgl2");
      if (!canvas || !gl) return;
      const pixel = new Uint8Array(4);
      gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      // Alpha stays 0 until the shader has drawn its first frame. Shaders
      // pause while the tab is hidden, so keep waiting rather than save a blank.
      if (pixel[3] === 0) return;
      window.clearInterval(timer);
      images = new Map(images).set(id, canvas.toDataURL("image/png"));
      listeners.forEach((listener) => listener());
    }, 80);
    return () => window.clearInterval(timer);
  }, [id]);

  return (
    <div ref={box} className="size-16">
      <Dithering
        width="100%"
        height="100%"
        speed={0}
        colorBack="#000000"
        colorFront={`hsl(${hue}, 95%, 56%)`}
        shape="sphere"
        type="4x4"
        size={2}
        scale={1}
        webGlContextAttributes={{ preserveDrawingBuffer: true }}
      />
    </div>
  );
}

const BATCH = 6;

// Browsers allow only a few live WebGL canvases per page, and the same agent
// shows up in several places. So each logo is drawn once here, a few at a
// time, and every avatar on the page shows the saved image.
export function LogoFactory({ ids }: { ids: string[] }) {
  const done = useSyncExternalStore(subscribe, getImages, getImages);
  const missing = ids.filter((id) => !done.has(id)).slice(0, BATCH);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-0 bottom-0 -z-10 flex opacity-0"
    >
      {missing.map((id) => (
        <Tile key={id} id={id} hue={agentHue(ids.indexOf(id))} />
      ))}
    </div>
  );
}
