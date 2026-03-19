#!/usr/bin/env -S npx tsx
/**
 * Backfills plant details (scientific name, description, fertilizer types)
 * for existing plants that are missing this data.
 *
 * Uses the GitHub Models API directly to populate real data for each plant.
 *
 * Usage:
 *   npx tsx scripts/backfill-plant-details.ts
 *   bun scripts/backfill-plant-details.ts
 *
 * Requires a .env file with:
 *   VITE_SUPABASE_URL
 *   VITE_GITHUB_MODELS_API_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (needed to update all users' plants)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Load .env ─────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.warn("⚠️  No .env file found — relying on existing environment variables.");
  }
}

loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const githubModelsApiKey = process.env.VITE_GITHUB_MODELS_API_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "❌  Missing environment variables.\n" +
      "    Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
  );
  process.exit(1);
}

if (!githubModelsApiKey) {
  console.error(
    "❌  Missing VITE_GITHUB_MODELS_API_KEY.\n" +
      "    The script needs direct access to the GitHub Models API."
  );
  process.exit(1);
}

// ── Fetch all plants that need backfilling ────────────────────────────────────
interface PlantRow {
  id: string;
  name: string;
  light: "low" | "medium" | "high";
  description: string | null;
  scientific_name: string | null;
  fertilizer_types: string[] | null;
}

interface PlantDetails {
  scientificName: string;
  description: string;
  fertilizerTypes: string[];
  waterDays: number;
  waterAmount: number;
  fertilizeDays: number;
  fertilizerAmount: number;
  sprayDays: number;
  tip: string;
  fertilizerHint: string;
}

async function fetchPlants(): Promise<PlantRow[]> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/plants?select=id,name,light,description,scientific_name,fertilizer_types`,
    {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch plants: HTTP ${res.status} — ${text}`);
  }

  return res.json() as Promise<PlantRow[]>;
}

async function fetchPlantDetails(plantName: string, light: string): Promise<PlantDetails> {
  const lightLabels: Record<string, string> = {
    low: "pouca luz",
    medium: "luz média",
    high: "muita luz",
  };

  const response = await fetch("https://models.github.ai/inference/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubModelsApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em botânica e cuidados de plantas domésticas no Brasil. Retorne informações detalhadas de cuidados para plantas domésticas, incluindo fertilizantes disponíveis no mercado brasileiro. Responda APENAS usando a tool fornecida.",
        },
        {
          role: "user",
          content: `Planta: "${plantName}" em ambiente com ${lightLabels[light] || light}. Forneça: intervalos ideais de rega, adubação e spray/umidificação (em dias), quantidade de água (em ml) por rega, quantidade de fertilizante diluído (em ml) por adubação, dica curta de cuidado, nome científico, descrição da planta (até 200 caracteres), e lista de fertilizantes recomendados disponíveis no mercado brasileiro.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "plant_care_info",
            description: "Return detailed care info and plant details.",
            parameters: {
              type: "object",
              properties: {
                waterDays: { type: "number", description: "Intervalo de rega em dias" },
                waterAmount: { type: "number", description: "Quantidade de água por rega em ml" },
                fertilizeDays: { type: "number", description: "Intervalo de adubação em dias" },
                fertilizerAmount: {
                  type: "number",
                  description: "Quantidade de fertilizante diluído por adubação em ml",
                },
                sprayDays: { type: "number", description: "Intervalo de spray/umidificação em dias" },
                tip: { type: "string", description: "Dica curta de cuidado (máx 80 caracteres)" },
                fertilizerHint: {
                  type: "string",
                  description: "Indicação do tipo de fertilizante ideal. Máx 80 caracteres.",
                },
                scientificName: {
                  type: "string",
                  description: "Nome científico da planta em latim",
                },
                description: {
                  type: "string",
                  description: "Descrição breve da planta: origem, características e particularidades. Máx 200 caracteres.",
                },
                fertilizerTypes: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Lista de 2 a 4 fertilizantes recomendados disponíveis no mercado brasileiro (ex: 'Forth Plantas Verdes', 'Vitaplan NPK 10-10-10', 'Húmus de Minhoca Orgânico', 'Osmocote 14-14-14').",
                },
              },
              required: [
                "waterDays",
                "waterAmount",
                "fertilizeDays",
                "fertilizerAmount",
                "sprayDays",
                "tip",
                "fertilizerHint",
                "scientificName",
                "description",
                "fertilizerTypes",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "plant_care_info" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error: HTTP ${response.status} — ${text}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          function?: { arguments?: string };
        }>;
      };
    }>;
  };
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI did not return structured data");
  }

  return JSON.parse(toolCall.function.arguments) as PlantDetails;
}

async function updatePlant(
  plantId: string,
  details: PlantDetails
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/plants?id=eq.${plantId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      scientific_name: details.scientificName,
      description: details.description,
      fertilizer_types: details.fertilizerTypes,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update plant ${plantId}: HTTP ${res.status} — ${text}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("🌿  Fetching plants that need backfilling...\n");

const plants = await fetchPlants();
const toBackfill = plants.filter(
  (p) => !p.description || !p.scientific_name || !p.fertilizer_types?.length
);

if (toBackfill.length === 0) {
  console.log("✅  All plants already have details. Nothing to backfill.");
  process.exit(0);
}

console.log(`📋  Found ${toBackfill.length} plant(s) to backfill out of ${plants.length} total.\n`);

let successCount = 0;
let errorCount = 0;

for (const plant of toBackfill) {
  process.stdout.write(`   ⏳ ${plant.name} (${plant.light})...`);
  try {
    const details = await fetchPlantDetails(plant.name, plant.light);
    await updatePlant(plant.id, details);
    console.log(` ✅ done`);
    console.log(`      📖 ${details.scientificName}`);
    console.log(`      🌱 ${details.fertilizerTypes.join(", ")}`);
    successCount++;

    // Small delay to avoid rate limiting
    if (toBackfill.indexOf(plant) < toBackfill.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    console.log(` ❌ failed`);
    console.error(`      ${err instanceof Error ? err.message : String(err)}`);
    errorCount++;
  }
}

console.log(
  `\n🏁  Done! ${successCount} updated successfully, ${errorCount} failed.`
);

if (errorCount > 0) {
  process.exit(1);
}
