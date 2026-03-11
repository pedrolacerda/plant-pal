/**
 * Shared data types for the PlantBot agent.
 * Mirror the frontend's plantCare.ts types — without any React/Vite dependencies.
 */

export type LightLevel = "low" | "medium" | "high";
export type CareType = "water" | "fertilize" | "spray";

export interface CareIntervals {
  water: number;      // days between waterings
  fertilize: number;  // days between fertilizations
  spray: number;      // days between sprayings
}

export interface CareAmounts {
  water?: number;      // ml per watering
  fertilizer?: number; // ml per fertilisation
}

export interface PlantSummary {
  id: string;
  name: string;
  light: LightLevel;
  tip?: string;
  createdAt?: string;
  careIntervals?: CareIntervals;
  careAmounts?: CareAmounts;
  nextCareDates?: {
    water?: string;     // ISO date
    fertilize?: string;
    spray?: string;
  };
}

export interface CareTask {
  plantId: string;
  plantName: string;
  type: CareType;
  date: string; // YYYY-MM-DD
  amount?: number; // ml
}

// ---------------------------------------------------------------------------
// Care logic (mirrors src/lib/plantCare.ts)
// ---------------------------------------------------------------------------

const DEFAULT_CARE_INTERVALS: Record<LightLevel, CareIntervals> = {
  low:    { water: 7,  fertilize: 30, spray: 10 },
  medium: { water: 4,  fertilize: 21, spray: 7  },
  high:   { water: 2,  fertilize: 14, spray: 5  },
};

export function getCareIntervals(plant: PlantSummary): CareIntervals {
  return plant.careIntervals ?? DEFAULT_CARE_INTERVALS[plant.light];
}

export function generateCareTasks(plant: PlantSummary, daysAhead = 60): CareTask[] {
  const tasks: CareTask[] = [];
  const intervals = getCareIntervals(plant);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const getAmount = (type: CareType): number | undefined => {
    if (type === "water")      return plant.careAmounts?.water;
    if (type === "fertilize")  return plant.careAmounts?.fertilizer;
    return undefined;
  };

  for (const type of ["water", "fertilize", "spray"] as const) {
    const interval = intervals[type];
    const customDate = plant.nextCareDates?.[type];
    const amount = getAmount(type);

    if (customDate) {
      const anchor = new Date(customDate);
      anchor.setHours(0, 0, 0, 0);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + daysAhead);

      let current = new Date(anchor);
      while (current > start) current.setDate(current.getDate() - interval);
      if (current < start) current.setDate(current.getDate() + interval);

      while (current <= endDate) {
        tasks.push({
          plantId: plant.id,
          plantName: plant.name,
          type,
          date: current.toISOString().split("T")[0],
          amount,
        });
        current.setDate(current.getDate() + interval);
      }
    } else {
      for (let d = 0; d < daysAhead; d += interval) {
        const date = new Date(start);
        date.setDate(date.getDate() + d);
        tasks.push({
          plantId: plant.id,
          plantName: plant.name,
          type,
          date: date.toISOString().split("T")[0],
          amount,
        });
      }
    }
  }

  return tasks;
}

export function getUpcomingTasks(plants: PlantSummary[], days = 14): CareTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  return plants
    .flatMap((p) => generateCareTasks(p, days))
    .filter((t) => {
      const d = new Date(t.date);
      return d >= today && d <= end;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const CARE_LABELS: Record<CareType, string> = {
  water:     "Rega (watering)",
  fertilize: "Adubação (fertilizing)",
  spray:     "Spray (misting)",
};

const LIGHT_LABELS: Record<LightLevel, string> = {
  low:    "low light",
  medium: "moderate/indirect light",
  high:   "bright/direct light",
};

export function formatPlantList(plants: PlantSummary[]): string {
  if (plants.length === 0) return "No plants registered yet.";

  return plants
    .map((p) => {
      const intervals = getCareIntervals(p);
      const lines: string[] = [
        `• **${p.name}** (${LIGHT_LABELS[p.light]})`,
        `  - Watering every ${intervals.water} day(s)${p.careAmounts?.water ? `, ${p.careAmounts.water} ml` : ""}`,
        `  - Fertilizing every ${intervals.fertilize} day(s)${p.careAmounts?.fertilizer ? `, ${p.careAmounts.fertilizer} ml` : ""}`,
        `  - Misting every ${intervals.spray} day(s)`,
      ];
      if (p.tip) lines.push(`  - Tip: "${p.tip}"`);
      return lines.join("\n");
    })
    .join("\n");
}

export function formatUpcomingTasks(plants: PlantSummary[], days = 7): string {
  const tasks = getUpcomingTasks(plants, days);
  if (tasks.length === 0) return "No care tasks in the next " + days + " days.";

  // Group by date
  const byDate: Record<string, CareTask[]> = {};
  for (const t of tasks) {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  }

  return Object.entries(byDate)
    .map(([date, dayTasks]) => {
      const items = dayTasks
        .map((t) => `  - ${CARE_LABELS[t.type]} for **${t.plantName}**${t.amount ? ` (${t.amount} ml)` : ""}`)
        .join("\n");
      return `${date}:\n${items}`;
    })
    .join("\n");
}
