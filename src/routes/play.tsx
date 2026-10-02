import { createFileRoute } from "@tanstack/react-router";
import { RooftopRunner } from "@/components/rooftop-runner";

export const Route = createFileRoute("/play")({
  component: PlayPage,
});

function PlayPage() {
  return <RooftopRunner />;
}
