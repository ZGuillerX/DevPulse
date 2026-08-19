import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

// userId -> Set<WebSocket> — un usuario puede tener varias pestañas/sesiones
// abiertas a la vez. Todo en memoria, igual que cache.service.js: un solo
// proceso Node es suficiente para la escala de este proyecto; si algún día
// se corre en más de una instancia, esto necesitaría un pub/sub compartido
// (Redis, etc.) para que un push llegue a un socket conectado a OTRA instancia.
const connectionsByUser = new Map();

const HEARTBEAT_INTERVAL_MS = 30000;

function addConnection(userId, ws) {
  if (!connectionsByUser.has(userId)) connectionsByUser.set(userId, new Set());
  connectionsByUser.get(userId).add(ws);
}

function removeConnection(userId, ws) {
  const sockets = connectionsByUser.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) connectionsByUser.delete(userId);
}

// Llamado por alert.service.js justo después de insertar una notificación,
// para que le llegue al usuario al instante en vez de esperar el próximo
// poll (hasta 60s). Si el usuario no tiene ningún socket abierto, es un
// no-op silencioso — el polling normal sigue siendo la red de seguridad.
export function pushToUser(userId, event) {
  const sockets = connectionsByUser.get(userId);
  if (!sockets || sockets.size === 0) return;

  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

export function getConnectedUserCount() {
  return connectionsByUser.size;
}

function authenticate(request) {
  const url = new URL(request.url, "http://localhost");
  const token = url.searchParams.get("token");
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    if (!request.url.startsWith("/ws")) return; // deja pasar upgrades de otras rutas, si algún día las hay

    const user = authenticate(request);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.userId = user.id;
      ws.isAlive = true;
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    addConnection(ws.userId, ws);
    logger.debug("Cliente WebSocket conectado", { userId: ws.userId, total: getConnectedUserCount() });

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      removeConnection(ws.userId, ws);
      logger.debug("Cliente WebSocket desconectado", { userId: ws.userId });
    });

    ws.on("error", (err) => {
      logger.warn("Error en socket WebSocket", { userId: ws.userId, error: err.message });
    });
  });

  // Detecta y limpia conexiones muertas (ej. el cliente cerró el laptop sin
  // un close limpio) — sin esto, sockets a medio cerrar se acumulan.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(heartbeat));

  logger.info("Servidor WebSocket listo", { path: "/ws" });
  return wss;
}
