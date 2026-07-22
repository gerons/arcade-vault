import { getGames } from "./lib/data";
import HomeClient from "./HomeClient";
export default async function Home() {
  const games = await getGames();
  return <HomeClient games={games} />;
}
