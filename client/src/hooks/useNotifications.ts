import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@/types";
import { apiRequest, isAuthenticated } from "@/lib/api";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

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
    const interval = setInterval(load, 60000); // poll cada minuto
    return () => clearInterval(interval);
  }, [load]);

  async function markRead(id: string) {
    await apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return { notifications, unreadCount, markRead, refresh: load };
}
