import { getGames } from "../lib/data";
import GamesLibrary from "./GamesLibrary";
export default async function Library() {
  const games = await getGames();
  return <GamesLibrary games={games} />;
}
