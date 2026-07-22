"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import type { Game } from "../../../lib/data";
import { useAuth } from "../../../lib/AuthProvider";
import AsteroidesGame, {
  type AsteroidesGameHandle,
} from "../../asteroides/AsteroidesGame";
import type { EngineSnapshot } from "../../../lib/games/asteroides/engine";
const DEMO_SCORE = 12450;
const DEMO_LIVES = 3;
const DEMO_LEVEL = 1;
export default function GamePlayerClient({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useAuth();
  const isAsteroides = game.id === "asteroides";
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const engineHandleRef = useRef<AsteroidesGameHandle>(null);
  const score = isAsteroides ? (snapshot?.score ?? 0) : DEMO_SCORE;
  const lives = isAsteroides ? (snapshot?.lives ?? DEMO_LIVES) : DEMO_LIVES;
  const level = isAsteroides ? (snapshot?.level ?? DEMO_LEVEL) : DEMO_LEVEL;
  const playerLabel = user ? user.username : "INVITADO";
  const modalOpen = over || (isAsteroides && snapshot?.state === "gameover");
  const endGame = () => setOver(true);
  const restart = () => {
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (isAsteroides) engineHandleRef.current?.reset();
  };
  const saveScore = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("scores").upsert(
        {
          user_id: user.id,
          game_id: game.id,
          player_name: user.username,
          score,
        },
        { onConflict: "user_id,game_id" },
      );
      if (error) throw error;
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {playerLabel}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim()}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            className="btn yellow"
            onClick={() =>
              setPaused((p) => {
                const next = !p;
                if (isAsteroides) {
                  if (next) engineHandleRef.current?.pause();
                  else engineHandleRef.current?.resume();
                }
                return next;
              })
            }
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          {!isAsteroides && (
            <button className="btn magenta" onClick={endGame}>
              FIN
            </button>
          )}
          <Link href={`/juego/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>
      <div className="crt">
        <div className="crt-screen">
          {isAsteroides ? (
            <AsteroidesGame ref={engineHandleRef} onSnapshot={setSnapshot} />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
      {modalOpen && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              user ? (
                <div className="input-row">
                  <button
                    className="btn yellow"
                    onClick={saveScore}
                    disabled={saving}
                  >
                    {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
              ) : (
                <div className="login-prompt">
                  INICIÁ SESIÓN PARA GUARDAR TU PUNTUACIÓN{" "}
                  <Link href="/login">INICIAR SESIÓN</Link>
                </div>
              )
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/games")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
