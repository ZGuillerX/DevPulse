import { logger } from "../utils/logger.js";

// Interfaz deliberadamente simple (get/set/del) para que, si en el futuro
// se necesita más escala, sea un cambio de implementación (Redis) sin tocar
// a quienes consumen este servicio.
const store = new Map();

export async function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  logger.debug("Cache hit", { key });
  return entry.value;
}

export async function cacheSet(key, value, ttlSeconds) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  logger.debug("Cache set", { key, ttlSeconds });
}

export async function cacheDel(key) {
  store.delete(key);
}

// Los listados (repos, PRs, issues...) cachean con sufijos dinámicos
// (paginación, búsqueda, filtros), así que una key exacta nunca los alcanza.
// Esto borra todas las entradas cuya key empiece con `prefix`.
export async function cacheDelPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export async function cacheWrap(key, ttlSeconds, fn) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  const fresh = await fn();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

// Único punto de invalidación tras cualquier mutación que afecte a un
// workspace (agregar/borrar/sincronizar repo, webhook de GitHub) — evita que
// cada caller tenga que recordar las keys exactas de cada caché relacionada.
export async function invalidateWorkspaceCaches(workspaceId) {
  await cacheDelPrefix(`repos:${workspaceId}`);
  await cacheDel(`dashboard:${workspaceId}`);
  logger.debug("Cachés de workspace invalidadas", { workspaceId });
}
