import { z } from "zod";

// Acepta "owner/repo" tal cual, pero también normaliza errores comunes:
// - ".git" al final (típico al copiar la URL de clonado)
// - la URL completa de GitHub (https://github.com/owner/repo)
// - espacios accidentales
function normalizeRepoFullName(value) {
  let cleaned = value.trim();

  const urlMatch = cleaned.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(\.git)?\/?$/i);
  if (urlMatch) {
    cleaned = urlMatch[1];
  }

  cleaned = cleaned.replace(/\.git$/i, "");

  return cleaned;
}

export const addRepositorySchema = z.object({
  fullName: z
    .string()
    .transform(normalizeRepoFullName)
    .pipe(z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Formato esperado: owner/repo (sin .git ni URL completa)")),
});

export const listRepositoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional().default(""),
  status: z.enum(["all", "healthy", "warning", "critical", "unknown"]).default("all"),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
