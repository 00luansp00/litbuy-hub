import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mensagens/$id")({ component: ConversationLegacyRedirect });

function ConversationLegacyRedirect() {
  return <Navigate to="/mensagens" replace />;
}
