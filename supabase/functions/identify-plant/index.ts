import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Imagem não fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GITHUB_MODELS_API_KEY = Deno.env.get("VITE_GITHUB_MODELS_API_KEY");
    if (!GITHUB_MODELS_API_KEY) throw new Error("VITE_GITHUB_MODELS_API_KEY is not configured");

    const response = await fetch("https://models.github.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_MODELS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um botânico especialista em identificação de plantas. Analise a foto e identifique a planta. Responda APENAS usando a tool fornecida.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identifique esta planta na foto. Diga o nome popular em português, o nível de luz ideal (low, medium ou high), e uma confiança de 0 a 100.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "identify_plant",
              description: "Return the identified plant information.",
              parameters: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Nome popular da planta em português (ex: Samambaia, Monstera, Jiboia)",
                  },
                  scientificName: {
                    type: "string",
                    description: "Nome científico da planta (ex: Nephrolepis exaltata)",
                  },
                  light: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Nível de luz ideal: low, medium ou high",
                  },
                  confidence: {
                    type: "number",
                    description: "Confiança da identificação de 0 a 100",
                  },
                },
                required: ["name", "light", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "identify_plant" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao identificar planta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não conseguiu identificar a planta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("identify-plant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
