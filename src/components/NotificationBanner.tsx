import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    if (permission === "denied") return; // browser-level block — nothing we can do

    if (subscribed) {
      const ok = await unsubscribePush(user!.id);
      if (ok) setSubscribed(false);
      return;
    }

    const granted = await requestNotificationPermission();
    setPermission(granted ? "granted" : "denied");
    if (granted && user?.id) {
      const ok = await subscribeToPush(user.id);
      setSubscribed(ok);
    }
  };

  const isDenied = permission === "denied";
  const label = isDenied
    ? "Notificações bloqueadas no navegador"
    : subscribed
    ? "Desativar notificações"
    : "Ativar notificações";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleToggle}
            disabled={isDenied}
            className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              text-muted-foreground hover:text-foreground hover:bg-accent
              data-[active=true]:text-primary"
            data-active={subscribed}
            aria-label={label}
          >
            {subscribed ? (
              <Bell className="w-5 h-5 fill-current" />
            ) : (
              <BellOff className="w-5 h-5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

