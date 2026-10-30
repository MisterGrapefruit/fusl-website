// Gedeelde helpers voor het tellen van doorverwijzingen naar winkels.
//
// Opslag: Netlify Blobs. Elke getelde klik is één klein blob met als sleutel
//   kliks/<JJJJ-MM>/<winkel-id>/<product-id>/<tijd>-<willekeurig>
// zodat tellen per maand, winkel en product kan door alleen de sleutels op te
// sommen (geen gelijktijdige schrijfconflicten).
//
// Dubbel tellen voorkomen: dezelfde bezoeker die binnen 24 uur nogmaals op
// hetzelfde stuk klikt, telt één keer. Daarvoor bewaren we een hash van
// (geheime sleutel + datum + IP + browser + product). Het IP-adres zelf wordt
// nooit opgeslagen, en door de datum in de hash zijn bezoeken op verschillende
// dagen niet aan elkaar te koppelen. Hashes ouder dan twee dagen ruimen we op.

import { getStore } from '@netlify/blobs';
import { createHash, randomBytes } from 'node:crypto';

export const DAG_MS = 24 * 60 * 60 * 1000;
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|headless/i;

export function storeVoor(context) {
  // Klikken op een testversie (deploy preview) tellen apart, zodat de echte
  // cijfers voor de winkels zuiver blijven.
  const omgeving = context && context.deploy && context.deploy.context;
  return getStore({ name: omgeving === 'production' ? 'winkelkliks' : 'winkelkliks-test', consistency: 'strong' });
}

export function datumNL(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(d); // JJJJ-MM-DD
}

export function veiligDeel(s) {
  return encodeURIComponent(String(s || 'onbekend')).replace(/%/g, '~').slice(0, 120);
}
export function terugDeel(s) {
  try { return decodeURIComponent(String(s).replace(/~/g, '%')); } catch (e) { return s; }
}

export function metUtm(url, categorie) {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'fusl');
  u.searchParams.set('utm_medium', 'referral');
  u.searchParams.set('utm_campaign', 'marketplace');
  if (categorie) u.searchParams.set('utm_content', String(categorie));
  return u.toString();
}

export async function laadAanbod(origin) {
  const res = await fetch(origin + '/data/aanbod.json', { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.listings) ? data.listings : [];
}

function hash(...delen) {
  const geheim = process.env.KLIK_GEHEIM || 'fusl-standaard-geheim-vervang-mij';
  return createHash('sha256').update([geheim, ...delen].join('|')).digest('hex').slice(0, 32);
}

// Telt een klik, tenzij het een bot is of dezelfde bezoeker binnen 24 uur al
// op dit stuk klikte. Geeft true terug als de klik is meegeteld.
export async function telKlik(store, { req, context, listing }) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOTS.test(ua)) return false;
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '';
  const nu = new Date();
  const vandaag = datumNL(nu);
  const gisteren = datumNL(new Date(nu.getTime() - DAG_MS));

  const sleutelVandaag = `gezien/${vandaag}/${hash(vandaag, ip, ua, listing.id)}`;
  const sleutelGisteren = `gezien/${gisteren}/${hash(gisteren, ip, ua, listing.id)}`;
  for (const k of [sleutelVandaag, sleutelGisteren]) {
    const t = await store.get(k);
    if (t && nu.getTime() - Number(t) < DAG_MS) return false;
  }
  await store.set(sleutelVandaag, String(nu.getTime()));

  const maand = vandaag.slice(0, 7);
  const sleutel = `kliks/${maand}/${veiligDeel(listing.storeId)}/${veiligDeel(listing.id)}/${nu.getTime()}-${randomBytes(3).toString('hex')}`;
  await store.set(sleutel, '1');

  if (Math.random() < 0.05) await ruimOp(store, gisteren).catch(() => {});
  return true;
}

async function ruimOp(store, gisteren) {
  for await (const pagina of store.list({ prefix: 'gezien/', paginate: true })) {
    for (const b of pagina.blobs) {
      const dag = b.key.split('/')[1];
      if (dag < gisteren) await store.delete(b.key);
    }
  }
}
