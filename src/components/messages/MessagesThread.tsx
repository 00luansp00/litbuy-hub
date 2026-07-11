import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { ConversationMessage, ConversationParticipant } from "@/types";

interface MessagesThreadProps {
  messages: ConversationMessage[];
  currentUserId: string;
  counterpart: ConversationParticipant;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, yest)) return "Ontem";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function MessagesThread({
  messages,
  currentUserId,
  counterpart,
}: MessagesThreadProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  let lastDay: string | null = null;

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-6">
      {messages.map((m) => {
        const label = dayLabel(m.sentAt);
        const showDay = label !== lastDay;
        lastDay = label;
        return (
          <div key={m.id} className="space-y-2">
            {showDay && (
              <div className="my-3 flex items-center justify-center">
                <span className="rounded-full border border-border bg-surface/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </span>
              </div>
            )}
            <MessageBubble
              message={m}
              currentUserId={currentUserId}
              counterpart={counterpart}
            />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
