import { useEffect, useState } from "react";
import type { Role, Workspace } from "@/types";
import { setAiKey, getStoredAiKey } from "@/lib/api";
import { useGithubConnection } from "@/hooks/useGithubConnection";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useAlertSettings } from "@/hooks/useAlertSettings";
import "./SettingsPanel.css";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Miembro",
  viewer: "Viewer",
};

interface Props {
  workspace: Workspace | null;
  currentUserId: string | null;
  onClose: () => void;
}

export default function SettingsPanel({ workspace, currentUserId, onClose }: Props) {
  const github = useGithubConnection(true);
  const members = useWorkspaceMembers(workspace?.id ?? null);
  const canManageMembers = workspace?.role === "owner" || workspace?.role === "admin";
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const ownerCount = members.members.filter((m) => m.role === "owner").length;

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      await members.inviteMember(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
    } catch (e: any) {
      setInviteError(e?.message || "No se pudo invitar a ese correo.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    setMemberActionError(null);
    try {
      await members.updateRole(userId, role);
    } catch (e: any) {
      setMemberActionError(e?.message || "No se pudo cambiar el rol.");
    }
  }

  async function handleRemove(userId: string) {
    setMemberActionError(null);
    try {
      await members.removeMember(userId);
    } catch (e: any) {
      setMemberActionError(e?.message || "No se pudo quitar al miembro.");
    }
  }
  const [patInput, setPatInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState<"groq" | "openai">(
    (localStorage.getItem("devpulse:aiProvider") as "groq" | "openai") || "groq"
  );
  const [aiKey, setAiKeyLocal] = useState(getStoredAiKey());

  const alertSettings = useAlertSettings(workspace?.id ?? null);
  const [ciFailure, setCiFailure] = useState(true);
  const [prWaitingDays, setPrWaitingDays] = useState(3);
  const [issueInactiveDays, setIssueInactiveDays] = useState(14);
  const [healthThreshold, setHealthThreshold] = useState(60);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertSaveError, setAlertSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCiFailure(alertSettings.settings.ci_failure);
    setPrWaitingDays(alertSettings.settings.pr_waiting_days);
    setIssueInactiveDays(alertSettings.settings.issue_inactive_days);
    setHealthThreshold(alertSettings.settings.health_score_threshold);
    setEmailEnabled(alertSettings.settings.email_enabled);
  }, [alertSettings.settings]);

  async function handleConnectGithub() {
    if (!patInput.trim()) return;
    setConnecting(true);
    try {
      await github.connect(patInput.trim());
      setPatInput("");
    } catch {
      // el error ya se refleja vía github.error
    } finally {
      setConnecting(false);
    }
  }

  async function handleSave() {
    localStorage.setItem("devpulse:aiProvider", provider);
    setAiKey(aiKey);

    setSavingAlerts(true);
    setAlertSaveError(null);
    try {
      await alertSettings.save({
        ci_failure: ciFailure,
        pr_waiting_days: prWaitingDays,
        issue_inactive_days: issueInactiveDays,
        health_score_threshold: healthThreshold,
        email_enabled: emailEnabled,
      });
      onClose();
    } catch (e: any) {
      setAlertSaveError(e?.message || "No se pudieron guardar los umbrales de alerta.");
    } finally {
      setSavingAlerts(false);
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Configuración</h2>
          <button className="settings-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-section">
          <label className="settings-label">Cuenta de GitHub</label>
          {github.status?.connected ? (
            <>
              <p style={{ color: "var(--color-signal)", fontSize: 13, marginBottom: 8 }}>
                ✓ Conectado como {github.status.githubUsername}
              </p>
              <button
                className="settings-provider-btn"
                onClick={async () => {
                  await github.disconnect();
                }}
              >
                Desconectar
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="settings-input"
                  type="password"
                  placeholder="ghp_..."
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                />
                <button className="settings-provider-btn" onClick={handleConnectGithub} disabled={connecting}>
                  {connecting ? "Conectando..." : "Conectar"}
                </button>
              </div>
              {github.error && (
                <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 6 }}>{github.error}</p>
              )}
              <p className="settings-hint">
                Necesita scope <code>repo</code>. Genéralo en{" "}
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer">
                  github.com/settings/tokens/new
                </a>
              </p>
            </>
          )}
        </div>

        <div className="settings-section">
          <label className="settings-label">Miembros del workspace</label>

          {members.loading && members.members.length === 0 && (
            <p className="settings-hint">Cargando miembros...</p>
          )}

          {members.members.length > 0 && (
            <div className="settings-members-list">
              {members.members.map((m) => {
                const isSelf = m.id === currentUserId;
                const isLastOwner = m.role === "owner" && ownerCount <= 1;
                const locked = isSelf || isLastOwner;
                return (
                  <div key={m.id} className="settings-member-row">
                    <div className="settings-member-info">
                      <p className="settings-member-name">{m.name || m.email}</p>
                      <p className="settings-member-email">{m.email}</p>
                    </div>
                    {canManageMembers && !locked ? (
                      <div className="settings-member-actions">
                        <select
                          className="settings-member-role-select"
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                        >
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <button
                          className="settings-member-remove"
                          onClick={() => handleRemove(m.id)}
                          title="Quitar del workspace"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="settings-member-role-badge">
                        {ROLE_LABELS[m.role]}
                        {isSelf ? " (tú)" : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {members.error && <p style={{ color: "var(--color-danger)", fontSize: 12 }}>{members.error}</p>}
          {memberActionError && (
            <p style={{ color: "var(--color-danger)", fontSize: 12 }}>{memberActionError}</p>
          )}

          {canManageMembers && (
            <div className="settings-invite-row">
              <input
                className="settings-input"
                type="email"
                placeholder="correo@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  if (inviteError) setInviteError(null);
                }}
              />
              <select
                className="settings-member-role-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                <option value="viewer">Viewer</option>
                <option value="member">Miembro</option>
                <option value="admin">Admin</option>
              </select>
              <button className="settings-provider-btn" onClick={handleInvite} disabled={inviting}>
                {inviting ? "Invitando..." : "Invitar"}
              </button>
            </div>
          )}
          {inviteError && (
            <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 6 }}>{inviteError}</p>
          )}
          <p className="settings-hint">
            La persona invitada ya debe tener una cuenta en DevPulse con ese correo.
          </p>
        </div>

        <div className="settings-section">
          <label className="settings-label">Resumen con IA (Daily Brief)</label>
          <div className="settings-provider-row">
            {(["groq", "openai"] as const).map((p) => (
              <button
                key={p}
                className={`settings-provider-btn ${provider === p ? "settings-provider-btn--active" : ""}`}
                onClick={() => setProvider(p)}
              >
                {p === "groq" ? "Groq" : "OpenAI"}
              </button>
            ))}
          </div>
          <input
            className="settings-input"
            type="password"
            placeholder={provider === "groq" ? "gsk_..." : "sk-..."}
            value={aiKey}
            onChange={(e) => setAiKeyLocal(e.target.value)}
          />
          <p className="settings-hint">
            Sin esta clave, el Daily Brief se genera con reglas automáticas — sigue funcionando, solo sin lenguaje natural.
          </p>
        </div>

        <div className="settings-section">
          <label className="settings-label">Umbrales de alerta</label>
          <div className="settings-alert-row">
            <input type="checkbox" checked={ciFailure} onChange={(e) => setCiFailure(e.target.checked)} />
            <span>Avisarme cuando falle el CI</span>
          </div>
          <div className="settings-alert-row">
            <span>PR esperando revisión más de</span>
            <input
              type="number"
              value={prWaitingDays}
              onChange={(e) => setPrWaitingDays(Number(e.target.value))}
            />
            <span>días</span>
          </div>
          <div className="settings-alert-row">
            <span>Issue inactivo más de</span>
            <input
              type="number"
              value={issueInactiveDays}
              onChange={(e) => setIssueInactiveDays(Number(e.target.value))}
            />
            <span>días</span>
          </div>
          <div className="settings-alert-row">
            <span>Alertar si el Health Score baja de</span>
            <input
              type="number"
              value={healthThreshold}
              onChange={(e) => setHealthThreshold(Number(e.target.value))}
            />
          </div>
          <div className="settings-alert-row">
            <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
            <span>Avisarme también por email</span>
          </div>
          {alertSaveError && (
            <p style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 6 }}>{alertSaveError}</p>
          )}
        </div>

        <button className="settings-save" onClick={handleSave} disabled={savingAlerts}>
          {savingAlerts ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
