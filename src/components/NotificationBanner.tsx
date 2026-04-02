import { useState, useEffect } from "react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribePush,
} from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";

export function NotificationBanner() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const perm = getNotificationPermission();
    setPermission(perm);

    if (perm === "granted" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
      );
    }
  }, []);

  if (!isNotificationSupported()) return null;

  const handleToggle = async () => {
    if (permission === "denied") return;
    setBusy(true);
    setLastError(null);

    try {
      if (subscribed) {
        const ok = await unsubscribePush(user!.id);
        if (ok) setSubscribed(false);
        else setLastError("Falha ao desativar. Veja o console.");
      } else {
        const granted = await requestNotificationPermission();
        setPermission(granted ? "granted" : "denied");
        if (granted && user?.id) {
          const ok = await subscribeToPush(user.id);
          if (ok) setSubscribed(true);
          else setLastError("Falha ao salvar inscrição. Veja o console.");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const isDenied = permission === "denied";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border shadow-sm">
        <span className="text-sm font-medium text-foreground">
          Ativar notificações &quot;push&quot;
        </span>

        <button
          onClick={handleToggle}
          disabled={isDenied || busy}
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={
            isDenied
              ? { background: "hsl(var(--destructive)/0.15)", color: "hsl(var(--destructive))" }
              : subscribed
              ? { background: "hsl(var(--primary)/0.15)", color: "hsl(var(--primary))" }
              : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
          }
          aria-pressed={subscribed}
        >
          {busy ? "…" : isDenied ? "Bloqueado" : subscribed ? "● Ativo" : "○ Inativo"}
        </button>
      </div>

      {isDenied && (
        <p className="text-xs text-muted-foreground px-1">
          Notificações bloqueadas no navegador — ative nas configurações do site.
        </p>
      )}

      {lastError && (
        <p className="text-xs text-destructive px-1">{lastError}</p>
      )}
    </div>
  );
}

