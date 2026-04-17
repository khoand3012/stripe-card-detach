import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";

function deriveAesKey(
  request_id: string,
  nonce: string,
  timestamp: number,
): Buffer {
  // Step 1 — build input string
  const input = request_id + nonce + timestamp.toString();

  // Step 2 — hash with SHA-256
  const hash = createHash("sha256").update(Buffer.from(input, "utf8")).digest();

  // Step 3 — split bytes by odd / even index
  const key_1: number[] = []; // odd indices
  const key_2: number[] = []; // even indices

  for (let i = 0; i < hash.length; i++) {
    if (i % 2 === 0) {
      key_2.push(hash[i]);
    } else {
      key_1.push(hash[i]);
    }
  }

  // Step 4 — concatenate: odd first, even second
  const aes_key = Buffer.from([...key_1, ...key_2]);

  return aes_key;
}

function buildAad(
  request_id: string,
  timestamp: number,
  nonce_hex: string,
): Buffer {
  const aad_string = `${request_id}|${timestamp}|${nonce_hex}`;
  return Buffer.from(aad_string, "utf8");
}

interface Packet {
  ["x-version"]: string;
  ["x-rid"]: string;
  ["x-timestamp"]: number;
  ["x-nonce"]: string; // hex
  ["x-iv"]: string; // hex
  ["x-ctext"]: string; // base64
  ["x-tag"]: string; // base64
}

function encrypt(payload: string, request_id: string): Packet {
  // Step 1 — generate metadata
  const timestamp = Date.now();
  const nonce = randomBytes(16);

  // Step 2 — derive key
  const nonce_hex = nonce.toString("hex");
  const aes_key = deriveAesKey(request_id, nonce_hex, timestamp);

  // Step 3 — generate IV
  const iv = randomBytes(12);

  // Step 4 — build AAD
  const aad = buildAad(request_id, timestamp, nonce_hex);

  // Step 5 — encrypt
  const cipher = createCipheriv("aes-256-gcm", aes_key, iv);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(payload, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16 bytes by default

  // Step 6 — build packet
  return {
    ["x-version"]: "1",
    ["x-rid"]: request_id,
    ["x-timestamp"]: timestamp,
    ["x-nonce"]: nonce_hex,
    ["x-iv"]: iv.toString("hex"),
    ["x-ctext"]: encodeURIComponent(ciphertext.toString("base64")),
    ["x-tag"]: encodeURIComponent(tag.toString("base64")),
  };
}

function decrypt(packet: Packet): unknown {
  // Step 3 — decode bytes from packet fields
  const iv_bytes = Buffer.from(packet["x-iv"], "hex");
  const ct_bytes = Buffer.from(packet["x-ctext"], "base64");
  const tag_bytes = Buffer.from(packet["x-tag"], "base64");

  // Step 4 — derive key
  const aes_key = deriveAesKey(
    packet["x-rid"],
    packet["x-nonce"],
    packet["x-timestamp"],
  );

  // Step 5 — rebuild AAD
  const aad = buildAad(
    packet["x-rid"],
    packet["x-timestamp"],
    packet["x-nonce"],
  );

  // Step 6 — decrypt and verify
  const decipher = createDecipheriv("aes-256-gcm", aes_key, iv_bytes);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag_bytes);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ct_bytes), decipher.final()]);
  } catch {
    throw new Error("decryption failed — authentication tag mismatch");
  }

  return JSON.parse(plaintext.toString("utf8"));
}

// Export functions for use in browser
export { encrypt, decrypt };
export type { Packet };
