import { AppError } from "../middleware/errorHandler.js";
import * as UserModel from "../models/user.model.js";
import { encrypt } from "../utils/crypto.js";
import { validateGitHubToken } from "../services/github.service.js";

// El usuario ya inició sesión normalmente (email/contraseña). Este endpoint
// conecta su cuenta de GitHub pegando un Personal Access Token desde la UI,
// sin pasar por el flujo OAuth (que requeriría GITHUB_CLIENT_ID/SECRET en
// el .env). El token se valida contra la API real de GitHub antes de
// guardarse, y se cifra con AES-256-GCM antes de tocar la base de datos.
export async function connectGithub(req, res, next) {
  try {
    const { token } = req.body;

    let ghUser;
    try {
      ghUser = await validateGitHubToken(token);
    } catch (err) {
      throw new AppError(
        "El token no es válido o no tiene permisos suficientes. Verifica que tenga el scope 'repo'.",
        400,
        "INVALID_GITHUB_TOKEN"
      );
    }

    await UserModel.saveGithubToken({
      userId: req.user.id,
      githubId: String(ghUser.id),
      githubUsername: ghUser.login,
      avatarUrl: ghUser.avatarUrl,
      encryptedToken: encrypt(token),
    });

    req.log.info("GitHub conectado manualmente", { userId: req.user.id, githubUsername: ghUser.login });
    res.json({ message: "GitHub conectado correctamente.", githubUsername: ghUser.login });
  } catch (err) {
    next(err);
  }
}

export async function disconnectGithub(req, res, next) {
  try {
    await UserModel.disconnectGithub(req.user.id);
    req.log.info("GitHub desconectado", { userId: req.user.id });
    res.json({ message: "GitHub desconectado." });
  } catch (err) {
    next(err);
  }
}

export async function getGithubStatus(req, res, next) {
  try {
    const status = await UserModel.getGithubConnectionStatus(req.user.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
}
