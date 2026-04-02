/**
 * Topic guardrails for PlantBot.
 *
 * Two-layer defence:
 *  1. A lightweight LLM classifier that runs BEFORE the main agent session
 *     and rejects messages unrelated to plant care / gardening.
 *  2. Explicit refusal instructions baked into the main system prompt
 *     (see buildSystemMessage in agent.ts).
 *
 * If the classifier API call fails for any reason the message is allowed
 * through (fail-open) so transient errors never block legitimate users.
 */

/**
 * Maximum number of characters of the user message sent to the classifier.
 * Keeps the classification call cheap while still giving the model enough
 * context to make an accurate judgement.
 */
const MAX_CLASSIFIER_INPUT_LENGTH = 500;

const CLASSIFIER_SYSTEM_PROMPT = `You are a topic classifier for a plant care assistant called PlantBot.
Determine whether a user message is related to plant care, gardening, or botany.

Plant care topics INCLUDE (but are not limited to):
- Plant identification and species information
- Watering, fertilizing, pruning, repotting
- Plant diseases, pests, and treatments
- Soil, light, and humidity requirements
- Garden planning and design
- Seasonal care and climate considerations
- Plant accessories and tools
- Questions about the user's own plants or care schedules
- Greetings, thanks, or short follow-up messages in the context of plant care

Respond with ONLY the word "yes" if the message is related to plant care or gardening.
Respond with ONLY the word "no" if the message is about something unrelated (e.g. coding, maths, politics, recipes, general trivia, medical questions, finance, entertainment).
Do not add any punctuation or explanation.`;

/**
 * Returns `true` when the user's message is about plant care / gardening,
 * `false` when it is clearly off-topic.
 *
 * Short greetings and conversational follow-ups are always allowed so that
 * natural conversation flow is not broken.
 */
export async function isPlantCareRelated(
  message: string,
  apiKey: string
): Promise<boolean> {
  const trimmed = message.trim();

  // Always allow very short messages – they are almost certainly
  // greetings or one-word follow-ups within an ongoing conversation.
  if (trimmed.length < 15) {
    return true;
  }

  try {
    const response = await fetch(
      "https://models.github.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-4.1-nano",
          messages: [
            { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
            { role: "user", content: trimmed.slice(0, MAX_CLASSIFIER_INPUT_LENGTH) },
          ],
          max_tokens: 5,
          temperature: 0,
        }),
      }
    );

    if (!response.ok) {
      console.warn(
        `[guardrails] Classifier API error ${response.status} – allowing message through`
      );
      return true;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const answer =
      data.choices?.[0]?.message?.content?.trim().toLowerCase() ?? "yes";

    const onTopic = answer === "yes";
    if (!onTopic) {
      console.log(`[guardrails] Off-topic message blocked: "${trimmed.slice(0, 80)}"`);
    }
    return onTopic;
  } catch (err) {
    // Network errors or unexpected payloads — fail open
    console.warn("[guardrails] Classifier error (allowing through):", err);
    return true;
  }
}

/** Human-readable refusal message returned to the client when blocked. */
export const OFF_TOPIC_RESPONSE =
  "I'm PlantBot, your plant care assistant! 🌿 I can only help with questions about plants, gardening, and plant care. Feel free to ask me about watering schedules, plant diseases, care routines, or anything else related to your green friends!";
