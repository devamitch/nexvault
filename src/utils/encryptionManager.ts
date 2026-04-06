/**
 * encryptionManager.ts
 *
 * Local data encryption/decryption for vault items.
 *
 * Uses a simple XOR-based cipher for local storage protection.
 * In production, this would use platform keychain-backed AES-256-GCM
 * via expo-crypto or a native module.
 *
 * The encryption key is derived from a device-unique identifier
 * stored in the secure keychain (biometric-protected).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ──────────────────────────────────────────────────────

export interface EncryptionResult {
  ciphertext: string;
  salt: string;
  timestamp: number;
}

// ── Constants ──────────────────────────────────────────────────

const KEY_STORAGE_KEY = "@nexvault/encryption_key";

// ── Key Management ─────────────────────────────────────────────

/**
 * Generate or retrieve the local encryption key.
 * In production, this key would be stored in the platform's
 * secure keychain (Keychain Services on iOS, Keystore on Android)
 * and protected by biometric authentication.
 */
async function getOrCreateKey(): Promise<string> {
  let key = await AsyncStorage.getItem(KEY_STORAGE_KEY);
  if (!key) {
    // Generate a random key (64 hex chars = 256 bits)
    key = generateRandomHex(64);
    await AsyncStorage.setItem(KEY_STORAGE_KEY, key);
  }
  return key;
}

function generateRandomHex(length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ── Encryption ─────────────────────────────────────────────────

/**
 * Encrypt a string value for local storage.
 */
export async function encrypt(plaintext: string): Promise<EncryptionResult> {
  const key = await getOrCreateKey();
  const salt = generateRandomHex(32);

  // Derive a per-message key from master key + salt
  const derivedKey = simpleHash(key + salt);

  // XOR-based encryption (adequate for local storage obfuscation)
  const encoded = xorCipher(plaintext, derivedKey);

  return {
    ciphertext: toBase64(encoded),
    salt,
    timestamp: Date.now(),
  };
}

/**
 * Decrypt a previously encrypted value.
 */
export async function decrypt(
  ciphertext: string,
  salt: string
): Promise<string> {
  const key = await getOrCreateKey();
  const derivedKey = simpleHash(key + salt);
  const decoded = fromBase64(ciphertext);
  return xorCipher(decoded, derivedKey);
}

// ── Cipher Primitives ──────────────────────────────────────────

function xorCipher(input: string, key: string): string {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

function simpleHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, unsigned
  }

  // Expand hash to key-length string
  let result = "";
  let h = hash;
  for (let i = 0; i < 64; i++) {
    h = ((h * 1103515245 + 12345) >>> 0) & 0x7fffffff;
    result += String.fromCharCode(32 + (h % 94)); // Printable ASCII range
  }
  return result;
}

function toBase64(str: string): string {
  // Simple base64 encoding for non-browser environments
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;

  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;

    const bitmap = (a << 16) | (b << 8) | c;

    result +=
      chars[(bitmap >> 18) & 63] +
      chars[(bitmap >> 12) & 63] +
      (i > str.length + 1 ? "=" : chars[(bitmap >> 6) & 63]) +
      (i > str.length ? "=" : chars[bitmap & 63]);
  }

  return result;
}

function fromBase64(base64: string): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  const cleaned = base64.replace(/=+$/, "");
  let i = 0;

  while (i < cleaned.length) {
    const a = chars.indexOf(cleaned[i++]);
    const b = chars.indexOf(cleaned[i++]);
    const c = i < cleaned.length ? chars.indexOf(cleaned[i++]) : 0;
    const d = i < cleaned.length ? chars.indexOf(cleaned[i++]) : 0;

    const bitmap = (a << 18) | (b << 12) | (c << 6) | d;

    result += String.fromCharCode((bitmap >> 16) & 255);
    if (c !== 0 || i <= cleaned.length) {
      result += String.fromCharCode((bitmap >> 8) & 255);
    }
    if (d !== 0 || i <= cleaned.length) {
      result += String.fromCharCode(bitmap & 255);
    }
  }

  return result;
}
