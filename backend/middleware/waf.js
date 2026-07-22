/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { pool } from '../config/db.js';

import { getConfigNumber, getConfigString, getConfig } from '../utils/configHelper.js';


// WAF configuration
const WAF_CONFIG = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
  },
  speedLimit: {
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: () => 500
  }
};

// SQL Injection patterns - tuned to reduce false positives
// Only blocks obvious SQL injection attempts, not legitimate business data
const SQL_INJECTION_PATTERNS = [
  /(\bUNION\b)\s+\bSELECT\b/gi,           // UNION SELECT (classic SQLi)
  /(\bSELECT\b)\s+.*\bFROM\b\s+.*\bINTO\b/gi, // SELECT INTO (data exfil)
  /(--\s)|(\/\*)|(\*\/)/g,                 // Comment-based injection
  /(\bOR\b|\bAND\b)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi, // OR 1=1 patterns
  /(EXEC\s*\(|xp_cmdshell|pg_sleep|WAITFOR\s+DELAY)/gi // Dangerous functions
];

// XSS patterns
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi
];

// Rate limiter middleware
export const rateLimiter = rateLimit(WAF_CONFIG.rateLimit);

// Speed limiter middleware
export const speedLimiter = slowDown(WAF_CONFIG.speedLimit);

// SQL Injection protection
export const sqlInjectionProtection = (req, res, next) => {
  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };

  const recursiveCheck = (obj) => {
    if (typeof obj === 'string') return checkValue(obj);
    if (Array.isArray(obj)) return obj.some(item => recursiveCheck(item));
    if (obj && typeof obj === 'object') {
      return Object.entries(obj).some(([key, val]) => checkValue(key) || recursiveCheck(val));
    }
    return false;
  };

  // Check query params (including nested)
  for (const [key, value] of Object.entries(req.query)) {
    if (checkValue(key) || checkValue(value)) {
      return res.status(400).json({ error: 'Invalid query parameter' });
    }
    if (typeof value === 'object' && recursiveCheck(value)) {
      return res.status(400).json({ error: 'Invalid query parameter' });
    }
  }

  // Check body (including nested objects)
  if (req.body && typeof req.body === 'object' && recursiveCheck(req.body)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  next();
};

// XSS protection
export const xssProtection = (req, res, next) => {
  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };

  // Check query params
  for (const [key, value] of Object.entries(req.query)) {
    if (checkValue(value)) {
      return res.status(400).json({ error: 'Invalid query parameter' });
    }
  }

  // Check body (including nested objects)
  const deepCheck = (obj) => {
    if (typeof obj === 'string') {
      return checkValue(obj);
    }
    if (Array.isArray(obj)) {
      return obj.some(item => deepCheck(item));
    }
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(val => deepCheck(val));
    }
    return false;
  };

  if (req.body && typeof req.body === 'object') {
    if (deepCheck(req.body)) {
      return res.status(400).json({ error: 'Invalid input detected' });
    }
  }

  next();
};

// IP whitelist
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      return res.status(403).json({ error: 'IP not allowed' });
    }
    
    next();
  };
};

export const checkCompanyActive = async (req, res, next) => {
  // Prefer req.companyId from checkCompanyAccess middleware (validated), fallback to body/query
  const companyId = req.companyId || req.body?.company_id || req.body?.companyId || req.query?.company_id || req.query?.companyId;
  if (!companyId) {
    return res.status(400).json({ error: 'company_id is required' });
  }

  const numericCompanyId = Number(companyId);
  if (!Number.isInteger(numericCompanyId) || numericCompanyId <= 0) {
    return res.status(400).json({ error: 'Mã công ty không hợp lệ!' });
  }

  try {
    const { rows } = await pool.query('SELECT is_active FROM companies WHERE id = $1', [numericCompanyId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const isActive = rows[0].is_active;
    if (isActive === false) {
      return res.status(403).json({ error: 'Company is not active' });
    }

    next();
  } catch (error) {
    console.error('Error checking company active status:', error);
    res.status(500).json({ error: 'Failed to verify company status' });
  }
};

// Security headers
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Dynamic CSP that allows the backend's own origin and common CDNs
  const backendOrigin = process.env.BACKEND_URL || '';
  const frontendOrigin = process.env.FRONTEND_URL || '';
  const allowedOrigins = [backendOrigin, frontendOrigin, 'http://localhost:*', 'https://*.railway.app']
    .filter(Boolean)
    .join(' ');
  
  res.setHeader('Content-Security-Policy', 
    `default-src 'self' ${allowedOrigins}; ` +
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; ` +
    `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; ` +
    `font-src 'self' https://fonts.gstatic.com; ` +
    `img-src 'self' data: blob: https:; ` +
    `connect-src 'self' ${allowedOrigins} https://*.railway.app wss://*.railway.app;`
  );
  next();
};

// Combined WAF middleware
export const waf = [
  rateLimiter,
  speedLimiter,
  sqlInjectionProtection,
  xssProtection,
  securityHeaders
];

export default waf;