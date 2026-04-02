import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";

/**
 * Tool: identify_disease
 * Given a plant name and a description of symptoms, returns a structured
 * diagnosis with severity and a list of recommended treatments.
 */
export const identifyDiseaseTool = defineTool("identify_disease", {
  description:
    "Diagnose a plant disease or health problem based on the plant name and " +
    "a description of visible symptoms (e.g. yellowing leaves, spots, wilting). " +
    "Returns a diagnosis, severity level, and a prioritised list of treatments.",
  parameters: z.object({
    plant_name: z
      .string()
      .describe("Common name of the plant (e.g. 'Monstera', 'Fiddle Leaf Fig')"),
    symptom_description: z
      .string()
      .describe(
        "Detailed description of the symptoms the user is observing, " +
          "such as leaf colour changes, spots, drooping, root condition, etc."
      ),
    light_level: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe("Current light level the plant receives – helps with context"),
  }),
  handler: async ({ plant_name, symptom_description, light_level }) => {
    // The Copilot model will generate the diagnosis using this tool invocation
    // context. We return a structured prompt that guides the model's response.
    const lightContext = light_level
      ? ` The plant is kept in ${light_level} light.`
      : "";

    return (
      `Diagnose the following plant health issue and provide a structured response:\n\n` +
      `Plant: ${plant_name}\n` +
      `Symptoms: ${symptom_description}\n` +
      `${lightContext}\n\n` +
      `Please provide:\n` +
      `1. A clear diagnosis (disease name or condition)\n` +
      `2. Severity: healthy / mild / moderate / severe\n` +
      `3. A brief explanation of the cause\n` +
      `4. A numbered list of treatments, each labelled as IMMEDIATE, SOON, or PREVENTIVE\n` +
      `5. Any warning signs to watch for after treatment`
    );
  },
});
