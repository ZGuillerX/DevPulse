import { useNavigate } from "react-router-dom";
import type { Workspace } from "@/types";
import { useDashboard } from "@/hooks/useDashboard";
import { useRepositories } from "@/hooks/useRepositories";
import PulseHeader from "@/components/PulseHeader";
import SummaryBar from "@/components/SummaryBar";
import RepositoryList from "@/components/RepositoryList";
import "./DashboardPage.css";

interface Props {
  workspace: Workspace | null;
  workspacesLoading: boolean;
}

export default function DashboardPage({ workspace, workspacesLoading }: Props) {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useDashboard(workspace?.id ?? null);
  const repos = useRepositories(workspace?.id ?? null);

  if (workspacesLoading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-empty-state">
          <p className="dashboard-empty-title">Cargando tu workspace...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-empty-state">
          <p className="dashboard-empty-title">No tienes ningún workspace todavía</p>
          <p className="dashboard-empty-text">
            Esto no debería pasar normalmente (se crea uno al registrarte). Intenta recargar la página;
            si persiste, puede ser un problema en el backend al crear el workspace inicial.
          </p>
        </div>
      </div>
    );
  }

  const hasRepos = repos.items.length > 0 || repos.search !== "" || repos.status !== "all";

  return (
    <div className="dashboard-page">
      {error && <div className="dashboard-error">{error}</div>}

      {!loading && data && data.summary.totalRepos === 0 ? (
        <div className="dashboard-empty-state">
          <p className="dashboard-empty-title">Conecta tu primer repositorio</p>
          <p className="dashboard-empty-text">
            Agrega un repo de GitHub abajo para empezar a ver su salud, PRs e issues priorizados.
          </p>
        </div>
      ) : (
        <>
          <PulseHeader
            brief={data?.brief ?? null}
            priorityItems={data?.priorityItems ?? []}
            loading={loading}
            onRefresh={refresh}
          />
          {data && <SummaryBar summary={data.summary} />}
        </>
      )}

      <RepositoryList
        items={repos.items}
        pagination={repos.pagination}
        search={repos.search}
        onSearchChange={repos.setSearch}
        status={repos.status}
        onStatusChange={repos.setStatus}
        onPageChange={repos.goToPage}
        onAddRepository={async (fullName) => {
          await repos.addRepository(fullName);
          refresh();
        }}
        onSyncRepository={async (id) => {
          await repos.syncRepository(id);
          refresh();
        }}
        onOpenRepository={(id) => navigate(`/repos/${id}`)}
        loading={repos.loading}
      />
    </div>
  );
}
