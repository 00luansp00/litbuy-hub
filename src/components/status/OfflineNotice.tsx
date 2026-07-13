import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OfflineNotice — banner discreto (Sprint 18.20).
 * Detecta navigator.onLine e eventos online/offline. Nenhuma fila offline,
 * nenhum service worker, nenhuma persistência.
 */
export function OfflineNotice() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState<boolean>(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 3000);
      return () => clearTimeout(t);
    };
    const goOffline = () => {
      setOnline(false);
      setJustReconnected(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium shadow-md",
        online
          ? "bg-emerald-500/15 text-emerald-200"
          : "bg-warning/20 text-warning-foreground",
      )}
    >
      {online ? (
        <>
          <Wifi className="h-3.5 w-3.5" />
          <span>Conexão restaurada.</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>Você está offline. Algumas ações podem não funcionar.</span>
        </>
      )}
    </div>
  );
}
