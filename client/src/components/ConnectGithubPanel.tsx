import { useState, FormEvent } from "react";
import "./ConnectGithubPanel.css";

interface Props {
  onConnect: (token: string) => Promise<void>;
  onSkip?: () => void;
  error: string | null;
}

export default function ConnectGithubPanel({ onConnect, onSkip, error }: Props) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConnect(token.trim());
    } catch {
      // el error ya se refleja vía prop `error`
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="connect-github-page">
      <div className="connect-github-card">
        <div className="connect-github-icon">🐙</div>
        <h1 className="connect-github-title">Conecta tu GitHub</h1>
        <p className="connect-github-subtitle">
          Pega un Personal Access Token para que DevPulse pueda leer tus repos,
          PRs e issues. Se cifra antes de guardarse — solo tú puedes usarlo.
        </p>

        {error && <div className="connect-github-error">{error}</div>}

        <form className="connect-github-form" onSubmit={handleSubmit}>
          <label className="connect-github-label" htmlFor="pat">Personal Access Token</label>
          <input
            id="pat"
            type="password"
            required
            className="connect-github-input"
            placeholder="ghp_..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="connect-github-hint">
            Necesita el scope <code>repo</code>. Genéralo en{" "}
            <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer">
              github.com/settings/tokens/new
            </a>
          </p>
          <button className="connect-github-submit" type="submit" disabled={submitting || !token.trim()}>
            {submitting ? "Conectando..." : "Conectar GitHub"}
          </button>
        </form>

        {onSkip && (
          <button className="connect-github-skip" onClick={onSkip}>
            Hacerlo más tarde
          </button>
        )}
      </div>
    </div>
  );
}
