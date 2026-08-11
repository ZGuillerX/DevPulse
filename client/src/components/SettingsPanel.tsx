import { useState } from "react";
import { setAiKey, getStoredAiKey } from "@/lib/api";
import { useGithubConnection } from "@/hooks/useGithubConnection";
import "./SettingsPanel.css";

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const github = useGithubConnection(true);
  const [patInput, setPatInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState<"groq" | "openai">(
    (localStorage.getItem("devpulse:aiProvider") as "groq" | "openai") || "groq"
  );
  const [aiKey, setAiKeyLocal] = useState(getStoredAiKey());
  const [prWaitingDays, setPrWaitingDays] = useState(3);
  const [issueInactiveDays, setIssueInactiveDays] = useState(14);
  const [healthThreshold, setHealthThreshold] = useState(60);

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

  function handleSave() {
    localStorage.setItem("devpulse:aiProvider", provider);
    setAiKey(aiKey);
    // Los umbrales de alerta se guardarían vía POST /api/workspaces/:id/alert-settings
    // (endpoint disponible en el backend, se conecta cuando el usuario confirma su workspace activo)
    onClose();
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
        </div>

        <button className="settings-save" onClick={handleSave}>
          Guardar
        </button>
      </div>
    </div>
  );
}
