import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";

export function NotificationBanner() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  if (!isNotificationSupported()) return null;
  if (permission === "granted") return null;

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? "granted" : "denied");
  };

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 bg-muted rounded-xl p-3 border border-border">
        <BellOff className="w-5 h-5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Notificações bloqueadas. Ative nas configurações do navegador para receber lembretes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-accent rounded-xl p-3 border border-border">
      <Bell className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Ativar lembretes?</p>
        <p className="text-xs text-muted-foreground">Receba notificações dos cuidados do dia</p>
      </div>
      <Button size="sm" onClick={handleEnable} className="rounded-lg shrink-0">
        Ativar
      </Button>
    </div>
  );
}
