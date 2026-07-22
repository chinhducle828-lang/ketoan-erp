/**
 * Generate a test JWT token for development/testing
 * Usage: node backend/scripts/generate-test-token.js
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file from backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET;
const TEST_USER = {
  id: 1,
  username: 'test',
  role: 'admin',
  company_ids: [37],
  storefront_role: 'admin',
  activeCompanyId: 37
};

console.log('🔑 Generating test JWT token...\n');

const token = jwt.sign(TEST_USER, JWT_SECRET, { expiresIn: '7d' });

console.log('✅ Test token generated successfully!\n');
console.log('Copy this token and set it as a cookie in your browser:\n');
console.log(`document.cookie = "accessToken=${token}; path=/";\n`);
console.log('Or use it directly in localStorage:\n');
console.log(`localStorage.setItem("storefrontAccessToken", "${token}");\n`);
console.log('Token payload:', JSON.stringify(TEST_USER, null, 2));
console.log('\nExpires in: 7 days');