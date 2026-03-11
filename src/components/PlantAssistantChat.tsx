import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, RotateCcw, Loader2, ChevronDown, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Plant } from "@/lib/plantCare";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageRole = "user" | "assistant";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  /** Data URL of attached image (user messages only) */
  imageDataUrl?: string;
  /** True while streaming a response */
  streaming?: boolean;
}

interface PendingImage {
  /** Raw base64 (no data-URL prefix) sent to the backend */
  base64: string;
  /** Full data URL used for preview */
  dataUrl: string;
  /** MIME type, e.g. "image/jpeg" */
  mimeType: string;
}

interface SSEEvent {
  type: "delta" | "done" | "error" | "tool_start" | "tool_end";
  content?: string;
  message?: string;
  toolName?: string;
}

interface Props {
  userId: string;
  plants: Plant[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? "http://localhost:3001";
const AGENT_API_KEY = import.meta.env.VITE_GITHUB_MODELS_API_KEY ?? "";

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (AGENT_API_KEY) headers["Authorization"] = `Bearer ${AGENT_API_KEY}`;
  return headers;
}

function plantSummaries(plants: Plant[]) {
  return plants.map((p) => ({
    id: p.id,
    name: p.name,
    light: p.light,
    tip: p.tip,
  }));
}

/** Parse SSE lines from a readable stream text chunk */
function* parseSSEChunk(chunk: string): Generator<SSEEvent> {
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data: ")) {
      try {
        yield JSON.parse(trimmed.slice(6)) as SSEEvent;
      } catch {
        // ignore malformed lines
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlantAssistantChat({ userId, plants }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  // Listen for suggestion chip clicks from the EmptyState sub-component
  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail;
      setInput(text);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    window.addEventListener("plantbot:suggestion", handler);
    return () => window.removeEventListener("plantbot:suggestion", handler);
  }, []);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so the same file can be re-selected after removal
      e.target.value = "";

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        // Strip the "data:<mime>;base64," prefix to get raw base64
        const base64 = dataUrl.split(",")[1];
        setPendingImage({ base64, dataUrl, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const appendDelta = useCallback((delta: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [
        ...prev.slice(0, -1),
        { ...last, content: last.content + delta },
      ];
    });
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;

    setInput("");
    const imageSnapshot = pendingImage;
    setPendingImage(null);
    setLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      imageDataUrl: imageSnapshot?.dataUrl,
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${AGENT_URL}/chat`, {
        method: "POST",
        headers: buildHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          userId,
          message: text || "Please analyse this image.",
          plants: plantSummaries(plants),
          imageBase64: imageSnapshot?.base64,
          imageMimeType: imageSnapshot?.mimeType,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        for (const event of parseSSEChunk(chunk)) {
          if (event.type === "delta" && event.content) {
            appendDelta(event.content);
          } else if (event.type === "tool_start") {
            setActiveTool(event.toolName ?? "tool");
          } else if (event.type === "tool_end") {
            setActiveTool(null);
          } else if (event.type === "error") {
            appendDelta(
              `\n\n_Error: ${event.message ?? "something went wrong"}_`
            );
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const errMsg =
          err instanceof Error ? err.message : "Connection failed";
        appendDelta(`\n\n_Error: ${errMsg}_`);
      }
    } finally {
      // Mark streaming complete
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { ...last, streaming: false }];
        }
        return prev;
      });
      setLoading(false);
      setActiveTool(null);
      abortRef.current = null;
    }
  }, [input, loading, userId, plants, pendingImage, appendDelta]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReset = async () => {
    if (loading) {
      abortRef.current?.abort();
    }
    try {
      await fetch(`${AGENT_URL}/chat/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: buildHeaders(),
      });
    } catch {
      // best-effort
    }
    setMessages([]);
    setInput("");
    setPendingImage(null);
    setLoading(false);
    setActiveTool(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close PlantBot" : "Open PlantBot"}
        className={[
          "fixed bottom-20 right-4 z-50",
          "flex items-center justify-center",
          "w-14 h-14 rounded-full shadow-lg",
          "transition-all duration-200 active:scale-95",
          open
            ? "bg-emerald-600 text-white"
            : "bg-emerald-500 text-white hover:bg-emerald-600",
        ].join(" ")}
      >
        {open ? (
          <ChevronDown className="w-6 h-6" />
        ) : (
          <Bot className="w-6 h-6" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={[
            "fixed bottom-36 right-4 z-50",
            "w-[calc(100vw-2rem)] max-w-sm",
            "bg-background border border-border rounded-2xl shadow-xl",
            "flex flex-col overflow-hidden",
          ].join(" ")}
          style={{ height: "min(70vh, 520px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-emerald-50 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-sm text-foreground">
                PlantBot
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 dark:text-emerald-400"
              >
                AI
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleReset}
                title="Nova conversa"
                aria-label="Nova conversa"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as React.Ref<HTMLDivElement>}>
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                {activeTool && (
                  <ToolIndicator toolName={activeTool} />
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="px-3 py-2 border-t border-border bg-background">
            {/* Image preview strip */}
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative inline-block">
                  <img
                    src={pendingImage.dataUrl}
                    alt="Imagem anexada"
                    className="h-16 w-16 rounded-lg object-cover border border-border"
                  />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                    aria-label="Remover imagem"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">Imagem pronta para enviar</span>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
                aria-label="Anexar imagem"
              />
              {/* Attach image button */}
              <Button
                variant="ghost"
                size="icon"
                type="button"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-emerald-600"
                aria-label="Anexar imagem"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre suas plantas…"
                disabled={loading}
                rows={1}
                className="resize-none min-h-[40px] max-h-[100px] text-sm py-2.5"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={(!input.trim() && !pendingImage) || loading}
                className="h-10 w-10 shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white"
                aria-label="Enviar"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Powered by GitHub Copilot · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  const suggestions = [
    "Minha Monstera está com folhas amarelas",
    "Como cuidar de um Cacto no verão?",
    "Que vaso preciso para melhorar drenagem?",
  ];

  return (
    <div className="flex flex-col items-center text-center px-2 py-4 gap-4">
      <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
        <span className="text-3xl">🌿</span>
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">Olá! Sou o PlantBot</p>
        <p className="text-xs text-muted-foreground mt-1">
          Posso ajudar com diagnósticos, cuidados, e acessórios para suas plantas.
        </p>
      </div>
      <div className="w-full space-y-1.5">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
          Experimente perguntar
        </p>
        {suggestions.map((s) => (
          <SuggestionChip key={s} text={s} />
        ))}
      </div>
    </div>
  );
}

function SuggestionChip({ text }: { text: string }) {
  // Clicking a suggestion pre-fills the textarea — we use a custom event
  // because the textarea ref is in the parent; this is simpler than prop-drilling.
  const handleClick = () => {
    // Dispatch a custom DOM event that the parent component listens to
    window.dispatchEvent(
      new CustomEvent("plantbot:suggestion", { detail: { text } })
    );
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-accent/50 hover:bg-accent text-foreground transition-colors"
    >
      {text}
    </button>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-emerald-500 text-white rounded-br-sm"
            : "bg-accent text-foreground rounded-bl-sm",
        ].join(" ")}
      >
        {/* Image attachment (user messages only) */}
        {message.imageDataUrl && (
          <img
            src={message.imageDataUrl}
            alt="Imagem enviada"
            className="rounded-lg mb-2 max-h-48 w-auto object-cover"
          />
        )}
        {message.content ? (
          <FormattedContent content={message.content} isUser={isUser} />
        ) : !message.imageDataUrl ? (
          <span className="flex gap-1 py-0.5">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
          </span>
        ) : null}
        {message.streaming && message.content && (
          <span className="inline-block w-1 h-3.5 bg-current align-middle ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}

/**
 * Render simple markdown-ish formatting inside bubbles.
 * We use a minimal approach (no heavy markdown parser) to keep bundle size small.
 */
function FormattedContent({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  if (isUser) return <span>{content}</span>;

  // Split on double-newlines to get paragraphs, render line breaks within
  const paragraphs = content.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, i) => {
        // Numbered list
        if (/^\d+\.\s/.test(para)) {
          const items = para.split(/\n(?=\d+\.\s)/);
          return (
            <ol key={i} className="list-decimal list-inside space-y-0.5 my-1">
              {items.map((item, j) => (
                <li key={j} className="text-sm">
                  {item.replace(/^\d+\.\s/, "")}
                </li>
              ))}
            </ol>
          );
        }
        // Bullet list
        if (/^[•\-]\s/.test(para)) {
          const items = para.split(/\n(?=[•\-]\s)/);
          return (
            <ul key={i} className="list-disc list-inside space-y-0.5 my-1">
              {items.map((item, j) => (
                <li key={j} className="text-sm">
                  {item.replace(/^[•\-]\s/, "")}
                </li>
              ))}
            </ul>
          );
        }
        // Bold text (between **)
        const rendered = para.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            part
          )
        );

        return (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>
            {rendered}
          </p>
        );
      })}
    </>
  );
}

function ToolIndicator({ toolName }: { toolName: string }) {
  const labels: Record<string, string> = {
    identify_disease: "Diagnosticando…",
    get_care_routine: "Consultando cuidados…",
    recommend_accessories: "Buscando acessórios…",
  };

  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 bg-accent rounded-full px-3 py-1.5">
        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
        <span className="text-xs text-muted-foreground">
          {labels[toolName] ?? "Processando…"}
        </span>
      </div>
    </div>
  );
}
