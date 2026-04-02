#!/usr/bin/env -S npx tsx
/**
 * Force-sends push notifications by invoking the care-notifications Edge Function
 * in broadcast mode (no plants body → sends real Web Push to all subscriptions).
 *
 * Usage:
 *   npx tsx scripts/force-send-notifications.ts
 *   bun scripts/force-send-notifications.ts
 *
 * Requires a .env file with:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
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
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error(
    "❌  Missing environment variables.\n" +
      "    Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env"
  );
  process.exit(1);
}

const functionUrl = `${supabaseUrl}/functions/v1/care-notifications`;

// ── Invoke ────────────────────────────────────────────────────────────────────
console.log(`📡  Triggering push notifications via:\n    ${functionUrl}\n`);

const response = await fetch(functionUrl, {
  method: "POST",
  headers: {
    apikey: anonKey,
    "Content-Type": "application/json",
  },
  // Empty body → broadcast mode in the Edge Function
  body: JSON.stringify({}),
});

const text = await response.text();
let data: unknown;
try {
  data = JSON.parse(text);
} catch {
  data = text;
}

if (!response.ok) {
  console.error(`❌  HTTP ${response.status}:`, data);
  process.exit(1);
}

console.log(`✅  Response (HTTP ${response.status}):`);
console.log(JSON.stringify(data, null, 2));
