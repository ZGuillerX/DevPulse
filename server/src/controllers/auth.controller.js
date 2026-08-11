import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import fetch from "node-fetch";
import { config } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import * as UserModel from "../models/user.model.js";
import * as WorkspaceModel from "../models/workspace.model.js";
import { encrypt } from "../utils/crypto.js";
import { validateGitHubToken } from "../services/github.service.js";
import { query } from "../config/db.js";

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

export async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    const existing = await UserModel.findUserByEmail(email);
    if (existing) throw new AppError("Ya existe una cuenta con ese correo.", 409, "EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.createUser({ email, passwordHash, name });

    // Cada usuario nuevo obtiene un workspace personal por defecto
    const workspace = await WorkspaceModel.createWorkspace({ name: `${name || email}'s Workspace`, ownerId: user.id });

    await logAudit({ userId: user.id, workspaceId: workspace.id, action: "user.registered", req });

    const token = issueToken(user);
    req.log.info("Usuario registrado", { userId: user.id });
    res.status(201).json({ token, user, defaultWorkspaceId: workspace.id });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findUserByEmail(email);
    if (!user || !user.password_hash) {
      throw new AppError("Credenciales inválidas.", 401, "INVALID_CREDENTIALS");
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      req.log.warn("Intento de login fallido", { email });
      throw new AppError("Credenciales inválidas.", 401, "INVALID_CREDENTIALS");
    }

    const token = issueToken(user);
    req.log.info("Login exitoso", { userId: user.id });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
}

// --- GitHub OAuth ---
// IMPORTANTE: requiere que configures una GitHub OAuth App real con:
//   Authorization callback URL = GITHUB_CALLBACK_URL (tu dominio público)
// Regístrala en: https://github.com/settings/developers

export function githubOAuthRedirect(req, res) {
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: "repo read:user user:email",
    state: randomUUID(),
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

export async function githubOAuthCallback(req, res, next) {
  try {
    const { code } = req.query;
    if (!code) throw new AppError("Falta el código de autorización de GitHub.", 400, "MISSING_CODE");

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new AppError(`GitHub OAuth falló: ${tokenData.error_description}`, 400, "GITHUB_OAUTH_ERROR");
    }

    const accessToken = tokenData.access_token;
    const ghUser = await validateGitHubToken(accessToken);

    const user = await UserModel.upsertGithubUser({
      githubId: String(ghUser.id),
      githubUsername: ghUser.login,
      email: `${ghUser.login}@users.noreply.github.com`,
      name: ghUser.login,
      avatarUrl: ghUser.avatarUrl,
      encryptedToken: encrypt(accessToken),
    });

    const workspaces = await WorkspaceModel.listUserWorkspaces(user.id);
    if (workspaces.length === 0) {
      await WorkspaceModel.createWorkspace({ name: `${ghUser.login}'s Workspace`, ownerId: user.id });
    }

    const jwtToken = issueToken(user);
    req.log.info("Login con GitHub exitoso", { userId: user.id, githubUsername: ghUser.login });

    // Redirige al frontend con el token (patrón común para OAuth SPA)
    res.redirect(`${config.frontendUrl}/oauth/callback?token=${jwtToken}`);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await UserModel.findUserById(req.user.id);
    if (!user) throw new AppError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function logAudit({ userId, workspaceId, action, req, metadata = {} }) {
  await query(
    "INSERT INTO audit_events (id, workspace_id, user_id, action, metadata, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
    [randomUUID(), workspaceId || null, userId || null, action, JSON.stringify(metadata), req?.ip || null]
  );
}

export { logAudit };
