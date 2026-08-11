import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret = process.env.ENCRYPTION_KEY || "";
  if (secret.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY debe ser una cadena hex de 64 caracteres (32 bytes). Genérala con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(secret, "hex");
}

export function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Formato: iv:authTag:ciphertext, todo en hex
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload) {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
