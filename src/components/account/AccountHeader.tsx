import { motion } from "motion/react";
import { BadgeCheck, CalendarDays, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthContext";
import { cn } from "@/lib/utils";

interface AccountHeaderProps {
  memberSince?: string; // ISO date
  verified?: boolean;
  level?: string;
  className?: string;
}

/**
 * AccountHeader — header premium da área do usuário.
 * Dados do AuthProvider quando disponíveis + fallback mockado.
 */
export function AccountHeader({
  memberSince,
  verified = true,
  level = "LIT Prime",
  className,
}: AccountHeaderProps) {
  const { user } = useAuth();

  const name = user?.name ?? "Convidado LIT";
  const email = user?.email ?? "convidado@litbuy.app";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "LB";

  const handleEdit = () =>
    toast("Edição de perfil em breve", {
      description: "A edição de perfil será liberada em uma próxima sprint.",
    });

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32"
        style={{ backgroundImage: "var(--gradient-hero, var(--gradient-primary))", opacity: 0.15 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 40%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="flex items-center gap-4 md:gap-5">
          <Avatar className="h-16 w-16 border-4 border-card shadow-elegant md:h-20 md:w-20">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={name} />}
            <AvatarFallback
              className="text-lg font-semibold text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-primary)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {name}
              </h1>
              {verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verificado
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> {level}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
            {memberSince && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Membro desde{" "}
                {new Date(memberSince).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Pencil className="h-4 w-4" /> Editar perfil
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
