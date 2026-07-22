"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../lib/supabase/client";
import type { Game, ScoreRow } from "../lib/data";
import { useAuth } from "../lib/AuthProvider";
async function fetchLeaderboard(
  gameId: string,
  limit = 12,
): Promise<ScoreRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, updated_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
async function fetchOwnScore(
  gameId: string,
  userId: string,
): Promise<{ score: number; updated_at: string } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("score, updated_at")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export default function HallOfFameTabs({
  games,
  initialGameId,
  initialScores,
}: {
  games: Game[];
  initialGameId: string;
  initialScores: ScoreRow[];
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialGameId);
  const [rows, setRows] = useState<ScoreRow[]>(initialScores);
  const [youScore, setYouScore] = useState<{
    score: number;
    updated_at: string;
  } | null>(null);
  const game = games.find((g) => g.id === tab);
  useEffect(() => {
    if (tab === initialGameId) return;
    let cancelled = false;
    fetchLeaderboard(tab, 12).then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, initialGameId]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = user ? await fetchOwnScore(tab, user.id) : null;
      if (!cancelled) setYouScore(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, user]);
  if (!game) return null;
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>
      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            AÚN NO HAY PUNTUACIONES REGISTRADAS
          </div>
          <div>SÉ EL PRIMERO</div>
        </div>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].player_name}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[1].updated_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{rows[0].player_name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {rows[0].score.toLocaleString("es-ES")}
              </div>
              <div className="date">
                {new Date(rows[0].updated_at).toLocaleDateString("es-ES")}
              </div>
            </div>
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].player_name}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[2].updated_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
          </div>
          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.player_name + i}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.player_name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">
                  {new Date(r.updated_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            ))}
            {user && youScore && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    —
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user.username}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {youScore.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">
                    {new Date(youScore.updated_at).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
