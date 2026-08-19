import { useState, FormEvent } from "react";
import "./AuthForm.css";

interface Props {
  mode: "login" | "register";
  onSwitchMode: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
  error: string | null;
}

interface PasswordRequirement {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "Más de 8 caracteres", test: (pw) => pw.length > 8 },
  { label: "Al menos una mayúscula (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Al menos un número (0-9)", test: (pw) => /[0-9]/.test(pw) },
];

export default function AuthForm({ mode, onSwitchMode, onLogin, onRegister, error }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const passwordChecks = PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) }));
  const allRequirementsMet = passwordChecks.every((c) => c.met);
  const passwordsMatch = password === confirmPassword;
  const canSubmitRegister =
    allRequirementsMet && passwordsMatch && confirmPassword.length > 0 && email.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "register" && !canSubmitRegister) {
      setConfirmTouched(true);
      return;
    }
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
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "register" ? 9 : undefined}
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth-input-toggle"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <>
              <div className="auth-requirements">
                <p className="auth-requirements-title">Requisitos:</p>
                {passwordChecks.map((req) => (
                  <p
                    key={req.label}
                    className={`auth-requirement ${req.met ? "auth-requirement--met" : "auth-requirement--unmet"}`}
                  >
                    {req.met ? "✓" : "✕"} {req.label}
                  </p>
                ))}
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="confirmPassword">Repetir contraseña</label>
                <div className="auth-input-wrapper">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    className="auth-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
                {confirmTouched && confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="auth-mismatch">✕ Las contraseñas no coinciden</p>
                )}
                {confirmTouched && confirmPassword.length > 0 && passwordsMatch && (
                  <p className="auth-match">✓ Las contraseñas coinciden</p>
                )}
              </div>
            </>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={submitting || (mode === "register" && !canSubmitRegister)}
          >
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
