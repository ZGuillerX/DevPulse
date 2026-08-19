import { useState } from "react";
import type { Repository } from "@/types";
import "./RepositoryList.css";

interface Props {
  items: Repository[];
  pagination: { page: number; totalPages: number; total: number };
  search: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  onPageChange: (page: number) => void;
  onAddRepository: (fullName: string) => Promise<void>;
  onSyncRepository: (id: string) => Promise<void>;
  onOpenRepository: (id: string) => void;
  loading: boolean;
}

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "healthy", label: "Saludables" },
  { value: "warning", label: "Atención" },
  { value: "critical", label: "Críticos" },
];

export default function RepositoryList({
  items,
  pagination,
  search,
  onSearchChange,
  status,
  onStatusChange,
  onPageChange,
  onAddRepository,
  onSyncRepository,
  onOpenRepository,
  loading,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepo, setNewRepo] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!newRepo.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await onAddRepository(newRepo.trim());
      setNewRepo("");
      setShowAddForm(false);
    } catch (e: any) {
      setAddError(e?.message || "No se pudo agregar el repositorio. Verifica el nombre y que exista en tu cuenta.");
    } finally {
      setAdding(false);
    }
  }

  async function handleSync(id: string) {
    setSyncingId(id);
    try {
      await onSyncRepository(id);
    } finally {
      setSyncingId(null);
    }
  }

  return (
    <div className="repo-list-card">
      <div className="repo-list-toolbar">
        <input
          className="repo-search"
          placeholder="Buscar repositorio..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`repo-filter-btn ${status === f.value ? "repo-filter-btn--active" : ""}`}
            onClick={() => onStatusChange(f.value)}
          >
            {f.label}
          </button>
        ))}
        <button className="repo-add-btn" onClick={() => setShowAddForm((s) => !s)}>
          + Repositorio
        </button>
      </div>

      {showAddForm && (
        <div className="repo-add-form-wrapper">
          <div className="repo-add-form">
            <input
              className="repo-add-input"
              placeholder="owner/repo, URL o git@github.com:owner/repo.git"
              value={newRepo}
              onChange={(e) => {
                setNewRepo(e.target.value);
                if (addError) setAddError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button className="repo-add-btn" onClick={handleAdd} disabled={adding}>
              {adding ? "Agregando..." : "Agregar"}
            </button>
          </div>
          {addError && <p className="repo-add-error">{addError}</p>}
        </div>
      )}

      {loading && items.length === 0 && <div className="repo-list-empty">Cargando repositorios...</div>}

      {!loading && items.length === 0 && (
        <div className="repo-list-empty">No hay repositorios que coincidan. Agrega uno para empezar.</div>
      )}

      {items.length > 0 && (
        <div className="repo-list-rows">
          {items.map((repo) => (
            <div key={repo.id} className="repo-row">
              <span
                className="repo-row-health"
                style={{
                  color:
                    repo.latest_health_score === null
                      ? "var(--color-muted)"
                      : repo.latest_health_score >= 80
                      ? "var(--color-signal)"
                      : repo.latest_health_score >= 60
                      ? "var(--color-warn)"
                      : "var(--color-danger)",
                }}
              >
                {repo.latest_health_score ?? "—"}
              </span>
              <div className="repo-row-body" onClick={() => onOpenRepository(repo.id)}>
                <p className="repo-row-name">{repo.full_name}</p>
                {repo.description && <p className="repo-row-desc">{repo.description}</p>}
              </div>
              <div className="repo-row-actions">
                <button
                  className="repo-sync-btn"
                  onClick={() => handleSync(repo.id)}
                  disabled={syncingId === repo.id}
                >
                  {syncingId === repo.id ? "Sincronizando..." : "↻ Sync now"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="repo-pagination">
          <button
            className="repo-pagination-btn"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            ← Anterior
          </button>
          <span className="repo-pagination-info">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <button
            className="repo-pagination-btn"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
