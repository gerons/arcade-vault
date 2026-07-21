"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createEngine,
  type AsteroidesEngine,
  type EngineSnapshot,
} from "../../lib/games/asteroides/engine";
const PREVENT_DEFAULT_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);
export interface AsteroidesGameHandle {
  pause(): void;
  resume(): void;
  reset(): void;
}
interface AsteroidesGameProps {
  onSnapshot: (snapshot: EngineSnapshot) => void;
}
const AsteroidesGame = forwardRef<AsteroidesGameHandle, AsteroidesGameProps>(
  function AsteroidesGame({ onSnapshot }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<AsteroidesEngine | null>(null);
    useImperativeHandle(ref, () => ({
      pause() {
        engineRef.current?.stop();
      },
      resume() {
        engineRef.current?.start();
      },
      reset() {
        engineRef.current?.reset();
      },
    }));
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const engine = createEngine(canvas);
      engineRef.current = engine;
      const unsubscribe = engine.onSnapshotChange(onSnapshot);
      onSnapshot(engine.getSnapshot());
      engine.start();
      const onKeyDown = (e: KeyboardEvent) => {
        if (PREVENT_DEFAULT_KEYS.has(e.code)) e.preventDefault();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        unsubscribe();
        engine.destroy();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          width: "100%",
          maxWidth: "100%",
          aspectRatio: "4 / 3",
          display: "block",
        }}
      />
    );
  },
);
export default AsteroidesGame;
