import { useState } from "react";
import { Paperclip, Send, Smile } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { moderateText } from "@/utils/moderation";

interface MessageComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

/**
 * MessageComposer — envio de mensagem privada (mockado).
 * Aplica censura visual anti-poaching antes de enviar o texto.
 */
export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const mod = moderateText(value);
    if (mod.removed) {
      toast.warning("Contato externo removido", {
        description: "Sua mensagem foi enviada sem os dados de contato.",
      });
    }
    onSend(mod.sanitized);
    setText("");
  };

  const notImplemented = (label: string) =>
    toast("Em breve", {
      description: `${label} será liberado quando o chat real for implementado.`,
    });

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-card/60 p-3 md:p-4"
      aria-label="Composer de mensagem"
    >
      <div className="flex items-end gap-2">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => notImplemented("Anexos")}
            aria-label="Anexar arquivo"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => notImplemented("Emojis")}
            aria-label="Inserir emoji"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva sua mensagem..."
          rows={1}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          className="min-h-[40px] max-h-32 resize-none flex-1"
        />
        <Button type="submit" disabled={disabled || !text.trim()} size="icon">
          <Send className="h-4 w-4" />
          <span className="sr-only">Enviar</span>
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Mantenha a conversa dentro da LIT Buy. Tentativas de contato externo
        podem remover a proteção da compra. Envio em modo demonstração — nada é
        persistido.
      </p>
    </form>
  );
}
