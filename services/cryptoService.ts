/**
 * Criptografia e Descriptografia de arquivos Hélix (.hlx) utilizando padrões da indústria:
 * - Algoritmo: AES-256-GCM (Criptografia simétrica com autenticação integrada)
 * - Derivação de Chave: PBKDF2 com HMAC-SHA-256, 100.000 iterações e Salt criptográfico de 16 bytes (Web Crypto API)
 * - Vetor de Inicialização (IV): 12 bytes aleatórios por operação de encriptação
 */

export interface EncryptedHlxContainer {
  format: 'helix-encrypted-v1';
  version: 1;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2';
  kdfParams: {
    hash: 'SHA-256';
    iterations: number;
    salt: string; // Base64
  };
  iv: string; // Base64 (12 bytes)
  ciphertext: string; // Base64 (inclui tag de autenticação GCM)
}

const DEFAULT_ITERATIONS = 100000;

// Converte Uint8Array para Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Converte Base64 para Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Deriva uma CryptoKey AES-256-GCM a partir de uma senha e salt usando PBKDF2.
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Criptografa o JSON de dados do grafo com AES-256-GCM e PBKDF2.
 */
export async function encryptHlxData(
  plainText: string,
  password: string
): Promise<string> {
  if (!password || password.trim().length === 0) {
    throw new Error('A senha de encriptação não pode estar vazia.');
  }

  // Gera Salt de 16 bytes e IV de 12 bytes aleatórios
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKeyFromPassword(password, salt, DEFAULT_ITERATIONS);

  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plainText);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    plaintextBytes
  );

  const container: EncryptedHlxContainer = {
    format: 'helix-encrypted-v1',
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2',
    kdfParams: {
      hash: 'SHA-256',
      iterations: DEFAULT_ITERATIONS,
      salt: uint8ArrayToBase64(salt),
    },
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(encryptedBuffer)),
  };

  return JSON.stringify(container, null, 2);
}

/**
 * Verifica se um texto ou objeto JSON é um arquivo encriptado Hélix.
 */
export function isEncryptedHlxContent(content: string | unknown): boolean {
  if (typeof content !== 'string') {
    if (content && typeof content === 'object') {
      const obj = content as Record<string, unknown>;
      return obj.format === 'helix-encrypted-v1' && Boolean(obj.ciphertext);
    }
    return false;
  }

  try {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) return false;
    const parsed = JSON.parse(trimmed);
    return (
      parsed &&
      typeof parsed === 'object' &&
      parsed.format === 'helix-encrypted-v1' &&
      typeof parsed.ciphertext === 'string'
    );
  } catch {
    return false;
  }
}

/**
 * Descriptografa um arquivo Hélix encriptado usando a senha fornecida.
 * Se a senha estiver incorreta ou os dados tiverem sido violados, a validação de autenticação GCM falhará.
 */
export async function decryptHlxData(
  encryptedJson: string,
  password: string
): Promise<string> {
  if (!password || password.trim().length === 0) {
    throw new Error('Senha não informada.');
  }

  let container: EncryptedHlxContainer;
  try {
    container = JSON.parse(encryptedJson);
  } catch {
    throw new Error('Formato de arquivo encriptado inválido ou corrompido.');
  }

  if (container.format !== 'helix-encrypted-v1' || container.algorithm !== 'AES-256-GCM') {
    throw new Error('Versão ou algoritmo de criptografia incompatível.');
  }

  const salt = base64ToUint8Array(container.kdfParams.salt);
  const iv = base64ToUint8Array(container.iv);
  const ciphertextBytes = base64ToUint8Array(container.ciphertext);

  const iterations = container.kdfParams.iterations || DEFAULT_ITERATIONS;
  const key = await deriveKeyFromPassword(password, salt, iterations);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertextBytes as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Senha incorreta ou integridade do arquivo violada.');
  }
}
