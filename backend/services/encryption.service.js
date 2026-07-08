/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Encryption Service
 * Mã hóa dữ liệu nhạy cảm sử dụng AES-256-GCM
 * Bảo vệ các trường như số tài khoản ngân hàng, CMND, số điện thoại
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes cho GCM
const TAG_LENGTH = 16; // 16 bytes auth tag
const KEY_LENGTH = 32; // 256-bit key

// Lấy key từ biến môi trường hoặc tạo key mặc định (chỉ dùng cho development)
const getEncryptionKey = () => {
  const keyFromEnv = process.env.ENCRYPTION_KEY;
  if (keyFromEnv) {
    // Đảm bảo key đủ 32 bytes
    const hash = crypto.createHash('sha256');
    hash.update(keyFromEnv);
    return hash.digest();
  }
  // Fallback: Tạo key từ một secret mặc định (KHÔNG dùng cho production)
  if (process.env.NODE_ENV !== 'production') {
    const hash = crypto.createHash('sha256');
    hash.update('development-encryption-key-default');
    return hash.digest();
  }
  throw new Error('ENCRYPTION_KEY environment variable is required in production mode');
};

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Mã hóa dữ liệu
 * @param {string} plaintext - Dữ liệu cần mã hóa
 * @returns {string} Dữ liệu đã mã hóa dạng base64 (iv:tag:ciphertext)
 */
export function encrypt(plaintext) {
  if (!plaintext) return null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    // Lấy auth tag để xác thực tính toàn vẹn
    const authTag = cipher.getAuthTag();
    
    // Đóng gói: iv:authTag:ciphertext (base64)
    const packed = Buffer.concat([
      iv,
      authTag,
      Buffer.from(ciphertext, 'hex')
    ]).toString('base64');
    
    return packed;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Mã hóa dữ liệu thất bại');
  }
}

/**
 * Giải mã dữ liệu
 * @param {string} encryptedData - Dữ liệu đã mã hóa dạng base64
 * @returns {string} Dữ liệu gốc
 */
export function decrypt(encryptedData) {
  if (!encryptedData) return null;
  
  try {
    const packed = Buffer.from(encryptedData, 'base64');
    
    // Tách iv (16 bytes), authTag (16 bytes), ciphertext (phần còn lại)
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH).toString('hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Giải mã dữ liệu thất bại');
  }
}

/**
 * Mã hóa các trường nhạy cảm trong object
 * @param {Object} data - Object chứa dữ liệu
 * @param {string[]} fields - Danh sách trường cần mã hóa
 * @returns {Object} Object với các trường đã được mã hóa
 */
export function encryptFields(data, fields = []) {
  if (!data || !fields.length) return data;
  
  const encrypted = { ...data };
  for (const field of fields) {
    if (encrypted[field]) {
      encrypted[field] = encrypt(String(encrypted[field]));
    }
  }
  return encrypted;
}

/**
 * Giải mã các trường trong object
 * @param {Object} data - Object chứa dữ liệu đã mã hóa
 * @param {string[]} fields - Danh sách trường cần giải mã
 * @returns {Object} Object với các trường đã được giải mã
 */
export function decryptFields(data, fields = []) {
  if (!data || !fields.length) return data;
  
  const decrypted = { ...data };
  for (const field of fields) {
    if (decrypted[field]) {
      try {
        decrypted[field] = decrypt(String(decrypted[field]));
      } catch {
        // Nếu không giải mã được, giữ nguyên giá trị
        console.warn(`Cannot decrypt field: ${field}`);
      }
    }
  }
  return decrypted;
}

/**
 * Tạo hash cho dữ liệu (không thể đảo ngược)
 * @param {string} data - Dữ liệu cần hash
 * @returns {string} Hash hex
 */
export function hashData(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(String(data)).digest('hex');
}

/**
 * Kiểm tra tính toàn vẹn của dữ liệu
 * @param {string} data - Dữ liệu gốc
 * @param {string} hash - Hash cần kiểm tra
 * @returns {boolean}
 */
export function verifyIntegrity(data, hash) {
  if (!data || !hash) return false;
  return hashData(data) === hash;
}

export default { encrypt, decrypt, encryptFields, decryptFields, hashData, verifyIntegrity };