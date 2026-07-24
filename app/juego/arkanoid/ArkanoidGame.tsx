"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createEngine,
  type ArkanoidEngine,
  type EngineSnapshot,
} from "../../lib/games/arkanoid/engine";
const PREVENT_DEFAULT_KEYS = new Set(["ArrowLeft", "ArrowRight"]);
export interface ArkanoidGameHandle {
  pause(): void;
  resume(): void;
  reset(): void;
}
interface ArkanoidGameProps {
  onSnapshot: (snapshot: EngineSnapshot) => void;
}
const ArkanoidGame = forwardRef<ArkanoidGameHandle, ArkanoidGameProps>(
  function ArkanoidGame({ onSnapshot }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ArkanoidEngine | null>(null);
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
        if (PREVENT_DEFAULT_KEYS.has(e.key)) e.preventDefault();
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
export default ArkanoidGame;
