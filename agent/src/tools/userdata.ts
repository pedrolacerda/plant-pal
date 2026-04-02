import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import {
  formatPlantList,
  formatUpcomingTasks,
  generateCareTasks,
  type PlantSummary,
} from "../types.js";

/**
 * Registry of plants per user session.
 * Populated by agent.ts when a session is created/updated.
 */
export const userPlantsRegistry = new Map<string, PlantSummary[]>();

// ---------------------------------------------------------------------------
// Tool: get_my_plants
// ---------------------------------------------------------------------------

/**
 * Returns the user's full plant list with care schedules.
 */
export const getMyPlantsTool = defineTool("get_my_plants", {
  description:
    "Return the user's complete plant list from Meu Jardim, including each plant's " +
    "name, light requirement, care intervals (watering/fertilizing/misting frequency " +
    "in days), care amounts (ml), and any saved tips. " +
    "Use this when the user asks 'what plants do I have?', 'list my plants', or " +
    "questions about a specific plant's details.",
  parameters: z.object({
    userId: z.string().describe("The user's ID (passed in the session context)"),
  }),
  handler: async ({ userId }) => {
    const plants = userPlantsRegistry.get(userId) ?? [];
    if (plants.length === 0) {
      return "You have no plants registered in Meu Jardim yet. Add your first plant in the app!";
    }
    return `You have ${plants.length} plant(s) registered:\n\n${formatPlantList(plants)}`;
  },
});

// ---------------------------------------------------------------------------
// Tool: get_upcoming_care
// ---------------------------------------------------------------------------

/**
 * Returns upcoming care tasks from the user's calendar.
 */
export const getUpcomingCareTool = defineTool("get_upcoming_care", {
  description:
    "Return the user's upcoming plant care tasks (watering, fertilizing, misting) " +
    "from their Meu Jardim care calendar. Shows tasks for the next N days. " +
    "Use this when the user asks 'what do I need to do today/this week?', " +
    "'when should I water my plants?', 'show my care calendar', or any question " +
    "about scheduled plant maintenance.",
  parameters: z.object({
    userId: z.string().describe("The user's ID (passed in the session context)"),
    days: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe("Number of days to look ahead (default: 7, max: 60)"),
    plant_name: z
      .string()
      .optional()
      .describe("Filter tasks to a specific plant name (case-insensitive)"),
  }),
  handler: async ({ userId, days = 7, plant_name }) => {
    let plants = userPlantsRegistry.get(userId) ?? [];

    if (plants.length === 0) {
      return "You have no plants registered yet, so there are no upcoming tasks.";
    }

    if (plant_name) {
      const lower = plant_name.toLowerCase();
      plants = plants.filter((p) => p.name.toLowerCase().includes(lower));
      if (plants.length === 0) {
        return `No plant matching "${plant_name}" found in your collection.`;
      }
    }

    const label = plant_name ? `for **${plant_name}**` : "across all your plants";
    return (
      `Upcoming care tasks ${label} in the next ${days} day(s):\n\n` +
      formatUpcomingTasks(plants, days)
    );
  },
});

// ---------------------------------------------------------------------------
// Tool: get_plant_schedule
// ---------------------------------------------------------------------------

/**
 * Returns the full care schedule for a specific plant over N days.
 */
export const getPlantScheduleTool = defineTool("get_plant_schedule", {
  description:
    "Return the detailed care schedule for a specific plant — all watering, " +
    "fertilizing, and misting dates for the next N days. " +
    "Use this when asked 'when do I next water my X?', 'show me the schedule for Y', " +
    "or 'how often does Z need care?'.",
  parameters: z.object({
    userId: z.string().describe("The user's ID"),
    plant_name: z
      .string()
      .describe("Name of the plant (partial, case-insensitive match)"),
    days: z
      .number()
      .int()
      .min(1)
      .max(90)
      .optional()
      .describe("How many days ahead to show (default: 30)"),
  }),
  handler: async ({ userId, plant_name, days = 30 }) => {
    const plants = userPlantsRegistry.get(userId) ?? [];
    const lower = plant_name.toLowerCase();
    const plant = plants.find((p) => p.name.toLowerCase().includes(lower));

    if (!plant) {
      const names = plants.map((p) => p.name).join(", ");
      return (
        `No plant matching "${plant_name}" found.\n` +
        (names ? `Your plants: ${names}` : "You have no plants yet.")
      );
    }

    const tasks = generateCareTasks(plant, days);
    if (tasks.length === 0) {
      return `No scheduled tasks found for ${plant.name} in the next ${days} days.`;
    }

    const today = new Date().toISOString().split("T")[0];

    // Group by date
    const byDate: Record<string, typeof tasks> = {};
    for (const t of tasks) {
      if (!byDate[t.date]) byDate[t.date] = [];
      byDate[t.date].push(t);
    }

    const typeLabels: Record<string, string> = {
      water: "💧 Water",
      fertilize: "🌱 Fertilize",
      spray: "💨 Mist",
    };

    const lines = Object.entries(byDate).map(([date, dayTasks]) => {
      const marker = date === today ? " ← TODAY" : "";
      const items = dayTasks
        .map((t) => `  ${typeLabels[t.type]}${t.amount ? ` (${t.amount} ml)` : ""}`)
        .join("\n");
      return `${date}${marker}:\n${items}`;
    });

    return `Care schedule for **${plant.name}** (next ${days} days):\n\n${lines.join("\n")}`;
  },
});
