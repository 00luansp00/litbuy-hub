import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SellerGate } from "@/components/seller/SellerGate";

export const Route = createFileRoute("/vendedor")({
  component: () => (
    <SellerGate>
      <Outlet />
    </SellerGate>
  ),
});
