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
    const { plantName, light } = await req.json();
    const GITHUB_MODELS_API_KEY = Deno.env.get("VITE_GITHUB_MODELS_API_KEY");
    if (!GITHUB_MODELS_API_KEY) throw new Error("VITE_GITHUB_MODELS_API_KEY is not configured");

    const lightLabels: Record<string, string> = {
      low: "pouca luz",
      medium: "luz média",
      high: "muita luz",
    };

    const systemPrompt = `Você é um especialista em botânica e cuidados de plantas. Retorne informações de cuidados para plantas domésticas. Responda APENAS usando a tool fornecida.`;

    const userPrompt = `Planta: "${plantName}" em ambiente com ${lightLabels[light] || light}. Quais são os intervalos ideais de rega, adubação e spray/umidificação (em dias), a quantidade de água (em ml) por rega, a quantidade de fertilizante diluído (em ml) por adubação, e uma dica curta de cuidado?`;

    const response = await fetch("https://models.github.ai/inference/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_MODELS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "plant_care_info",
              description: "Return care intervals and a tip for the plant.",
              parameters: {
                type: "object",
                properties: {
                  waterDays: {
                    type: "number",
                    description: "Intervalo de rega em dias (ex: 3)",
                  },
                  waterAmount: {
                    type: "number",
                    description: "Quantidade de água por rega em ml (ex: 250)",
                  },
                  fertilizeDays: {
                    type: "number",
                    description: "Intervalo de adubação em dias (ex: 21)",
                  },
                  fertilizerAmount: {
                    type: "number",
                    description: "Quantidade de fertilizante diluído por adubação em ml (ex: 100)",
                  },
                  sprayDays: {
                    type: "number",
                    description: "Intervalo de spray/umidificação em dias (ex: 5)",
                  },
                  tip: {
                    type: "string",
                    description: "Dica curta de cuidado (máx 80 caracteres)",
                  },
                  fertilizerHint: {
                    type: "string",
                    description: "Indicação do tipo de fertilizante ideal para esta planta (ex: NPK 10-10-10, adubo orgânico rico em nitrogênio, calcário dolomítico). Máx 80 caracteres.",
                  },
                },
                required: ["waterDays", "waterAmount", "fertilizeDays", "fertilizerAmount", "sprayDays", "tip", "fertilizerHint"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "plant_care_info" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
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
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const careInfo = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(careInfo), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plant-care error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
