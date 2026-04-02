import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";

/**
 * Tool: recommend_accessories
 * Recommends plant-care accessories, tools, or products by type
 * (not specific brands/links) for a given plant and need.
 */
export const recommendAccessoriesTool = defineTool("recommend_accessories", {
  description:
    "Recommend plant-care accessories, tools, or supplies for a specific plant and " +
    "use-case need. Returns typed recommendations with explanations of what to look " +
    "for when buying – no specific brands or external links provided.",
  parameters: z.object({
    plant_name: z
      .string()
      .describe("Common name of the plant the accessories are needed for"),
    need: z
      .string()
      .describe(
        "What the user needs help with, e.g. 'better drainage', 'increase humidity', " +
          "'fertilizing', 'repotting', 'pest control', 'propagation', 'watering tools', " +
          "'grow lights', 'support stakes'"
      ),
    budget_level: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe(
        "Price sensitivity: 'low' (cheap/DIY), 'medium' (standard), 'high' (premium)"
      ),
    experience_level: z
      .enum(["beginner", "intermediate", "expert"])
      .optional()
      .describe("User's gardening experience level – affects complexity of recommendations"),
  }),
  handler: async ({ plant_name, need, budget_level, experience_level }) => {
    const budgetContext = budget_level ? `Budget level: ${budget_level}` : "";
    const experienceContext = experience_level
      ? `Experience level: ${experience_level}`
      : "";

    const contextLines = [budgetContext, experienceContext]
      .filter(Boolean)
      .join("\n");

    return (
      `Recommend accessories and supplies for the following situation:\n\n` +
      `Plant: ${plant_name}\n` +
      `Need: ${need}\n` +
      `${contextLines}\n\n` +
      `For each recommendation, provide:\n` +
      `1. **Type of accessory/product** (what it is, not brand names)\n` +
      `2. **Why it helps** this specific plant or need\n` +
      `3. **What to look for** when choosing (key features/specs)\n` +
      `4. **DIY alternative** if applicable (especially for low budget)\n` +
      `5. **Priority** – ESSENTIAL or NICE-TO-HAVE\n\n` +
      `Keep recommendations practical and avoid suggesting specific brands or external links.`
    );
  },
});
