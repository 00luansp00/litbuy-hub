import { useEffect, useState } from "react";
import { MessageCircleQuestion, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { questionService } from "@/services/questionService";
import { moderateText } from "@/utils/moderation";
import type { ProductQuestion } from "@/types";

interface ProductQuestionsProps {
  productId: string;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

/**
 * ProductQuestions — perguntas públicas do anúncio.
 * Diferente das mensagens privadas (/mensagens/$id), aqui as perguntas
 * ajudam outros compradores. Tudo em memória / mockado.
 */
export function ProductQuestions({ productId }: ProductQuestionsProps) {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    questionService.getQuestionsByProductId(productId).then((list) => {
      if (!alive) return;
      setQuestions(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const mod = moderateText(value);
    if (mod.removed) {
      toast.warning("Contato externo removido", {
        description: "A pergunta foi publicada sem os dados de contato.",
      });
    } else {
      toast.success("Pergunta enviada em modo demonstração");
    }
    const q = await questionService.simulateAskQuestion(productId, value);
    setQuestions((prev) => [q, ...prev]);
    setText("");
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Perguntas do anúncio
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            público
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {questions.length} pergunta(s)
        </span>
      </header>

      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-[11px] text-warning">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Não compartilhe WhatsApp, Discord, Telegram, telefone, e-mail, links
            externos ou qualquer contato fora da LIT Buy. Tentativas de contato
            externo são censuradas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Faça uma pergunta pública sobre este anúncio..."
          rows={2}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!text.trim()}>
            <Send className="mr-2 h-3.5 w-3.5" /> Enviar pergunta
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-surface/40 p-4 text-center text-xs text-muted-foreground">
          Nenhuma pergunta ainda. Seja o primeiro a perguntar.
        </p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li
              key={q.id}
              className="rounded-xl border border-border bg-surface/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {q.authorName}
                    </span>{" "}
                    · {formatRelative(q.askedAt)}
                  </div>
                  <p className="mt-1 text-sm text-foreground">{q.text}</p>
                </div>
              </div>
              {q.answer ? (
                <div className="mt-2 rounded-lg border-l-2 border-primary/50 bg-background/40 p-2 pl-3">
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">
                      {q.answer.authorName}
                    </span>{" "}
                    · {formatRelative(q.answer.answeredAt)}
                  </div>
                  <p className="mt-0.5 text-sm text-foreground">
                    {q.answer.text}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[11px] italic text-muted-foreground">
                  Aguardando resposta do vendedor.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
