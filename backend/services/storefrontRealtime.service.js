import { pool } from '../config/db.js';

const CHANNEL = 'storefront_orders';
const RETRY_LISTEN_MS = 3000;

const subscribersByCompany = new Map();
let listenerStarted = false;

const normalizeCompanyId = (companyId) => {
  if (companyId === null || companyId === undefined || companyId === '') return '*';
  return String(companyId).trim();
};

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
  const targets = new Set([
    ...(subscribersByCompany.get(companyKey) || []),
    ...(subscribersByCompany.get('*') || [])
  ]);

  if (targets.size === 0) return;

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
  const safePayload = {
    event: String(payload?.event || 'storefront_event'),
    companyId: payload?.companyId,
    ...payload
  };

  await db.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(safePayload)]);
};

export const registerStorefrontStreamClient = ({ companyId, res }) => {
  const companyKey = normalizeCompanyId(companyId);
  const bucket = subscribersByCompany.get(companyKey) || new Set();
  bucket.add(res);
  subscribersByCompany.set(companyKey, bucket);

  writeSse(res, 'connected', {
    event: 'connected',
    companyId: companyKey,
    connectedAt: new Date().toISOString()
  });

  return () => {
    const currentBucket = subscribersByCompany.get(companyKey);
    if (!currentBucket) return;
    currentBucket.delete(res);
    if (currentBucket.size === 0) subscribersByCompany.delete(companyKey);
  };
};
