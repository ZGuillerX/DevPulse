import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setAuthToken } from "@/lib/api";

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      setAuthToken(token);
      navigate("/", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [params, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)" }}>
      Completando inicio de sesión...
    </div>
  );
}
