import { createFileRoute } from "@tanstack/react-router";
import { AgentDesk } from "@/components/agent-desk";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <AgentDesk />;
}
