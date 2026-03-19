export type LightLevel = "low" | "medium" | "high";

export interface CareIntervals {
  water: number;
  fertilize: number;
  spray: number;
}

export interface CareAmounts {
  water?: number;      // ml per watering
  fertilizer?: number; // ml per fertilization
}

export interface Plant {
  id: string;
  name: string;
  scientificName?: string;
  description?: string;
  fertilizerTypes?: string[];
  light: LightLevel;
  createdAt: string;
  careIntervals?: CareIntervals;
  careAmounts?: CareAmounts;
  tip?: string;
  photo?: string; // base64 data URL
  nextCareDates?: {
    water?: string;   // ISO date
    fertilize?: string;
    spray?: string;
  };
}

const DEFAULT_CARE_INTERVALS: Record<LightLevel, CareIntervals> = {
  low: { water: 7, fertilize: 30, spray: 10 },
  medium: { water: 4, fertilize: 21, spray: 7 },
  high: { water: 2, fertilize: 14, spray: 5 },
};

function getCareIntervals(plant: Plant): CareIntervals {
  return plant.careIntervals || DEFAULT_CARE_INTERVALS[plant.light];
}

export interface CareTask {
  plantId: string;
  plantName: string;
  type: "water" | "fertilize" | "spray";
  date: string;
  amount?: number; // ml
}

const CARE_LABELS: Record<string, string> = {
  water: "Rega",
  fertilize: "Adubação",
  spray: "Spray",
};

const CARE_ICONS: Record<string, string> = {
  water: "💧",
  fertilize: "🌱",
  spray: "💨",
};

export function getCareLabel(type: string) {
  return CARE_LABELS[type] || type;
}

export function getCareIcon(type: string) {
  return CARE_ICONS[type] || "🌿";
}

export function getLightLabel(light: LightLevel) {
  const labels: Record<LightLevel, string> = {
    low: "Pouca luz",
    medium: "Luz média",
    high: "Muita luz",
  };
  return labels[light];
}

export function getLightIcon(light: LightLevel) {
  const icons: Record<LightLevel, string> = {
    low: "🌑",
    medium: "⛅",
    high: "☀️",
  };
  return icons[light];
}

export function generateCareTasks(plant: Plant, daysAhead = 60): CareTask[] {
  const tasks: CareTask[] = [];
  const intervals = getCareIntervals(plant);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const getAmount = (type: "water" | "fertilize" | "spray"): number | undefined => {
    if (type === "water") return plant.careAmounts?.water;
    if (type === "fertilize") return plant.careAmounts?.fertilizer;
    return undefined;
  };

  for (const type of ["water", "fertilize", "spray"] as const) {
    const interval = intervals[type];
    const customDate = plant.nextCareDates?.[type];
    const amount = getAmount(type);

    if (customDate) {
      // Use custom date as the anchor point and generate from there
      const anchor = new Date(customDate);
      anchor.setHours(0, 0, 0, 0);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + daysAhead);

      // Go backwards/forwards from anchor in interval steps
      let current = new Date(anchor);
      // Go back to find the earliest occurrence in range
      while (current > start) {
        current.setDate(current.getDate() - interval);
      }
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
      // Use createdAt as anchor so tasks aren't always pinned to today
      const anchor = new Date(plant.createdAt);
      anchor.setHours(0, 0, 0, 0);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + daysAhead);

      // Advance anchor to the first occurrence on or after today
      let current = new Date(anchor);
      while (current < start) {
        current.setDate(current.getDate() + interval);
      }

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
    }
  }

  return tasks;
}

export function getTasksForDate(plants: Plant[], date: string): CareTask[] {
  return plants.flatMap((p) => generateCareTasks(p).filter((t) => t.date === date));
}

export function getUpcomingTasks(plants: Plant[], days = 7): CareTask[] {
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split("T")[0];
  const end = new Date(todayDate);
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().split("T")[0];

  return plants
    .flatMap((p) => generateCareTasks(p, days))
    .filter((t) => t.date >= todayStr && t.date <= endStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function savePlants(plants: Plant[]) {
  localStorage.setItem("plants", JSON.stringify(plants));
}

export function loadPlants(): Plant[] {
  const raw = localStorage.getItem("plants");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
