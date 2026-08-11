import type { Notification } from "@/types";
import "./NotificationsPanel.css";

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
}

function timeAgo(dateIso: string): string {
  const days = Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days}d`;
}

export default function NotificationsPanel({ notifications, onClose, onMarkRead }: Props) {
  return (
    <div className="notif-overlay" onClick={onClose}>
      <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notif-header">
          <span className="notif-title">Alertas</span>
          <button className="notif-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {notifications.length === 0 && <div className="notif-empty">No tienes alertas por ahora.</div>}

        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notif-item ${!n.read_at ? "notif-item--unread" : ""}`}
            onClick={() => !n.read_at && onMarkRead(n.id)}
          >
            <p className="notif-item-title">{n.title}</p>
            <p className="notif-item-body">{n.body}</p>
            <p className="notif-item-time">{timeAgo(n.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
