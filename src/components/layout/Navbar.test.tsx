import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "./Navbar";

vi.mock("@/providers/CartProvider", () => {
  throw new Error("Navbar must not import the legacy CartProvider");
});
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/providers/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock("@/components/notifications/NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notificações</button>,
}));

describe("Navbar", () => {
  it("keeps anonymous navigation and links to the real cart without a mock count", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Carrinho" }).getAttribute("href")).toBe("/carrinho");
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });
});
