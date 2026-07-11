import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/vendedor/anuncios")({
  component: () => <Outlet />,
});
