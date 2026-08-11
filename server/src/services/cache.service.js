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

export async function cacheWrap(key, ttlSeconds, fn) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  const fresh = await fn();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
