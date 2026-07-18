import { Link, useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  Heart,
  ShoppingBag,
  Wallet,
  MessageSquare,
  UserCircle2,
  Store,
  LayoutDashboard,
  Package,
  PackagePlus,
  ExternalLink,
  ArrowLeftRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/AuthContext";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu() {
  const { user, logout, activeRole, switchToBuyer, switchToSeller, isAdmin, hasSellerAccess } =
    useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const isSeller = activeRole === "seller";

  const handleLogout = async () => {
    await logout();
    toast.success("Você saiu da sua conta.");
  };

  const handleSwitchToSeller = () => {
    const result = switchToSeller();
    if (!result.ok) {
      toast.info("Acesso de vendedor pendente", {
        description: "Sua conta ainda não possui acesso de vendedor.",
      });
      navigate({ to: "/perfil/vendedor" });
      return;
    }
    toast.success("Modo vendedor ativado", {
      description: "Você agora está navegando como vendedor.",
    });
    navigate({ to: "/vendedor" });
  };

  const handleSwitchToBuyer = () => {
    switchToBuyer();
    toast.success("Modo comprador ativado", {
      description: "Você voltou para a sua conta de comprador.",
    });
    navigate({ to: "/perfil" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 pl-1 pr-2 hover:bg-muted/60"
          aria-label="Menu do usuário"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback
              className="text-xs font-semibold text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline max-w-[120px] truncate text-sm font-medium">
            {user.name.split(" ")[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          <Badge variant="secondary" className="mt-1 w-fit gap-1 text-[10px] font-medium">
            {isSeller && hasSellerAccess ? (
              <>
                <Store className="h-3 w-3" /> Modo vendedor
              </>
            ) : (
              <>
                <UserCircle2 className="h-3 w-3" /> Modo comprador
              </>
            )}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isSeller && hasSellerAccess ? (
          <>
            <DropdownMenuItem asChild>
              <Link to="/vendedor">
                <LayoutDashboard className="h-4 w-4" /> Painel do vendedor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/vendedor/anuncios">
                <Package className="h-4 w-4" /> Meus anúncios
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/vendedor/anuncios/novo">
                <PackagePlus className="h-4 w-4" /> Criar anúncio
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/vendedor/vendas">
                <ShoppingBag className="h-4 w-4" /> Vendas
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/vendedor/financeiro">
                <Wallet className="h-4 w-4" /> Financeiro
              </Link>
            </DropdownMenuItem>
            {user.sellerSlug && (
              <DropdownMenuItem asChild>
                <Link to="/loja/$slug" params={{ slug: user.sellerSlug }}>
                  <ExternalLink className="h-4 w-4" /> Minha loja pública
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSwitchToBuyer}>
              <ArrowLeftRight className="h-4 w-4" /> Mudar para modo comprador
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to="/perfil">
                <UserCircle2 className="h-4 w-4" /> Meu perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/pedidos">
                <ShoppingBag className="h-4 w-4" /> Pedidos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/favoritos">
                <Heart className="h-4 w-4" /> Favoritos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/carteira">
                <Wallet className="h-4 w-4" /> Carteira
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/mensagens">
                <MessageSquare className="h-4 w-4" /> Mensagens
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSwitchToSeller}>
              <ArrowLeftRight className="h-4 w-4" />{" "}
              {hasSellerAccess ? "Mudar para modo vendedor" : "Quero vender"}
            </DropdownMenuItem>
          </>
        )}

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <ShieldCheck className="h-4 w-4" /> Painel administrativo
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
