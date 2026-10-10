import crypto from "node:crypto";
import { env } from "../config/env.js";

/**
 * Authenticated encryption (AES-256-GCM) for secrets Saffra has to keep in its
 * own database, e.g. a restaurant's Razorpay key secret. Keeps them out of
 * plain sight in the SQLite file, in backups and in anything that copies the
 * database around.
 *
 * The key comes from DATA_ENCRYPTION_KEY (the desktop app generates a random
 * one per install, next to its JWT secrets). Without it, a key is derived from
 * JWT_REFRESH_SECRET via HKDF, so dev setups work with no extra config.
 * Either way the key lives on the same machine as the database: this protects
 * a copied database file, not a fully compromised computer.
 */

const VERSION = "v1";

function key(): Buffer {
  const ikm = env.DATA_ENCRYPTION_KEY || env.JWT_REFRESH_SECRET;
  return Buffer.from(crypto.hkdfSync("sha256", ikm, "saffra", "saffra/secret-box/v1", 32));
}

export function sealSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Throws if the value was tampered with or was sealed with a different key. */
export function openSecret(sealed: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unrecognized sealed secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
