import { getGames, getLeaderboard } from "../lib/data";
import HallOfFameTabs from "./HallOfFameTabs";
export default async function HallOfFame() {
  const games = await getGames();
  const initialGameId = games[0]?.id ?? "";
  const initialScores = initialGameId
    ? await getLeaderboard(initialGameId, 12)
    : [];
  return (
    <HallOfFameTabs
      games={games}
      initialGameId={initialGameId}
      initialScores={initialScores}
    />
  );
}
