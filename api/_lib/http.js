// Small helpers shared by the API functions.

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export const header = (req, name) => {
  const v = req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};

export function clientIp(req) {
  const fwd = header(req, 'x-forwarded-for');
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Simple fixed-window limiter kept in memory. Serverless instances do not share memory, so this
 * only slows down casual abuse; Stripe and Supabase enforce their own limits behind it.
 */
export function createLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map();
  return (key) => {
    const t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= t) hits.delete(k);
    const cur = hits.get(key);
    if (!cur || cur.reset <= t) {
      hits.set(key, { n: 1, reset: t + windowMs });
      return true;
    }
    cur.n += 1;
    return cur.n <= max;
  };
}

/** Accepts the request only when Origin (or Referer) is this site. */
export function sameOrigin(req, allowedHosts) {
  const raw = header(req, 'origin') || header(req, 'referer');
  if (!raw) return false;
  try {
    return allowedHosts.includes(new URL(raw).host);
  } catch {
    return false;
  }
}

export async function readRawBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw new Error('body too large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

/** The public address of the shop. Required: there is deliberately no fallback to the Host header. */
export function siteUrl(env) {
  const configured = (env.SITE_URL || '').trim().replace(/\/+$/, '');
  let u;
  try {
    u = new URL(configured);
  } catch {
    throw new Error('SITE_URL is not set to a full address like https://shop.example.com');
  }
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error('SITE_URL must start with https://');
  return configured;
}

/** Only the shop's own host may call the browser-facing POST endpoints. */
export const allowedHosts = (env) => [new URL(siteUrl(env)).host];
