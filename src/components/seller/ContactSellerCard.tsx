import { motion } from "motion/react";
import {
  Clock,
  MessageCircle,
  Share2,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Seller } from "@/types";

interface ContactSellerCardProps {
  seller: Seller;
  className?: string;
}

/**
 * ContactSellerCard — card lateral 100% visual.
 * Nenhuma ação real: os botões produzem apenas toast de feedback,
 * preparados para plug de backend em sprints futuras.
 */
export function ContactSellerCard({ seller, className }: ContactSellerCardProps) {
  const responseTime =
    seller.responseTime ?? seller.stats?.responseTime ?? "algumas horas";

  const handleMessage = () =>
    toast("Chat em breve", {
      description: "O chat com o vendedor será liberado em uma próxima sprint.",
    });

  const handleFollow = () =>
    toast(`Você seguiu ${seller.name}`, {
      description: "Você receberá novidades quando estiver logado (mock).",
    });

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    toast("Link copiado", {
      description: "O link do perfil foi copiado para a área de transferência.",
    });
  };

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card",
        className,
      )}
      aria-label="Contato com o vendedor"
    >
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Fale com {seller.name}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tempo médio de resposta:{" "}
          <span className="font-medium text-foreground">{responseTime}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" onClick={handleMessage}>
          <MessageCircle className="mr-2 h-4 w-4" /> Enviar mensagem
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={handleFollow}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Seguir vendedor
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" /> Compartilhar perfil
        </Button>
      </div>

      <Separator />

      <ul className="space-y-2.5 text-xs text-muted-foreground">
        <TrustRow icon={ShieldCheck} tone="text-success">
          Nunca combine pagamentos fora da plataforma. A LIT Buy só protege
          compras feitas por aqui.
        </TrustRow>
        <TrustRow icon={Wallet} tone="text-accent">
          Pagamento 100% protegido — o vendedor só recebe após a confirmação.
        </TrustRow>
        <TrustRow icon={Clock} tone="text-warning">
          Responde em média em {responseTime}.
        </TrustRow>
      </ul>
    </motion.aside>
  );
}

function TrustRow({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
      <span>{children}</span>
    </li>
  );
}
