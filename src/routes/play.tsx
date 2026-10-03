import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/components/game/GameApp";

export const Route = createFileRoute("/play")({
  component: PlayPage,
});

function PlayPage() {
  return <GameApp />;
}

