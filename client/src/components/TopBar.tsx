import type { Workspace } from "@/types";
import "./TopBar.css";

interface Props {
  workspaces: Workspace[];
  activeId: string | null;
  onSelectWorkspace: (id: string) => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export default function TopBar({
  workspaces,
  activeId,
  onSelectWorkspace,
  unreadCount,
  onOpenNotifications,
  onOpenSettings,
  onLogout,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <div className="topbar-dot">
            <div className="topbar-dot-inner" />
          </div>
          <span className="topbar-name">DevPulse</span>
        </div>

        <div className="topbar-right">
          {workspaces.length > 0 && (
            <select
              className="topbar-workspace-select"
              value={activeId ?? ""}
              onChange={(e) => onSelectWorkspace(e.target.value)}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}

          <button className="topbar-link" onClick={onOpenNotifications}>
            🔔 Alertas
            {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
          </button>

          <button className="topbar-link" onClick={onOpenSettings}>
            ⚙ Configuración
          </button>

          <button className="topbar-link" onClick={onLogout}>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
