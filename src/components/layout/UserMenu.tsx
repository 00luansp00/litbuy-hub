import { Link } from "@tanstack/react-router";
import { LogOut, Heart, ShoppingBag, Wallet, MessageSquare, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/AuthProvider";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    toast.success("Você saiu da sua conta.");
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-semibold">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil"><UserCircle2 className="h-4 w-4" /> Meu perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/pedidos"><ShoppingBag className="h-4 w-4" /> Pedidos</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/favoritos"><Heart className="h-4 w-4" /> Favoritos</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/carteira"><Wallet className="h-4 w-4" /> Carteira</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/mensagens"><MessageSquare className="h-4 w-4" /> Mensagens</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
