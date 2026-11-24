const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

async function hmac(keyBytes: Uint8Array, data: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", keyBytes as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data as unknown as BufferSource));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
  const blocks: Uint8Array[] = [];
  let previous = new Uint8Array();
  for (let counter = 1; blocks.reduce((sum, block) => sum + block.length, 0) < length; counter++) {
    previous = await hmac(prk, concatBytes(previous, info, new Uint8Array([counter])));
    blocks.push(previous);
  }
  return concatBytes(...blocks).slice(0, length);
}

function jsonPart(value: unknown) {
  return encodeBase64Url(encoder.encode(JSON.stringify(value)));
}

async function vapidAuthorization(endpoint: string) {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? "";
  const privateJwk = process.env.WEB_PUSH_VAPID_PRIVATE_JWK ?? "";
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT ?? "";
  if (!publicKey || !privateJwk || !subject) throw new Error("Web Push VAPID credentials are not configured.");
  const audience = new URL(endpoint).origin;
  const header = jsonPart({ typ: "JWT", alg: "ES256" });
  const payload = jsonPart({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject });
  const unsigned = header + "." + payload;
  const jwk = JSON.parse(privateJwk) as JsonWebKey;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsigned)));
  return { authorization: "vapid t=" + unsigned + "." + encodeBase64Url(signature) + ", k=" + publicKey, publicKey };
}

async function encryptPayload(subscription: { p256dh: string; auth: string }, payload: unknown) {
  const userPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const userKey = await crypto.subtle.importKey("raw", userPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: userKey }, ephemeral.privateKey, 256));

  const authPrk = await hmac(authSecret, sharedSecret);
  const keyInfo = concatBytes(encoder.encode("WebPush: info\0"), userPublic, serverPublic);
  const inputKey = await hkdfExpand(authPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, inputKey);
  const cek = await hkdfExpand(prk, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, encoder.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintext = concatBytes(encoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, plaintext));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  const body = concatBytes(salt, recordSize, new Uint8Array([serverPublic.length]), serverPublic, ciphertext);
  return body;
}

export async function sendBrowserPush(subscription: { id: string; endpoint: string; p256dh: string; auth: string }, payload: { title: string; body: string; url?: string }) {
  const authorization = await vapidAuthorization(subscription.endpoint);
  const body = await encryptPayload(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization.authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "60",
      Urgency: "high",
    },
    body,
  });
  return { ok: response.ok, status: response.status, providerId: response.headers.get("location") };
}
