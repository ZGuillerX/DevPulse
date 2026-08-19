import fetch from "node-fetch";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Envía un correo vía la API REST de Resend (https://resend.com/docs/api-reference/emails/send-email).
// Sin RESEND_API_KEY configurada, se degrada a un no-op logueado — igual
// que ai.service.js hace con el Daily Brief cuando no hay clave de IA.
export async function sendAlertEmail({ to, subject, html }) {
  if (!config.email.resendApiKey) {
    logger.debug("RESEND_API_KEY no configurada, se omite envío de email", { to, subject });
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.email.resendApiKey}`,
      },
      body: JSON.stringify({ from: config.email.from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${body.slice(0, 200)}`);
    }

    logger.info("Email de alerta enviado", { to, subject });
    return { sent: true };
  } catch (err) {
    // Un email que no sale no debe tumbar la sincronización ni el resto
    // de las alertas — se loguea y se sigue con la notificación in-app.
    logger.warn("No se pudo enviar email de alerta", { to, subject, error: err.message });
    return { sent: false, error: err.message };
  }
}
