import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { CopilotSession } from "@github/copilot-sdk";
import { identifyDiseaseTool } from "./tools/plants.js";
import { getCareRoutineTool } from "./tools/care.js";
import { recommendAccessoriesTool } from "./tools/accessories.js";
import {
  getMyPlantsTool,
  getUpcomingCareTool,
  getPlantScheduleTool,
  userPlantsRegistry,
} from "./tools/userdata.js";
import { formatPlantList, formatUpcomingTasks } from "./types.js";
import type { PlantSummary } from "./types.js";
export type { PlantSummary } from "./types.js";

// ---------------------------------------------------------------------------
// Singleton CopilotClient
// ---------------------------------------------------------------------------

let _client: CopilotClient | null = null;

function getClient(): CopilotClient {
  if (!_client) {
    const apiKey = process.env.GITHUB_MODELS_API_KEY;
    if (!apiKey) {
      throw new Error("GITHUB_MODELS_API_KEY environment variable is not set");
    }

    _client = new CopilotClient({
      // BYOK: connect to GitHub Models inference API directly
      // The client still needs the Copilot CLI binary, but we override the
      // provider so all model calls go through GitHub Models (no subscription).
      useLoggedInUser: false,
    });
  }
  return _client;
}

export async function startClient(): Promise<void> {
  const client = getClient();
  await client.start();
  console.log("[agent] CopilotClient started");
}

export async function stopClient(): Promise<void> {
  if (_client) {
    await _client.stop();
    _client = null;
    console.log("[agent] CopilotClient stopped");
  }
}

// ---------------------------------------------------------------------------
// Session manager  (one session per userId)
// ---------------------------------------------------------------------------

const sessions = new Map<string, CopilotSession>();

/**
 * Build the personalised system message for a user, injecting their plant list
 * and upcoming care calendar.
 */
function buildSystemMessage(userId: string, plants: PlantSummary[]): string {
  const plantSection =
    plants.length > 0
      ? formatPlantList(plants)
      : "The user has no plants registered yet.";

  const calendarSection =
    plants.length > 0
      ? formatUpcomingTasks(plants, 7)
      : "No upcoming tasks — user has no plants yet.";

  return `You are PlantBot, a friendly and knowledgeable plant care expert assistant \
embedded in the Meu Jardim app.

You help users with:
- Diagnosing plant diseases and health problems
- Providing specific care routines (watering, fertilizing, misting, repotting)
- Plant care best practices for different environments and seasons
- Recommending types of accessories, tools, and supplies (without brand names or links)
- General gardening advice
- Answering questions about the user's own plants and their care schedule

The user's ID is: ${userId}
When calling get_my_plants, get_upcoming_care, or get_plant_schedule, ALWAYS pass \`userId: "${userId}"\`.

The user's current plants in Meu Jardim:
${plantSection}

Upcoming care tasks (next 7 days):
${calendarSection}

Guidelines:
- Always respond in the same language the user writes in (Portuguese or English).
- Be warm, encouraging, and concise. Avoid overly technical jargon unless asked.
- When diagnosing, always ask for more details if the description is vague.
- When recommending accessories, focus on WHAT to look for, not specific brands.
- If a question is about one of the user's plants, reference it by name.
- Do not provide URLs or external links.
- Use the data tools (get_my_plants, get_upcoming_care, get_plant_schedule) to fetch \
up-to-date information whenever the user asks about their plants or schedule.`;
}

/**
 * Return the existing session for a user, or create a new one.
 * If `forceNew` is true, the old session is disconnected first.
 */
export async function getOrCreateSession(
  userId: string,
  plants: PlantSummary[],
  forceNew = false
): Promise<CopilotSession> {
  const client = getClient();
  const apiKey = process.env.GITHUB_MODELS_API_KEY!;

  if (forceNew) {
    const existing = sessions.get(userId);
    if (existing) {
      await existing.disconnect().catch(() => {});
      sessions.delete(userId);
    }
    userPlantsRegistry.delete(userId);
  }

  // Always keep the registry up-to-date with the latest plant data.
  userPlantsRegistry.set(userId, plants);

  if (sessions.has(userId)) {
    console.log(`[agent] Reusing existing session for userId=${userId}`);
    return sessions.get(userId)!;
  }

  const model = "openai/gpt-4o";
  console.log(`[agent] Creating new session for userId=${userId} model=${model} tools=${[
    "identify_disease", "get_care_routine", "recommend_accessories",
    "get_my_plants", "get_upcoming_care", "get_plant_schedule",
  ].join(",")}`);

  const session = await client.createSession({
    model,
    provider: {
      type: "openai",
      baseUrl: "https://models.github.ai/inference/v1",
      apiKey,
    },
    tools: [
      identifyDiseaseTool,
      getCareRoutineTool,
      recommendAccessoriesTool,
      getMyPlantsTool,
      getUpcomingCareTool,
      getPlantScheduleTool,
    ],
    systemMessage: {
      mode: "replace",
      content: buildSystemMessage(userId, plants),
    },
    onPermissionRequest: approveAll,
    infiniteSessions: { enabled: false },
    onUserInputRequest: async (request) => {
      // PlantBot uses questions naturally in its responses; this handler
      // satisfies the SDK signature but won't be triggered in practice since
      // ask_user is not intentionally invoked.
      console.log(`[agent] ask_user invoked: ${request.question}`);
      return { answer: "", wasFreeform: true };
    },
  });

  sessions.set(userId, session);
  console.log(`[agent] New session created for user ${userId}`);
  return session;
}

/**
 * Remove a user's session (called when the user resets the conversation).
 */
export async function clearSession(userId: string): Promise<void> {
  const session = sessions.get(userId);
  if (session) {
    await session.disconnect().catch(() => {});
    sessions.delete(userId);
  }
  userPlantsRegistry.delete(userId);
  console.log(`[agent] Session cleared for user ${userId}`);
}
