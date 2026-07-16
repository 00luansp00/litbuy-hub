import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function RecoveryCodesDisplay({
  recoveryCodes,
  title,
  onClose,
  closing,
  onClipboardReset,
}: {
  recoveryCodes: string[];
  title: string;
  onClose: () => void;
  closing?: boolean;
  onClipboardReset?: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [clipboardState, setClipboardState] = useState("");
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const resetClipboard = () => {
    setClipboardState("");
    onClipboardReset?.();
  };
  const copy = async () => {
    resetClipboard();
    try {
      if (!navigator.clipboard?.writeText) {
        if (mountedRef.current) setClipboardState("Clipboard indisponível neste navegador.");
        return;
      }
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      if (mountedRef.current) setClipboardState("Códigos copiados.");
    } catch {
      if (mountedRef.current) setClipboardState("Não foi possível copiar os códigos.");
    }
  };
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">
        Esta é a única exibição. Guarde exatamente estes códigos antes de fechar.
      </p>
      <ul className="grid gap-2 rounded-2xl border p-4 font-mono text-sm">
        {recoveryCodes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Button type="button" variant="outline" onClick={() => void copy()} disabled={closing}>
        Copiar todos
      </Button>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {clipboardState}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={closing}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />{" "}
        Confirmei que guardei meus códigos
      </label>
      <Button type="button" disabled={!acknowledged || closing} onClick={onClose}>
        {closing ? "Verificando status..." : "Fechar recovery codes"}
      </Button>
    </div>
  );
}
