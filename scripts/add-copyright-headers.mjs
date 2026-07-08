#!/usr/bin/env node
/**
 * Script thêm copyright headers vào source files
 * 
 * Quét tất cả .js, .jsx, .mjs files trong backend/, front-end/, storefront/
 * và thêm header @copyright nếu chưa có.
 * 
 * Yêu cầu: IP Assignment Agreement - mọi file phải có copyright header
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const COPYRIGHT_HEADER = `/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */`;

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next',
  'public', 'tests', '__tests__', 'migrations', 'scripts'
]);

const EXCLUDE_FILES = new Set([
  'vite.config.js', 'postcss.config.js', 'tailwind.config.js',
  'vitest.config.js', 'jest.config.js', 'stryker.conf.json'
]);

const INCLUDE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs']);

let addedCount = 0;
let skippedCount = 0;

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  if (!INCLUDE_EXTENSIONS.has(ext)) return false;
  
  const basename = path.basename(filePath);
  if (EXCLUDE_FILES.has(basename)) return false;
  
  return true;
}

function hasCopyrightHeader(content) {
  return content.includes('@copyright');
}

function addCopyrightHeader(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (hasCopyrightHeader(content)) {
      skippedCount++;
      return;
    }
    
    // Thêm header sau shebang (nếu có) hoặc ở đầu file
    if (content.startsWith('#!')) {
      const newlineIndex = content.indexOf('\n');
      content = content.slice(0, newlineIndex + 1) + COPYRIGHT_HEADER + '\n\n' + content.slice(newlineIndex + 1);
    } else {
      content = COPYRIGHT_HEADER + '\n\n' + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    addedCount++;
    console.log(`  ✅ Added: ${path.relative(ROOT, filePath)}`);
  } catch (err) {
    console.error(`  ❌ Error processing ${filePath}: ${err.message}`);
  }
}

function walkDir(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile() && shouldProcessFile(fullPath)) {
        addCopyrightHeader(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dirPath}: ${err.message}`);
  }
}

// Main
console.log('🔍 Scanning for files missing copyright headers...\n');

const targetDirs = ['backend', 'front-end', 'storefront'];
for (const dir of targetDirs) {
  const dirPath = path.join(ROOT, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`📁 Scanning ${dir}/...`);
    walkDir(dirPath);
  }
}

console.log(`\n📊 Summary:`);
console.log(`  ✅ Added headers: ${addedCount}`);
console.log(`  ⏭️  Already had headers: ${skippedCount}`);
console.log(`  📁 Scanned: backend/, front-end/, storefront/`);

if (addedCount > 0) {
  console.log('\n⚠️  Remember to replace [TÊN DOANH NGHIỆP] with your actual company name!');
}