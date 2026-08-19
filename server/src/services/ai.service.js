import fetch from "node-fetch";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

const SYSTEM_PROMPT = `
Eres el motor de "Daily Engineering Brief" de DevPulse. Recibes el Health Score
y la lista de prioridades de los repos de un desarrollador y escribes un
mensaje breve, directo, en ESPAÑOL, tono de compañero de equipo (no reporte
corporativo), que le diga qué necesita su atención hoy y por qué.

Reglas:
- Máximo 4-5 oraciones.
- Empieza con un saludo breve usando el nombre si se provee.
- Menciona el problema más urgente primero y explica POR QUÉ es prioritario
  (ej. "porque está bloqueando el pipeline", no solo "está fallando").
- Si no hay nada urgente, dilo claramente y de forma positiva.
- No inventes datos que no estén en el JSON recibido.

Responde EXCLUSIVAMENTE en JSON, sin texto fuera de él:
{ "brief": "string" }
`;

function fallbackBrief({ userName, priorityItems, healthScores }) {
  const greeting = userName ? `Buenos días, ${userName}.` : "Buenos días.";
  const avgHealth =
    healthScores.length > 0
      ? Math.round(healthScores.reduce((a, h) => a + h.score, 0) / healthScores.length)
      : null;

  if (priorityItems.length === 0) {
    return {
      brief: `${greeting} No hay nada urgente en tus repos ahora mismo${
        avgHealth ? ` (salud promedio: ${avgHealth}/100)` : ""
      }. Buen momento para avanzar en lo tuyo.`,
      isFallback: true,
    };
  }

  const top = priorityItems[0];
  return {
    brief: `${greeting} Tienes ${priorityItems.length} elemento(s) que requieren atención. Lo más urgente: "${top.title}" en ${top.repo} — ${top.reason}`,
    isFallback: true,
  };
}

export async function generateDailyBrief({ userName, priorityItems, healthScores, provider, apiKey }) {
  if (!apiKey) {
    logger.info("Sin clave de IA configurada, usando brief basado en reglas");
    return fallbackBrief({ userName, priorityItems, healthScores });
  }

  const payload = {
    userName,
    healthScores: healthScores.map((h) => ({ repo: h.repoFullName, score: h.score, status: h.status })),
    priorityItems: priorityItems.slice(0, 8),
  };

  try {
    const url =
      provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";
    const model = provider === "openai" ? "gpt-4o-mini" : "openai/gpt-oss-120b";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`AI API respondió ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return { brief: parsed.brief, isFallback: false };
  } catch (err) {
    logger.error("Fallo generando brief con IA, usando fallback", { error: err.message });
    return fallbackBrief({ userName, priorityItems, healthScores });
  }
}
