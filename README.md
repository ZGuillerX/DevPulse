# DevPulse

Dashboard de salud de proyectos para freelancers y equipos pequeños con
varios repositorios activos en GitHub. Responde una pregunta central cada
mañana: **¿qué necesita mi atención hoy?**

Centraliza pull requests, issues y estado de CI de todos tus repos, calcula
un **Health Score explicable** por repositorio, y genera un resumen
priorizado (con o sin IA) de lo que realmente importa resolver primero.

---

## Índice

- [¿Qué es DevPulse?](#qué-es-devpulse)
- [Features](#features)
- [Arquitectura](#arquitectura)
- [Stack técnico](#stack-técnico)
- [Esquema de base de datos](#esquema-de-base-de-datos)
- [Autenticación](#autenticación)
- [Integración con GitHub](#integración-con-github)
- [Webhooks](#webhooks)
- [Health Score](#health-score)
- [Sistema de IA (Daily Brief)](#sistema-de-ia-daily-brief)
- [Documentación de la API](#documentación-de-la-api)
- [Variables de entorno](#variables-de-entorno)
- [Desarrollo local](#desarrollo-local)
- [Docker](#docker)
- [Testing](#testing)
- [Despliegue](#despliegue)

---

## ¿Qué es DevPulse?

Herramientas como Linear o GitHub Projects existen para equipos grandes,
pero no hay algo simple y personal para alguien con 3-5 repos activos que
solo necesita saber, de un vistazo, qué está roto o esperando su atención.

## Features

- **Health Score por repo** (0-100), calculado con factores explicables
  (CI funcionando, PRs sin revisión, issues antiguos, vulnerabilidades) —
  nunca es una caja negra.
- **Sistema de prioridades** que ordena PRs, issues y fallos de CI por
  urgencia real, con la razón específica de por qué importa cada uno.
- **Daily Engineering Brief**: resumen en lenguaje natural generado por IA
  (Groq u OpenAI), con degradación elegante a reglas automáticas si no hay
  clave configurada.
- **Sincronización dual**: polling periódico + webhooks de GitHub, con
  botón manual "Sync now" y estado observable (idle/en progreso/fallido).
- **Workspaces multiusuario con RBAC** (owner/admin/member/viewer).
- **Alertas configurables** por umbral (CI roto, PR esperando X días, issue
  inactivo, Health Score bajo).
- **Búsqueda, filtros y paginación** sobre la lista de repositorios.
- **Histórico de Health Score** con gráfica de tendencia.
- **Auditoría**: cada acción sensible (agregar repo, cambiar roles) queda
  registrada en `audit_events`.

## Arquitectura

```
devpulse-pro/
├── server/                      Node.js + Express + MySQL
│   ├── src/
│   │   ├── config/               env, pool de MySQL
│   │   ├── models/                capa de acceso a datos (SQL)
│   │   ├── controllers/           lógica de cada endpoint
│   │   ├── routes/                definición de rutas REST
│   │   ├── services/               lógica de negocio pura:
│   │   │   ├── health.service.js        Health Engine (con tests)
│   │   │   ├── prStatus.service.js      estado derivado de PRs (con tests)
│   │   │   ├── priority.service.js      qué necesita atención y por qué
│   │   │   ├── github.service.js        cliente de GitHub REST API
│   │   │   ├── sync.service.js          orquesta fetch + persistencia
│   │   │   ├── ai.service.js            Daily Brief (Groq/OpenAI + fallback)
│   │   │   ├── alert.service.js         umbrales y notificaciones
│   │   │   └── cache.service.js         caché en memoria (TTL)
│   │   ├── middleware/             auth (JWT+RBAC), rate limit, validación,
│   │   │                            logging con request-id, error handler
│   │   ├── jobs/                   sync periódico (respaldo de webhooks)
│   │   └── utils/                  logger estructurado, cifrado AES-256-GCM
│   └── database/schema.sql
│
├── client/                      React + TypeScript + Vite
│   └── src/
│       ├── components/            un .css por componente, sin Tailwind
│       ├── pages/                 Dashboard, Repository, OAuth callback
│       ├── hooks/                  useAuth, useDashboard, useRepositories...
│       ├── lib/                    cliente API (fetch + manejo de errores)
│       └── types/                  tipos compartidos con el backend
│
├── docker-compose.yml            server + client + mysql
└── .github/workflows/ci.yml       lint, test, build, docker build
```

**Separación de responsabilidades**: los `services/` contienen lógica pura,
testeable sin base de datos ni red (`health.service.js` y
`prStatus.service.js` tienen tests unitarios reales). Los `controllers/`
orquestan HTTP + servicios + modelos. Los `models/` son la única capa que
toca SQL directamente.

## Stack técnico

**Backend**: Node.js, Express, MySQL (mysql2), JWT, bcrypt, Zod, Helmet,
express-rate-limit, node-fetch.

**Frontend**: React 18, TypeScript, Vite, react-router-dom, CSS puro por
componente (sin frameworks de utilidades).

## Esquema de base de datos

Tablas principales (ver `server/database/schema.sql` completo):

- `users`, `sessions` — autenticación local + OAuth de GitHub
- `workspaces`, `workspace_members` — RBAC con roles owner/admin/member/viewer
- `repositories`, `sync_status` — repos rastreados y su estado de sincronización
- `pull_requests`, `issues`, `workflow_runs` — datos crudos + estado derivado
- `health_snapshots` — histórico de Health Score, con `breakdown` en JSON
- `alert_settings`, `notifications` — configuración y alertas generadas
- `audit_events` — trazabilidad de acciones sensibles

## Autenticación

Dos flujos soportados:

1. **Email + contraseña**: registro/login local con bcrypt (12 rounds) y JWT.
2. **GitHub OAuth**: `GET /api/auth/github` redirige a GitHub; el callback
   en `/api/auth/github/callback` intercambia el código por un token,
   obtiene el perfil del usuario, y **cifra el access token con
   AES-256-GCM antes de guardarlo en la base de datos** (nunca en texto
   plano).

**Requiere configuración externa que debes completar tú:**
Registra una GitHub OAuth App en
[github.com/settings/developers](https://github.com/settings/developers)
con la *Authorization callback URL* apuntando exactamente a tu
`GITHUB_CALLBACK_URL` (debe ser una URL pública en producción; en local
puedes usar `http://localhost:4000/api/auth/github/callback`).

## Integración con GitHub

`github.service.js` consume la REST API de GitHub para:

- Metadata del repo, pull requests abiertos (con CI status y última review),
  issues abiertos, workflow runs recientes, y alertas críticas de Dependabot
  (si el token tiene el scope `security_events`).
- **Consciente del rate limit**: lee los headers `x-ratelimit-remaining` /
  `x-ratelimit-reset` de cada respuesta y bloquea llamadas adicionales de
  forma local si el límite se agotó, en vez de seguir bombardeando la API.

## Webhooks

`webhook.controller.js` recibe eventos de GitHub (`push`, `pull_request`,
`issues`, `workflow_run`, `release`) y **verifica la firma HMAC-SHA256**
del payload contra `GITHUB_WEBHOOK_SECRET` antes de procesar nada —
protege contra que un tercero suplante el endpoint.

**Requiere configuración externa que debes completar tú:**
GitHub necesita poder alcanzar tu servidor por una URL pública. En
desarrollo puedes usar [ngrok](https://ngrok.com) (`ngrok http 4000`) y
configurar esa URL + tu secreto en *Settings → Webhooks* del repositorio.
Mientras no lo configures, DevPulse sigue funcionando vía el job de
sincronización periódica (`jobs/periodicSync.job.js`), que hace polling
cada 15 minutos por defecto.

## Health Score

Calculado en `health.service.js` a partir de un puntaje base de 60, sumando
o restando puntos por factor — cada factor queda registrado con su razón
específica, así el score **nunca es una caja negra**:

| Factor | Puntos |
|---|---|
| CI funcionando | +20 |
| PRs con actividad reciente | +15 |
| Actividad reciente en el repo | +10 |
| Issues antiguos (14+ días sin actividad) | −10 |
| PRs sin revisión (3+ días) | −15 |
| Workflow fallido | −20 |
| Vulnerabilidad crítica | −30 |

Este servicio está cubierto por tests unitarios (`health.service.test.js`)
que verifican casos saludables, críticos, y los límites 0-100.

## Sistema de IA (Daily Brief)

`ai.service.js` no es un chatbot genérico: recibe el Health Score y la
lista de prioridades ya calculados, y genera un mensaje breve explicando
qué es más urgente y **por qué** (ej. "porque está bloqueando el pipeline
de integración"). Si no hay clave de IA configurada, o la llamada falla,
cae a un resumen generado con las mismas reglas deterministas — el
dashboard nunca se queda sin su pieza principal.

## Documentación de la API

Todas las rutas bajo `/api` requieren `Authorization: Bearer <token>`
excepto `/api/auth/*` y `/api/webhooks/*`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro local |
| POST | `/api/auth/login` | Login local |
| GET | `/api/auth/github` | Inicia OAuth de GitHub |
| GET | `/api/auth/github/callback` | Callback de OAuth |
| GET | `/api/auth/me` | Usuario autenticado |
| POST | `/api/workspaces` | Crear workspace |
| GET | `/api/workspaces` | Listar mis workspaces |
| GET/POST | `/api/workspaces/:id/members` | Listar / invitar miembros (RBAC) |
| PATCH/DELETE | `/api/workspaces/:id/members/:userId` | Cambiar rol / remover |
| POST | `/api/workspaces/:id/repositories` | Agregar repo (sincroniza al agregar) |
| GET | `/api/workspaces/:id/repositories` | Listar con paginación/filtros/búsqueda |
| GET | `/api/workspaces/:id/repositories/:repoId` | Detalle + Health Score |
| GET | `/.../repositories/:repoId/pull-requests` | PRs paginados |
| GET | `/.../repositories/:repoId/issues` | Issues paginados |
| GET | `/.../repositories/:repoId/health-history` | Histórico para gráfica |
| POST | `/.../repositories/:repoId/sync` | "Sync now" manual |
| GET | `/api/workspaces/:id/dashboard` | Vista agregada + Daily Brief |
| POST | `/api/webhooks/github` | Recibe eventos de GitHub (firma HMAC) |
| GET | `/api/notifications` | Alertas del usuario |
| GET | `/health` | Health check (DB + GitHub rate limit) |

## Variables de entorno

Ver `server/.env.example` y `client/.env.example` para la lista completa
y comentada. Las que requieren que **tú** las generes/configures:

- `JWT_SECRET` — cadena aleatoria larga
- `ENCRYPTION_KEY` — 32 bytes en hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_CALLBACK_URL` — de tu GitHub OAuth App
- `GITHUB_WEBHOOK_SECRET` — el que configures en Settings → Webhooks del repo

## Desarrollo local

```bash
# 1. Base de datos
mysql -u root -p -e "CREATE DATABASE devpulse;"
mysql -u root -p devpulse < server/database/schema.sql

# 2. Backend
cd server
cp .env.example .env   # completa los valores
npm install
npm test                # corre los tests unitarios
npm run dev              # http://localhost:4000

# 3. Frontend (en otra terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

## Docker

```bash
cp server/.env.example .env   # completa los valores en la raíz
docker compose up --build
```

Levanta MySQL (con el schema cargado automáticamente), el servidor en
`:4000`, y el cliente servido por nginx en `:8080`.

## Testing

```bash
cd server && npm test
```

Cubre `health.service.js` (cálculo del Health Score) y
`prStatus.service.js` (clasificación de PRs) con casos límite reales —
son la lógica de negocio más importante del proyecto, y corren sin
necesitar base de datos ni red.

*(Testing de frontend con Vitest y E2E con Playwright quedan como
siguiente iteración natural — la base con Vitest ya está en
`client/package.json`.)*

## Despliegue

El proyecto está listo para desplegarse como tres piezas independientes:

- **Backend**: cualquier host de Node (Railway, Render, Fly.io) — variables
  de entorno de producción, y `GITHUB_CALLBACK_URL` / `GITHUB_WEBHOOK_SECRET`
  apuntando a tu dominio real.
- **Frontend**: build estático (`npm run build` en `client/`) servible desde
  Vercel, Netlify, o el mismo nginx del `Dockerfile`.
- **Base de datos**: MySQL gestionado (PlanetScale, Railway, RDS).

El workflow de CI (`.github/workflows/ci.yml`) corre tests y construye las
imágenes Docker en cada push — el siguiente paso natural es agregar el job
de deploy una vez tengas la infraestructura elegida.
