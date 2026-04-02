import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const defaultIntervals: Record<string, { water: number; fertilize: number; spray: number }> = {
  low: { water: 7, fertilize: 30, spray: 10 },
  medium: { water: 4, fertilize: 21, spray: 7 },
  high: { water: 2, fertilize: 14, spray: 5 },
};

const careLabels: Record<string, string> = {
  water: "Rega",
  fertilize: "Adubação",
  spray: "Spray",
};

interface Plant {
  id: string;
  name: string;
  light: string;
  care_intervals: Record<string, number> | null;
  created_at: string;
  next_care_dates: Record<string, string> | null;
}

interface NotifTask {
  plantId: string;
  plantName: string;
  type: string;
  date: string;
}

function computeNotification(
  plants: Plant[],
  todayStr: string
): { title: string; body: string; tasks: NotifTask[] } | null {
  const today = new Date(todayStr + "T00:00:00Z");
  const todayTasks: NotifTask[] = [];

  for (const plant of plants) {
    const intervals =
      plant.care_intervals || defaultIntervals[plant.light] || defaultIntervals.medium;

    for (const type of ["water", "fertilize", "spray"] as const) {
      const interval = (intervals as Record<string, number>)[type];
      if (!interval) continue;

      const customDate = plant.next_care_dates?.[type];
      let anchor: Date;
      if (customDate) {
        anchor = new Date(customDate + "T00:00:00Z");
      } else {
        anchor = new Date(plant.created_at);
        anchor.setUTCHours(0, 0, 0, 0);
      }

      const daysDiff = Math.round(
        Math.abs(today.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff % interval === 0) {
        todayTasks.push({ plantId: plant.id, plantName: plant.name, type, date: todayStr });
      }
    }
  }

  if (todayTasks.length === 0) return null;

  const byPlant = todayTasks.reduce(
    (acc, t) => {
      if (!acc[t.plantName]) acc[t.plantName] = [];
      acc[t.plantName].push(t.type);
      return acc;
    },
    {} as Record<string, string[]>
  );

  return {
    title: `🌿 ${todayTasks.length} cuidado${todayTasks.length > 1 ? "s" : ""} hoje`,
    body: Object.entries(byPlant)
      .map(([name, types]) => `${name}: ${types.map((t) => careLabels[t] || t).join(", ")}`)
      .join(" | "),
    tasks: todayTasks,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

  if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  try {
    const body = await req.json().catch(() => ({}));

    // ── Client mode ──────────────────────────────────────────────────────────
    // Called from the browser while the app is open.
    // Plants are passed in the request body; the notification payload is returned
    // so the client can display it via the local Notification API.
    if (body.plants && Array.isArray(body.plants)) {
      const normalized = (body.plants as Record<string, unknown>[]).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        light: p.light as string,
        care_intervals: (p.careIntervals as Record<string, number> | undefined) ?? null,
        created_at: p.createdAt as string,
        next_care_dates: (p.nextCareDates as Record<string, string> | undefined) ?? null,
      }));

      const result = computeNotification(normalized as Plant[], todayStr);

      return new Response(
        JSON.stringify({
          tasks: result?.tasks ?? [],
          date: todayStr,
          notification: result ? { title: result.title, body: result.body } : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Broadcast mode ───────────────────────────────────────────────────────
    // Called without a plants body — e.g. from a daily cron job or pg_cron.
    // Reads every push subscription from the DB and sends real Web Push messages.
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*");

    if (subError) {
      return new Response(JSON.stringify({ error: subError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { sent: 0, skipped: 0, errors: 0 };
    const expiredIds: string[] = [];

    for (const sub of subscriptions ?? []) {
      const { data: plants } = await supabaseAdmin
        .from("plants")
        .select("id, name, light, care_intervals, created_at, next_care_dates")
        .eq("user_id", sub.user_id);

      const notification = computeNotification((plants ?? []) as Plant[], todayStr);
      if (!notification) {
        results.skipped++;
        continue;
      }

      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: notification.title, body: notification.body })
        );
        results.sent++;
      } catch (e) {
        console.error(`Push failed for subscription ${sub.id}:`, e);
        if ((e as { statusCode?: number })?.statusCode === 410) {
          expiredIds.push(sub.id as string);
        }
        results.errors++;
      }
    }

    if (expiredIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({ ok: true, date: todayStr, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("care-notifications error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
