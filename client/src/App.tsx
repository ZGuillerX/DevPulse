import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useNotifications } from "@/hooks/useNotifications";
import { useGithubConnection } from "@/hooks/useGithubConnection";
import AuthForm from "@/components/AuthForm";
import ConnectGithubPanel from "@/components/ConnectGithubPanel";
import TopBar from "@/components/TopBar";
import SettingsPanel from "@/components/SettingsPanel";
import NotificationsPanel from "@/components/NotificationsPanel";
import DashboardPage from "@/pages/DashboardPage";
import RepositoryPage from "@/pages/RepositoryPage";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import "./App.css";

function AuthenticatedApp() {
  const auth = useAuth();
  const { workspaces, active, activeId, selectWorkspace, loading: workspacesLoading } = useWorkspaces(
    Boolean(auth.user)
  );
  const { notifications, unreadCount, markRead } = useNotifications();
  const github = useGithubConnection(Boolean(auth.user));
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [skippedGithub, setSkippedGithub] = useState(
    () => localStorage.getItem("devpulse:skippedGithubConnect") === "true"
  );

  function handleSkipGithub() {
    localStorage.setItem("devpulse:skippedGithubConnect", "true");
    setSkippedGithub(true);
  }

  if (auth.loading) {
    return <div className="app-loading">Cargando DevPulse...</div>;
  }

  if (!auth.user) {
    return (
      <AuthForm
        mode={authMode}
        onSwitchMode={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
        onLogin={auth.login}
        onRegister={auth.register}
        error={auth.error}
      />
    );
  }

  if (!github.loading && github.status && !github.status.connected && !skippedGithub) {
    return (
      <ConnectGithubPanel
        onConnect={github.connect}
        onSkip={handleSkipGithub}
        error={github.error}
      />
    );
  }

  return (
    <div className="app-shell">
      <TopBar
        workspaces={workspaces}
        activeId={activeId}
        onSelectWorkspace={selectWorkspace}
        unreadCount={unreadCount}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenSettings={() => setShowSettings(true)}
        onLogout={auth.logout}
      />

      <Routes>
        <Route path="/" element={<DashboardPage workspace={active} workspacesLoading={workspacesLoading} />} />
        <Route path="/repos/:repositoryId" element={<RepositoryPage workspace={active} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showSettings && (
        <SettingsPanel workspace={active} currentUserId={auth.user?.id ?? null} onClose={() => setShowSettings(false)} />
      )}
      {showNotifications && (
        <NotificationsPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkRead={markRead}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
