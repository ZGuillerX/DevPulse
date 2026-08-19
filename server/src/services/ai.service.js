import fetch from "node-fetch";
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

// Cada entrada sabe armar su propio request y extraer el texto de su propia
// respuesta — agregar un proveedor nuevo es agregar una entrada aquí, nada
// más. groq/openai comparten el formato "chat completions" de OpenAI; Claude
// tiene el suyo propio (Messages API).
async function callOpenAiCompatible({ url, model, apiKey, payload }) {
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
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content).brief;
}

async function callAnthropic({ apiKey, payload }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  if (!res.ok) throw new Error(`API respondió ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  return JSON.parse(text).brief;
}

export const AI_PROVIDERS = {
  groq: {
    label: "Groq",
    call: (apiKey, payload) =>
      callOpenAiCompatible({
        url: "https://api.groq.com/openai/v1/chat/completions",
        model: "openai/gpt-oss-120b",
        apiKey,
        payload,
      }),
  },
  openai: {
    label: "OpenAI",
    call: (apiKey, payload) =>
      callOpenAiCompatible({
        url: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o-mini",
        apiKey,
        payload,
      }),
  },
  anthropic: {
    label: "Anthropic",
    call: (apiKey, payload) => callAnthropic({ apiKey, payload }),
  },
};

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

// aiKeys: { groq?: string, openai?: string, anthropic?: string } — el usuario
// puede tener varias configuradas a la vez. Se intenta primero
// preferredProvider (si tiene clave), luego el resto en el orden en que
// aparecen en AI_PROVIDERS; solo cae a reglas si ninguna clave configurada
// funcionó (o no hay ninguna).
export async function generateDailyBrief({ userName, priorityItems, healthScores, aiKeys = {}, preferredProvider }) {
  const payload = {
    userName,
    healthScores: healthScores.map((h) => ({ repo: h.repoFullName, score: h.score, status: h.status })),
    priorityItems: priorityItems.slice(0, 8),
  };

  const candidates = [preferredProvider, ...Object.keys(AI_PROVIDERS)].filter(
    (id, i, arr) => id && AI_PROVIDERS[id] && arr.indexOf(id) === i
  );

  for (const providerId of candidates) {
    const apiKey = aiKeys[providerId];
    if (!apiKey) continue;

    try {
      const brief = await AI_PROVIDERS[providerId].call(apiKey, payload);
      return { brief, isFallback: false, provider: providerId };
    } catch (err) {
      logger.warn("Fallo generando brief con proveedor de IA, probando el siguiente", {
        provider: providerId,
        error: err.message,
      });
    }
  }

  logger.info("Sin proveedor de IA disponible o ninguno funcionó, usando brief basado en reglas");
  return fallbackBrief({ userName, priorityItems, healthScores });
}
