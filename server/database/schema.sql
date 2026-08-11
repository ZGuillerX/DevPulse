-- DevPulse — esquema completo
-- Ejecutar en una base de datos vacía: CREATE DATABASE devpulse;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- USUARIOS Y AUTENTICACIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NULL,           -- NULL si el usuario solo usa GitHub OAuth
  name VARCHAR(255),
  avatar_url VARCHAR(500),
  github_id VARCHAR(50) UNIQUE NULL,
  github_username VARCHAR(255) NULL,
  github_access_token_encrypted TEXT NULL,   -- cifrado a nivel de aplicación, nunca en texto plano
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB;

-- ============================================================
-- WORKSPACES Y RBAC (punto 9)
-- ============================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workspace_members (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('owner', 'admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_workspace_user (workspace_id, user_id),
  INDEX idx_members_user (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- REPOSITORIOS Y SINCRONIZACIÓN (punto 4)
-- ============================================================

CREATE TABLE IF NOT EXISTS repositories (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NOT NULL,
  github_repo_id BIGINT NOT NULL,
  full_name VARCHAR(255) NOT NULL,           -- "owner/repo"
  owner VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  default_branch VARCHAR(100) DEFAULT 'main',
  is_private BOOLEAN DEFAULT FALSE,
  stars INT DEFAULT 0,
  open_issues_count INT DEFAULT 0,
  pushed_at TIMESTAMP NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE KEY uq_workspace_repo (workspace_id, github_repo_id),
  INDEX idx_repos_workspace (workspace_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sync_status (
  id VARCHAR(36) PRIMARY KEY,
  repository_id VARCHAR(36) NOT NULL,
  status ENUM('idle', 'in_progress', 'success', 'failed') NOT NULL DEFAULT 'idle',
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  error_message TEXT NULL,
  retry_count INT DEFAULT 0,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  INDEX idx_sync_repo (repository_id)
) ENGINE=InnoDB;

-- ============================================================
-- PULL REQUESTS, ISSUES, WORKFLOW RUNS
-- ============================================================

CREATE TABLE IF NOT EXISTS pull_requests (
  id VARCHAR(36) PRIMARY KEY,
  repository_id VARCHAR(36) NOT NULL,
  github_pr_id BIGINT NOT NULL,
  number INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  url VARCHAR(500) NOT NULL,
  author VARCHAR(255),
  is_draft BOOLEAN DEFAULT FALSE,
  review_decision VARCHAR(50) NULL,
  ci_status ENUM('success', 'failure', 'pending', 'unknown') DEFAULT 'unknown',
  derived_status ENUM('clean', 'changes_requested', 'checks_failing', 'stale', 'unknown') DEFAULT 'unknown',
  github_created_at TIMESTAMP NOT NULL,
  github_updated_at TIMESTAMP NOT NULL,
  state ENUM('open', 'closed', 'merged') DEFAULT 'open',
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE KEY uq_repo_pr (repository_id, github_pr_id),
  INDEX idx_pr_repo (repository_id),
  INDEX idx_pr_state (state)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS issues (
  id VARCHAR(36) PRIMARY KEY,
  repository_id VARCHAR(36) NOT NULL,
  github_issue_id BIGINT NOT NULL,
  number INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  url VARCHAR(500) NOT NULL,
  author VARCHAR(255),
  labels JSON,
  has_assignee BOOLEAN DEFAULT FALSE,
  milestone VARCHAR(255) NULL,
  github_created_at TIMESTAMP NOT NULL,
  github_updated_at TIMESTAMP NOT NULL,
  state ENUM('open', 'closed') DEFAULT 'open',
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE KEY uq_repo_issue (repository_id, github_issue_id),
  INDEX idx_issue_repo (repository_id),
  INDEX idx_issue_state (state)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workflow_runs (
  id VARCHAR(36) PRIMARY KEY,
  repository_id VARCHAR(36) NOT NULL,
  github_run_id BIGINT NOT NULL,
  name VARCHAR(255),
  branch VARCHAR(255),
  status VARCHAR(50),
  conclusion VARCHAR(50) NULL,
  url VARCHAR(500),
  github_updated_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE KEY uq_repo_run (repository_id, github_run_id),
  INDEX idx_run_repo (repository_id)
) ENGINE=InnoDB;

-- ============================================================
-- HEALTH ENGINE (punto 5) — histórico para gráficas (punto 12)
-- ============================================================

CREATE TABLE IF NOT EXISTS health_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  repository_id VARCHAR(36) NOT NULL,
  score INT NOT NULL,                        -- 0-100
  breakdown JSON NOT NULL,                    -- factores que sumaron/restaron, explicable
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  INDEX idx_health_repo_date (repository_id, captured_at)
) ENGINE=InnoDB;

-- ============================================================
-- ALERTAS (punto 8)
-- ============================================================

CREATE TABLE IF NOT EXISTS alert_settings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  ci_failure BOOLEAN DEFAULT TRUE,
  pr_waiting_days INT DEFAULT 3,
  issue_inactive_days INT DEFAULT 14,
  health_score_threshold INT DEFAULT 60,
  email_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE KEY uq_alert_user_workspace (user_id, workspace_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  workspace_id VARCHAR(36) NOT NULL,
  type ENUM('ci_failure', 'pr_waiting', 'issue_inactive', 'security_alert', 'health_drop') NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  url VARCHAR(500) NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_notif_user_unread (user_id, read_at)
) ENGINE=InnoDB;

-- ============================================================
-- AUDITORÍA (trazabilidad — buena práctica de seguridad)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(36) PRIMARY KEY,
  workspace_id VARCHAR(36) NULL,
  user_id VARCHAR(36) NULL,
  action VARCHAR(100) NOT NULL,               -- ej. "repo.added", "member.role_changed"
  metadata JSON,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_workspace (workspace_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
