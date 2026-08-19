export type Role = "owner" | "admin" | "member" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url?: string | null;
  github_username?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  role: Role;
}

export interface Repository {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  description: string | null;
  stars: number;
  open_issues_count: number;
  pushed_at: string | null;
  latest_health_score: number | null;
}

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface HealthFactor {
  factor: string;
  points: number;
  reason: string;
}

export interface HealthSnapshot {
  score: number;
  status: HealthStatus;
  breakdown: HealthFactor[];
  captured_at?: string;
}

export type DerivedPRStatus = "clean" | "changes_requested" | "checks_failing" | "stale" | "unknown";

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  author: string;
  is_draft: boolean;
  review_decision: string | null;
  ci_status: "success" | "failure" | "pending" | "unknown";
  derived_status: DerivedPRStatus;
  github_created_at: string;
  github_updated_at: string;
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  url: string;
  author: string;
  labels: string[];
  has_assignee: boolean;
  github_created_at: string;
  github_updated_at: string;
}

export type Urgency = "alta" | "media" | "baja";

export interface PriorityItem {
  type: "pr" | "issue" | "ci" | "security";
  repo: string;
  refId: string;
  title: string;
  url: string;
  reason: string;
  urgency: Urgency;
}

export interface DailyBrief {
  brief: string;
  isFallback?: boolean;
}

export interface DashboardSummary {
  totalRepos: number;
  openPRs: number;
  openIssues: number;
  failingCI: number;
  avgHealth: number | null;
}

export interface DashboardData {
  repos: Repository[];
  healthScores: { repoFullName: string; score: number; status: HealthStatus }[];
  priorityItems: PriorityItem[];
  summary: DashboardSummary;
  brief: DailyBrief;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: Role;
}

export interface AlertSettings {
  ci_failure: boolean;
  pr_waiting_days: number;
  issue_inactive_days: number;
  health_score_threshold: number;
  email_enabled: boolean;
}
