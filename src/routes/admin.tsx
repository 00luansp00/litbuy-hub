import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/admin/AdminGate";

/**
 * Layout do Painel Administrativo. O AdminGate protege visualmente todas
 * as subrotas /admin/*; os endpoints mantêm a autorização real no backend.
 */
export const Route = createFileRoute("/admin")({
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  return (
    <AdminGate>
      <Outlet />
    </AdminGate>
  );
}
