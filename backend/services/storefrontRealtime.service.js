import { pool } from '../config/db.js';

const CHANNEL = 'storefront_orders';
const RETRY_LISTEN_MS = 3000;

const subscribersByCompany = new Map();
let listenerStarted = false;

const normalizeCompanyId = (companyId) => {
  if (companyId === null || companyId === undefined || companyId === '') return '*';
  return String(companyId).trim();
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const formatSseMessage = ({ event, payload }) => {
  const safeEvent = String(event || 'message').trim() || 'message';
  const data = JSON.stringify(payload || {});
  return `event: ${safeEvent}\ndata: ${data}\n\n`;
};

const writeSse = (res, event, payload) => {
  try {
    res.write(formatSseMessage({ event, payload }));
  } catch {
    // Ignore broken connection writes.
  }
};

const broadcastLocal = (payload) => {
  const companyKey = normalizeCompanyId(payload?.companyId);
  const targetRoles = Array.isArray(payload?.targetRoles)
    ? payload.targetRoles.map(normalizeRole).filter(Boolean)
    : [];

  const candidateBuckets = [];
  const companyBuckets = subscribersByCompany.get(companyKey);
  if (companyBuckets) {
    candidateBuckets.push(...companyBuckets.entries());
  }

  const wildcardBuckets = subscribersByCompany.get('*');
  if (wildcardBuckets) {
    candidateBuckets.push(...wildcardBuckets.entries());
  }

  if (candidateBuckets.length === 0) return;

  const targets = new Set();
  for (const [bucketRole, bucket] of candidateBuckets) {
    const normalizedBucketRole = normalizeRole(bucketRole);
    const shouldDeliver = targetRoles.length === 0 || normalizedBucketRole === 'all' || targetRoles.includes(normalizedBucketRole);
    if (!shouldDeliver) continue;

    for (const res of bucket || []) {
      targets.add(res);
    }
  }

  for (const res of targets) {
    writeSse(res, payload?.event || 'storefront_event', payload);
  }
};

const attachListener = async () => {
  const listenerClient = await pool.connect();
  try {
    await listenerClient.query(`LISTEN ${CHANNEL}`);

    listenerClient.on('notification', (msg) => {
      if (!msg || msg.channel !== CHANNEL) return;
      try {
        const payload = JSON.parse(String(msg.payload || '{}'));
        broadcastLocal(payload);
      } catch {
        // Ignore malformed payloads.
      }
    });

    listenerClient.on('error', () => {
      try {
        listenerClient.release();
      } catch {
        // ignore
      }
      listenerStarted = false;
      setTimeout(() => {
        ensureStorefrontRealtimeListener();
      }, RETRY_LISTEN_MS);
    });
  } catch (error) {
    try {
      listenerClient.release();
    } catch {
      // ignore
    }
    listenerStarted = false;
    setTimeout(() => {
      ensureStorefrontRealtimeListener();
    }, RETRY_LISTEN_MS);
    throw error;
  }
};

export const ensureStorefrontRealtimeListener = () => {
  if (listenerStarted) return;
  listenerStarted = true;

  attachListener().catch(() => {
    // Retry is handled in attachListener.
  });
};

export const publishStorefrontOrderEvent = async (db, payload) => {
  const targetRoles = Array.isArray(payload?.targetRoles)
    ? payload.targetRoles.filter((role) => typeof role === 'string' && role.trim())
    : ['admin', 'nv_banhang', 'nv_kho'];

  const safePayload = {
    event: String(payload?.event || 'storefront_event'),
    companyId: payload?.companyId,
    targetRoles,
    ...payload
  };

  safePayload.targetRoles = Array.isArray(safePayload.targetRoles)
    ? safePayload.targetRoles.filter((role) => typeof role === 'string' && role.trim())
    : ['admin', 'nv_banhang', 'nv_kho'];

  await db.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(safePayload)]);
};

export const registerStorefrontStreamClient = ({ companyId, res, role }) => {
  const companyKey = normalizeCompanyId(companyId);
  const normalizedRole = normalizeRole(role) || 'all';
  const companyBuckets = subscribersByCompany.get(companyKey) || new Map();
  const bucket = companyBuckets.get(normalizedRole) || new Set();
  bucket.add(res);
  companyBuckets.set(normalizedRole, bucket);
  subscribersByCompany.set(companyKey, companyBuckets);

  writeSse(res, 'connected', {
    event: 'connected',
    companyId: companyKey,
    role: normalizedRole,
    connectedAt: new Date().toISOString()
  });

  return () => {
    const currentBuckets = subscribersByCompany.get(companyKey);
    if (!currentBuckets) return;
    const currentBucket = currentBuckets.get(normalizedRole);
    if (!currentBucket) return;
    currentBucket.delete(res);
    if (currentBucket.size === 0) currentBuckets.delete(normalizedRole);
    if (currentBuckets.size === 0) subscribersByCompany.delete(companyKey);
  };
};
