import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";

/**
 * Tool: get_care_routine
 * Returns a detailed care routine for a plant based on its name and light level.
 */
export const getCareRoutineTool = defineTool("get_care_routine", {
  description:
    "Get a detailed care routine for a specific plant, including watering frequency, " +
    "fertilizing schedule, humidity needs, repotting guidance, and pro tips for keeping " +
    "the plant healthy. Optionally takes the current light level to fine-tune advice.",
  parameters: z.object({
    plant_name: z
      .string()
      .describe("Common name of the plant (e.g. 'Pothos', 'Snake Plant')"),
    light_level: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe(
        "Current light level: 'low' (indirect/shade), 'medium' (bright indirect), " +
          "'high' (direct sun). Affects watering frequency."
      ),
    season: z
      .enum(["spring", "summer", "autumn", "winter"])
      .optional()
      .describe("Current season – care routines vary significantly by season"),
    specific_concern: z
      .string()
      .optional()
      .describe(
        "Optional specific aspect the user wants help with, e.g. " +
          "'overwatering', 'yellow leaves', 'how to propagate'"
      ),
  }),
  handler: async ({ plant_name, light_level, season, specific_concern }) => {
    const lightContext = light_level
      ? `Current light: ${light_level}`
      : "Light level: unknown";
    const seasonContext = season ? `Current season: ${season}` : "";
    const concernContext = specific_concern
      ? `Specific concern: ${specific_concern}`
      : "";

    const contextLines = [lightContext, seasonContext, concernContext]
      .filter(Boolean)
      .join("\n");

    return (
      `Provide a comprehensive care routine for the following plant:\n\n` +
      `Plant: ${plant_name}\n` +
      `${contextLines}\n\n` +
      `Please cover:\n` +
      `1. Watering – how often (days between watering) and how much (rough ml for a standard pot)\n` +
      `2. Fertilizing – frequency, type of fertilizer, dilution\n` +
      `3. Humidity & temperature requirements\n` +
      `4. Soil mix recommendation\n` +
      `5. Repotting – when and how\n` +
      `6. Light adjustments (if the current level is suboptimal)\n` +
      `7. Common mistakes to avoid\n` +
      `8. A quick-reference table summarising intervals in days`
    );
  },
});
