/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Encryption Utility
 * Mã hóa/demã hóa dữ liệu nhạy cảm (AES-256-GCM)
 * Tuân thủ NĐ 254/2026 và Luật BV dữ liệu cá nhân
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;

/**
 * Lấy encryption key từ environment variable
 * Phải là 64 ký tự hex (32 bytes)
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Mã hóa dữ liệu
 * @param {string} plaintext - Dữ liệu cần mã hóa
 * @returns {string} - Chuỗi mã hóa dạng: salt:iv:authTag:ciphertext (hex)
 */
export function encrypt(plaintext) {
  if (!plaintext) return null;
  
  try {
    const key = getEncryptionKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from salt using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
    
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: salt:iv:authTag:ciphertext
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted
    ].join(':');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Giải mã dữ liệu
 * @param {string} encryptedData - Chuỗi mã hóa dạng: salt:iv:authTag:ciphertext
 * @returns {string} - Dữ liệu gốc
 */
export function decrypt(encryptedData) {
  if (!encryptedData) return null;
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [saltHex, ivHex, authTagHex, ciphertext] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Derive key from salt using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

/**
 * Hash token (one-way) - cho refresh token, password reset tokens
 * @param {string} token - Token cần hash
 * @returns {string} - Hashed token
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate random token
 * @param {number} length - Số bytes ngẫu nhiên
 * @returns {string} - Token dạng hex
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Mã hóa dữ liệu nhạy cảm trong object
 * @param {object} data - Object chứa dữ liệu
 * @param {string[]} fields - Danh sách field cần mã hóa
 * @returns {object} - Object đã mã hóa
 */
export function encryptSensitiveFields(data, fields) {
  const encrypted = { ...data };
  for (const field of fields) {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  }
  return encrypted;
}

/**
 * Giải mã dữ liệu nhạy cảm trong object
 * @param {object} data - Object chứa dữ liệu mã hóa
 * @param {string[]} fields - Danh sách field cần giải mã
 * @returns {object} - Object đã giải mã
 */
export function decryptSensitiveFields(data, fields) {
  const decrypted = { ...data };
  for (const field of fields) {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field]);
    }
  }
  return decrypted;
}

export default {
  encrypt,
  decrypt,
  hashToken,
  generateToken,
  encryptSensitiveFields,
  decryptSensitiveFields
};