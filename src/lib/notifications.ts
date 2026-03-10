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
