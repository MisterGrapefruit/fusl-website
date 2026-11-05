// POST /api/bezoek  { p: pad, r: referrer, u: utm_source }
// FUSL's eigen bezoekersteller, zonder cookies en zonder Google.
//
// - Paginaweergave: één klein blob per weergave, met datum en pagina.
// - Bezoeker: herkend aan een hash van (geheim + datum + IP + browser). Het
//   IP-adres zelf wordt nooit opgeslagen, en omdat de datum in de hash zit is
//   iemand van dag tot dag niet te volgen. Een "bezoeker" is dus: een unieke
//   bezoeker per dag.
// - Herkomst (Google, Instagram, direct...) wordt bij het eerste bezoek van
//   de dag vastgelegd.

import { randomBytes } from 'node:crypto';
import { storeVoor, datumNL, veiligDeel, hash, BOTS } from '../lib/winkelkliks.mjs';

const ZOEKMACHINES = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|startpagina|qwant)\./;
const SOCIAL = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['fb.', 'Facebook'], ['pinterest', 'Pinterest'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['lnkd.', 'LinkedIn'], ['whatsapp', 'WhatsApp'], ['wa.me', 'WhatsApp'], ['t.co', 'X / Twitter'], ['twitter', 'X / Twitter'], ['x.com', 'X / Twitter']];

function herkomst(ref, utm, eigenHost) {
  if (utm) return 'Campagne: ' + String(utm).toLowerCase().replace(/[^a-z0-9 _-]/g, '').slice(0, 30);
  if (!ref) return 'Direct';
  let host = '';
  try { host = new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return 'Direct'; }
  if (!host || host === eigenHost.replace(/^www\./, '') || host.endsWith('.netlify.app')) return null; // binnen de eigen site
  if (ZOEKMACHINES.test(host)) return 'Zoekmachine';
  const s = SOCIAL.find(([k]) => host.includes(k));
  if (s) return 'Social: ' + s[1];
  return 'Website: ' + host.slice(0, 40);
}

function schoonPad(p) {
  let pad = String(p || '/').split(/[?#]/)[0].toLowerCase().slice(0, 60);
  if (!/^\/[a-z0-9._\/-]*$/.test(pad)) return '/overig';
  if (pad === '/' || pad === '/index.html') return '/';
  return pad.replace(/\.html$/, '');
}

export default async (req, context) => {
  const leeg = () => new Response(null, { status: 204 });
  if (req.method !== 'POST') return leeg();
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BOTS.test(ua)) return leeg();
  let body = {};
  try { const t = await req.text(); if (t.length < 2000) body = JSON.parse(t || '{}'); } catch (e) { return leeg(); }

  const pad = schoonPad(body.p);
  if (pad.startsWith('/kliks') || pad.startsWith('/admin')) return leeg(); // beheerpagina's niet meetellen
  const db = storeVoor(context);
  const nu = Date.now();
  const dag = datumNL(new Date(nu));
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || '';
  const wie = hash('bezoeker', dag, ip, ua).slice(0, 24);

  try {
    await db.set(`pv/${dag}/${veiligDeel(pad)}/${nu}-${randomBytes(3).toString('hex')}`, '1');
    const gezien = `bezoeker/${dag}/${wie}`;
    if (!(await db.get(gezien))) {
      const bron = herkomst(body.r, body.u, new URL(req.url).hostname) || 'Direct';
      await db.set(gezien, '1');
      await db.set(`bezoekers/${dag}/${veiligDeel(bron)}/${wie}`, '1');
    }
  } catch (e) {
    console.error('bezoek niet geteld', e);
  }
  return leeg();
};

export const config = { path: '/api/bezoek' };
