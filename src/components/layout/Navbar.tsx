import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  Search,
  Menu,
  Heart,
  ShoppingCart,
  MessageSquare,
  LayoutGrid,
  X,
} from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { categories } from "@/data/categories";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UserMenu } from "./UserMenu";



const navLinks = [
  { to: "/", label: "Início" },
  { to: "/categoria/$slug", params: { slug: "contas" }, label: "Contas" },
  { to: "/categoria/$slug", params: { slug: "gift-cards" }, label: "Gift Cards" },
  { to: "/categoria/$slug", params: { slug: "servicos" }, label: "Serviços" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const { isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const submitSearch = (term: string) => {
    const q = term.trim();
    navigate({ to: "/buscar", search: q ? { q } : {} });
    setMobileOpen(false);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);



  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60"
          : "border-b border-transparent bg-background/40 backdrop-blur",
      )}
    >
      <div className="container-lit flex h-16 items-center gap-4">
        <div className="flex items-center gap-6">
          <Logo />
        </div>

        {/* Categories dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="hidden md:inline-flex gap-2">
              <LayoutGrid className="h-4 w-4" />
              Categorias
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {categories.map((c) => (
              <DropdownMenuItem key={c.id} asChild>
                <Link to="/categoria/$slug" params={{ slug: c.slug }}>
                  {c.name}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <form
          className="hidden md:flex relative flex-1 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch(searchQuery);
          }}
          role="search"
        >
          <button
            type="submit"
            aria-label="Buscar"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar produtos, jogos, categorias..."
            className="pl-9 bg-surface border-border focus-visible:ring-primary/40"
          />
        </form>


        {/* Nav links */}
        <nav className="hidden lg:flex items-center gap-1 ml-auto">
          {navLinks.map((l) => (
            <Button key={l.label} variant="ghost" size="sm" asChild>
              {"params" in l ? (
                <Link to={l.to} params={l.params}>
                  {l.label}
                </Link>
              ) : (
                <Link to={l.to}>{l.label}</Link>
              )}
            </Button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto lg:ml-2">
          <Button asChild variant="ghost" size="icon" aria-label="Favoritos" className="hidden sm:inline-flex">
            <Link to="/favoritos"><Heart className="h-5 w-5" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Mensagens" className="hidden sm:inline-flex">
            <Link to="/mensagens"><MessageSquare className="h-5 w-5" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Carrinho" className="relative">
            <Link to="/carrinho">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-primary border-0">
                  {itemCount > 99 ? "99+" : itemCount}
                </Badge>
              )}
            </Link>
          </Button>

          {isAuthenticated ? (
            <div className="hidden md:flex items-center ml-2">
              <UserMenu />
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1 ml-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/cadastro">Criar conta</Link>
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container-lit py-4 space-y-4">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(mobileSearchQuery);
              }}
              role="search"
            >
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
              <Input
                type="search"
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 bg-surface"
              />
            </form>

            <div className="grid grid-cols-2 gap-2">
              {categories.slice(0, 6).map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  size="sm"
                  asChild
                  onClick={() => setMobileOpen(false)}
                >
                  <Link to="/categoria/$slug" params={{ slug: c.slug }}>
                    {c.name}
                  </Link>
                </Button>
              ))}
            </div>
            {isAuthenticated ? (
              <div className="flex justify-center">
                <UserMenu />
              </div>
            ) : (
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link to="/cadastro">Criar conta</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
