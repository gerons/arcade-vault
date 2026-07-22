import { notFound } from "next/navigation";
import { getGame } from "../../../lib/data";
import GamePlayerClient from "./GamePlayerClient";
export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();
  return <GamePlayerClient game={game} />;
}
