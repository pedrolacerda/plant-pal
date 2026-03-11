import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import os from "os";
import path from "path";
import { writeFile, unlink } from "fs/promises";
import {
  startClient,
  stopClient,
  getOrCreateSession,
  clearSession,
  type PlantSummary,
} from "./agent.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";
const AGENT_API_KEY = process.env.AGENT_API_KEY;

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!AGENT_API_KEY) {
    // No API key configured – skip auth (development mode)
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  if (token !== AGENT_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface ChatRequestBody {
  userId: string;
  message: string;
  plants?: PlantSummary[];
  /** Raw base64-encoded image (no data-URL prefix) */
  imageBase64?: string;
  /** MIME type of the image, e.g. "image/jpeg" */
  imageMimeType?: string;
}

/** Map MIME type to file extension */
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[mime.toLowerCase()] ?? "jpg";
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health check */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /chat
 * Body: { userId, message, plants? }
 * Response: text/event-stream (SSE)
 *   data: { type: "delta", content: "..." }
 *   data: { type: "done" }
 *   data: { type: "error", message: "..." }
 */
app.post("/chat", requireAuth, async (req: Request, res: Response) => {
  const { userId, message, plants = [], imageBase64, imageMimeType } =
    req.body as ChatRequestBody;

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  if (!message && !imageBase64) {
    res.status(400).json({ error: "message or imageBase64 is required" });
    return;
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let tempImagePath: string | null = null;

  try {
    // Write image to a temp file so the SDK can attach it via file path
    if (imageBase64) {
      const ext = mimeToExt(imageMimeType ?? "image/jpeg");
      tempImagePath = path.join(os.tmpdir(), `plantbot-${Date.now()}.${ext}`);
      await writeFile(tempImagePath, Buffer.from(imageBase64, "base64"));
    }

    const session = await getOrCreateSession(userId, plants);

    // Subscribe to streaming deltas before sending the message
    const unsubDelta = session.on("assistant.message_delta", (event) => {
      sendEvent({ type: "delta", content: event.data.deltaContent });
    });

    // Also emit tool execution start/complete so the UI can show a thinking indicator
    const unsubToolStart = session.on("tool.execution_start", (event) => {
      sendEvent({ type: "tool_start", toolName: (event.data as { toolName?: string }).toolName ?? "tool" });
    });

    const unsubToolEnd = session.on("tool.execution_complete", (event) => {
      sendEvent({ type: "tool_end", toolName: (event.data as { toolName?: string }).toolName ?? "tool" });
    });

    // Wait for the session to finish processing
    await new Promise<void>((resolve, reject) => {
      const unsubIdle = session.on("session.idle", () => {
        unsubIdle();
        resolve();
      });

      // Build send options – attach image if a temp file was written
      const sendOptions: Parameters<typeof session.send>[0] = {
        prompt: message || "Please analyse this image.",
      };
      if (tempImagePath) {
        sendOptions.attachments = [
          { type: "file", path: tempImagePath },
        ];
      }

      session.send(sendOptions).catch(reject);
    });

    unsubDelta();
    unsubToolStart();
    unsubToolEnd();

    sendEvent({ type: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent] Chat error:", err);
    sendEvent({ type: "error", message });
  } finally {
    res.end();
    // Clean up temp image file regardless of success or failure
    if (tempImagePath) {
      unlink(tempImagePath).catch(() => {});
    }
  }
});

/**
 * DELETE /chat/:userId
 * Clears the session for a user (reset conversation).
 */
app.delete(
  "/chat/:userId",
  requireAuth,
  async (req: Request, res: Response) => {
    const userId = Array.isArray(req.params["userId"])
      ? req.params["userId"][0]
      : req.params["userId"];
    await clearSession(userId);
    res.json({ success: true });
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  try {
    await startClient();

    const server = app.listen(PORT, () => {
      console.log(`[agent] PlantBot server listening on http://localhost:${PORT}`);
      console.log(`[agent] CORS allowed origin: ${ALLOWED_ORIGIN}`);
      console.log(`[agent] Auth: ${AGENT_API_KEY ? "enabled" : "disabled (dev mode)"}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[agent] ${signal} received – shutting down...`);
      server.close(async () => {
        await stopClient();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("[agent] Failed to start:", err);
    process.exit(1);
  }
}

main();
