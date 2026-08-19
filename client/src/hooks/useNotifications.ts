import { useCallback, useEffect, useRef, useState } from "react";
import type { Notification } from "@/types";
import { apiRequest, isAuthenticated, getAuthToken } from "@/lib/api";

const MAX_RECONNECT_DELAY_MS = 30000;

function getWebSocketUrl(token: string): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws?token=${encodeURIComponent(token)}`;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUsRef = useRef(false);

  const load = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const data = await apiRequest<{ notifications: Notification[] }>("/notifications");
      setNotifications(data.notifications);
    } catch {
      // Silencioso: las notificaciones no son críticas para el flujo principal
    }
  }, []);

  useEffect(() => {
    load();
    // Sigue siendo la red de seguridad si el WebSocket de abajo se cae y
    // tarda en reconectar, o si se perdió algún mensaje.
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // Push en tiempo real: en cuanto se crea una alerta en el backend, llega
  // aquí sin esperar el próximo poll. Reconecta solo con backoff exponencial
  // si la conexión se cae de forma inesperada (no si el propio componente
  // se desmonta, ej. al hacer logout).
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    closedByUsRef.current = false;

    function connect() {
      const ws = new WebSocket(getWebSocketUrl(token!));
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "notification" && msg.notification) {
            setNotifications((prev) =>
              prev.some((n) => n.id === msg.notification.id) ? prev : [msg.notification, ...prev]
            );
          }
        } catch {
          // Mensaje no reconocido — se ignora en vez de romper la conexión.
        }
      };

      ws.onclose = () => {
        if (closedByUsRef.current) return;
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  async function markRead(id: string) {
    await apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return { notifications, unreadCount, markRead, refresh: load };
}
