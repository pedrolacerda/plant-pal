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
    const { imageBase64, plantName } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Imagem não fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GITHUB_MODELS_API_KEY = Deno.env.get("VITE_GITHUB_MODELS_API_KEY");
    if (!GITHUB_MODELS_API_KEY) throw new Error("VITE_GITHUB_MODELS_API_KEY is not configured");

    const plantContext = plantName ? `A planta é uma "${plantName}".` : "";

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
              "Você é um fitopatologista especialista em doenças de plantas domésticas. Analise a foto da planta e identifique possíveis doenças, pragas ou problemas. Responda APENAS usando a tool fornecida.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise esta foto de planta e identifique se há alguma doença, praga ou problema visível. ${plantContext} Dê um diagnóstico e recomendações de tratamento.`,
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
              name: "diagnose_plant",
              description: "Return the diagnosis of the plant's health.",
              parameters: {
                type: "object",
                properties: {
                  healthy: {
                    type: "boolean",
                    description: "Se a planta parece saudável no geral",
                  },
                  diagnosis: {
                    type: "string",
                    description: "Diagnóstico principal (ex: 'Oídio', 'Cochonilha', 'Planta saudável'). Máximo 50 caracteres.",
                  },
                  severity: {
                    type: "string",
                    enum: ["healthy", "mild", "moderate", "severe"],
                    description: "Gravidade: healthy (saudável), mild (leve), moderate (moderada), severe (grave)",
                  },
                  details: {
                    type: "string",
                    description: "Explicação detalhada do que foi observado na planta. 1-3 frases.",
                  },
                  treatments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: {
                          type: "string",
                          description: "Ação de tratamento concisa (ex: 'Aplicar fungicida à base de enxofre')",
                        },
                        urgency: {
                          type: "string",
                          enum: ["immediate", "soon", "preventive"],
                          description: "Urgência: immediate (imediata), soon (em breve), preventive (preventiva)",
                        },
                      },
                      required: ["action", "urgency"],
                      additionalProperties: false,
                    },
                    description: "Lista de ações de tratamento recomendadas (1-5 itens)",
                  },
                },
                required: ["healthy", "diagnosis", "severity", "details", "treatments"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "diagnose_plant" } },
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
      return new Response(JSON.stringify({ error: "Erro ao diagnosticar planta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não conseguiu analisar a foto" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("diagnose-plant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
