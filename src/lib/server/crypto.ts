import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts a string using AES-256-CBC.
 * Returns a string in the format: iv:encryptedData
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Ensure key is 32 bytes for aes-256
  const keyBuffer = Buffer.alloc(32, key, 'utf8');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with the encrypt function.
 */
export function decrypt(text: string): string {
  if (!text) return '';
  
  const key = env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  try {
    const [ivHex, encryptedHex] = text.split(':');
    if (!ivHex || !encryptedHex) {
      // If it doesn't match our format, it might be an unencrypted legacy key
      // or corrupted data. For safety in migration/graceful handling, we return
      // the original text if it doesn't look like our encrypted format.
      // In a strict environment, we might want to throw or return null.
      return text;
    }

    const keyBuffer = Buffer.alloc(32, key, 'utf8');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return original text as fallback for legacy keys, 
    // or empty string if it's clearly not a legacy key.
    return text;
  }
}
