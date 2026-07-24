"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createEngine,
  type TetrisEngine,
  type EngineSnapshot,
} from "../../lib/games/tetris/engine";
const PREVENT_DEFAULT_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "KeyX",
]);
export interface TetrisGameHandle {
  pause(): void;
  resume(): void;
  reset(): void;
}
interface TetrisGameProps {
  onSnapshot: (snapshot: EngineSnapshot) => void;
}
const TetrisGame = forwardRef<TetrisGameHandle, TetrisGameProps>(
  function TetrisGame({ onSnapshot }, ref) {
    const boardRef = useRef<HTMLCanvasElement>(null);
    const nextRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<TetrisEngine | null>(null);
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
      const boardCanvas = boardRef.current;
      const nextCanvas = nextRef.current;
      if (!boardCanvas || !nextCanvas) return;
      const engine = createEngine(boardCanvas, nextCanvas);
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
      <div className="tetris-stage">
        <canvas
          ref={boardRef}
          width={300}
          height={600}
          className="tetris-board"
        />
        <div className="tetris-next">
          <div className="tetris-next-label">SIGUIENTE</div>
          <canvas ref={nextRef} width={120} height={120} />
        </div>
      </div>
    );
  },
);
export default TetrisGame;
