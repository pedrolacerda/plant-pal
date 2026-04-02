import { loadPlants, getUpcomingTasks, getCareLabel } from "@/lib/plantCare";
import { supabase } from "@/integrations/supabase/client";

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function isNotificationSupported(): boolean {
  return "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// ── Debug helpers ────────────────────────────────────────────────────────────
const dbg = (...args: unknown[]) => console.log("[push]", ...args);
const dbgWarn = (...args: unknown[]) => console.warn("[push]", ...args);
const dbgErr = (...args: unknown[]) => console.error("[push]", ...args);

export async function getPushDebugInfo(): Promise<Record<string, string>> {
  const info: Record<string, string> = {};
  info["permission"] = "Notification" in window ? Notification.permission : "unsupported";
  info["serviceWorker"] = "serviceWorker" in navigator ? "supported" : "unsupported";
  info["PushManager"] = "PushManager" in window ? "supported" : "unsupported";
  info["VAPID key"] = import.meta.env.VITE_VAPID_PUBLIC_KEY
    ? `configured (${(import.meta.env.VITE_VAPID_PUBLIC_KEY as string).slice(0, 12)}…)`
    : "MISSING";

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        info["SW scope"] = reg.scope;
        info["SW active"] = reg.active?.state ?? "none";
        const sub = await reg.pushManager?.getSubscription();
        info["push subscription"] = sub
          ? `active — ${sub.endpoint.slice(0, 50)}…`
          : "none";
      } else {
        info["SW active"] = "not registered";
        info["push subscription"] = "n/a";
      }
    } catch (e) {
      info["SW active"] = `error: ${e}`;
    }
  }
  return info;
}
// ─────────────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  dbg("subscribeToPush called for userId:", userId);
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    dbgWarn("ServiceWorker or PushManager not available");
    return false;
  }
  if (Notification.permission !== "granted") {
    dbgWarn("Notification permission not granted:", Notification.permission);
    return false;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    dbgWarn("VAPID public key not configured (VITE_VAPID_PUBLIC_KEY)");
    return false;
  }
  dbg("VAPID key present:", vapidPublicKey.slice(0, 12) + "…");

  try {
    dbg("Waiting for SW ready…");
    const reg = await navigator.serviceWorker.ready;
    dbg("SW ready. Scope:", reg.scope, "Active state:", reg.active?.state);

    const existing = await reg.pushManager.getSubscription();
    dbg("Existing push subscription:", existing ? existing.endpoint.slice(0, 50) + "…" : "none");

    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    dbg("Push subscription endpoint:", sub.endpoint.slice(0, 50) + "…");

    const json = sub.toJSON();
    const keys = json.keys ?? {};
    dbg("Subscription keys present — p256dh:", !!keys.p256dh, " auth:", !!keys.auth);

    dbg("Upserting to push_subscriptions table…");
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: keys.p256dh ?? "",
        auth: keys.auth ?? "",
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      dbgErr("DB upsert failed:", error.message, error);
      return false;
    }
    dbg("DB upsert succeeded ✓");
    return true;
  } catch (e) {
    dbgErr("Push subscription failed:", e);
    return false;
  }
}

export async function unsubscribePush(userId: string): Promise<boolean> {
  dbg("unsubscribePush called for userId:", userId);
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        dbg("Deleting from DB — endpoint:", sub.endpoint.slice(0, 50) + "…");
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", sub.endpoint);
        if (error) dbgErr("DB delete failed:", error.message);
        else dbg("DB delete succeeded ✓");
        await sub.unsubscribe();
        dbg("PushManager unsubscribe done ✓");
      } else {
        dbgWarn("No active push subscription found to unsubscribe");
      }
    }
    return true;
  } catch (e) {
    dbgErr("Push unsubscribe failed:", e);
    return false;
  }
}

let checkInterval: ReturnType<typeof setInterval> | null = null;

export function startDailyNotificationCheck() {
  if (checkInterval) clearInterval(checkInterval);
  checkAndNotifyViaCloud();
  checkInterval = setInterval(checkAndNotifyViaCloud, 60 * 60 * 1000);
}

export function stopDailyNotificationCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

async function checkAndNotifyViaCloud() {
  if (Notification.permission !== "granted") return;

  const plants = loadPlants();
  if (plants.length === 0) return;

  const today = new Date().toISOString().split("T")[0];
  const lastNotified = localStorage.getItem("lastNotifiedDate");
  if (lastNotified === today) return;

  try {
    const { data, error } = await supabase.functions.invoke("care-notifications", {
      body: { plants },
    });

    if (error || !data) {
      fallbackLocalNotify(today, plants);
      return;
    }

    if (data.notification) {
      new Notification(data.notification.title, {
        body: data.notification.body,
        icon: "/icons/icon-192.png",
        tag: "daily-care-reminder",
      });
      localStorage.setItem("lastNotifiedDate", today);
    }
  } catch (e) {
    console.error("Cloud notification check failed, using fallback:", e);
    fallbackLocalNotify(today, plants);
  }
}

function fallbackLocalNotify(today: string, plants: ReturnType<typeof loadPlants>) {
  const todayTasks = getUpcomingTasks(plants, 1).filter((t) => t.date === today);
  if (todayTasks.length === 0) return;

  const byPlant = todayTasks.reduce((acc, t) => {
    if (!acc[t.plantName]) acc[t.plantName] = [];
    acc[t.plantName].push(t.type);
    return acc;
  }, {} as Record<string, string[]>);

  new Notification(`🌿 ${todayTasks.length} cuidado${todayTasks.length > 1 ? "s" : ""} hoje`, {
    body: Object.entries(byPlant)
      .map(([name, types]) => `${name}: ${types.map(getCareLabel).join(", ")}`)
      .join("\n"),
    icon: "/icons/icon-192.png",
    tag: "daily-care-reminder",
  });

  localStorage.setItem("lastNotifiedDate", today);
}
