import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plants } = await req.json();

    if (!plants || !Array.isArray(plants) || plants.length === 0) {
      return new Response(JSON.stringify({ tasks: [], message: "Nenhuma planta cadastrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    const defaultIntervals: Record<string, { water: number; fertilize: number; spray: number }> = {
      low: { water: 7, fertilize: 30, spray: 10 },
      medium: { water: 4, fertilize: 21, spray: 7 },
      high: { water: 2, fertilize: 14, spray: 5 },
    };

    interface NotifTask {
      plantId: string;
      plantName: string;
      type: string;
      date: string;
    }

    const todayTasks: NotifTask[] = [];

    for (const plant of plants) {
      const intervals = plant.careIntervals || defaultIntervals[plant.light] || defaultIntervals.medium;

      for (const type of ["water", "fertilize", "spray"] as const) {
        const interval = intervals[type];
        // Check if today is a care day (days since creation modulo interval)
        const created = new Date(plant.createdAt);
        created.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff % interval === 0) {
          todayTasks.push({
            plantId: plant.id,
            plantName: plant.name,
            type,
            date: todayStr,
          });
        }
      }
    }

    const careLabels: Record<string, string> = {
      water: "Rega",
      fertilize: "Adubação",
      spray: "Spray",
    };

    let notificationTitle = "";
    let notificationBody = "";

    if (todayTasks.length > 0) {
      const byPlant = todayTasks.reduce((acc, t) => {
        if (!acc[t.plantName]) acc[t.plantName] = [];
        acc[t.plantName].push(t.type);
        return acc;
      }, {} as Record<string, string[]>);

      notificationTitle = `🌿 ${todayTasks.length} cuidado${todayTasks.length > 1 ? "s" : ""} hoje`;
      notificationBody = Object.entries(byPlant)
        .map(([name, types]) => `${name}: ${types.map((t) => careLabels[t] || t).join(", ")}`)
        .join(" | ");
    }

    return new Response(
      JSON.stringify({
        tasks: todayTasks,
        date: todayStr,
        notification:
          todayTasks.length > 0
            ? { title: notificationTitle, body: notificationBody }
            : null,
      }),
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
