import { createFileRoute } from "@tanstack/react-router";
import { Booth } from "@/components/secretary/Booth";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Booth />;
}
