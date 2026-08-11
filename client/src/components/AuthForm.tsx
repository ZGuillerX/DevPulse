import { useState, FormEvent } from "react";
import "./AuthForm.css";

interface Props {
  mode: "login" | "register";
  onSwitchMode: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  error: string | null;
}

export default function AuthForm({ mode, onSwitchMode, onLogin, onRegister, error }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name);
      }
    } catch {
      // el error ya se refleja vía prop `error`
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-dot">
            <div className="auth-brand-dot-inner" />
          </div>
          <span className="auth-brand-name">DevPulse</span>
        </div>

        <h1 className="auth-title">{mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "Entra para ver qué necesita tu atención hoy." : "Empieza a monitorear tus repos en minutos."}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="name">Nombre</label>
              <input
                id="name"
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre Completo"
              />
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              required
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Espera..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button className="auth-switch-link" onClick={onSwitchMode}>
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </button>
        </p>
      </div>
    </div>
  );
}
