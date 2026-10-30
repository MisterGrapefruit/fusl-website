// Gedeelde selecties en reacties (duimpjes), zonder accounts.
//
//   POST   /api/selectie                    nieuwe deellink  -> { id, sleutel }
//   GET    /api/selectie/:id                selectie bekijken (iedereen met de link)
//   PUT    /api/selectie/:id                selectie bijwerken      (alleen eigenaar)
//   DELETE /api/selectie/:id                link uitzetten + reacties wissen (eigenaar)
//   GET    /api/selectie/:id/reacties       alle reacties ophalen   (alleen eigenaar)
//   POST   /api/selectie/:id/reactie        reactie geven (voornaam + duimpjes)
//
// De eigenaar bewijst zich met de geheime "sleutel" die alleen in zijn eigen
// browser staat (header X-Eigenaar). We bewaren daarvan alleen een hash.
// Er worden geen e-mailadressen of IP-adressen opgeslagen; van wie reageert
// alleen de voornaam die diegene zelf invult.

import { getStore } from '@netlify/blobs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const MAX_STUKKEN = 60;
const MAX_REAGEERDERS = 30;
const MAX_BODY = 40000;

function store(context) {
  const omgeving = context && context.deploy && context.deploy.context;
  return getStore({ name: omgeving === 'production' ? 'selecties' : 'selecties-test', consistency: 'strong' });
}

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const fout = (bericht, status) => json({ fout: bericht }, status);
const hash = (s) => createHash('sha256').update(String(s)).digest('hex');
const tekst = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const geldigId = (id) => /^[A-Za-z0-9_-]{16,32}$/.test(id || '');

function isEigenaar(req, deel) {
  const sleutel = req.headers.get('x-eigenaar') || '';
  if (!sleutel || !deel || !deel.eigenaarHash) return false;
  const a = Buffer.from(hash(sleutel)), b = Buffer.from(deel.eigenaarHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Alleen de velden die we nodig hebben om een stuk te tonen.
function schoonStuk(p) {
  if (!p || !p.id) return null;
  const getal = Number(p.price);
  return {
    id: tekst(p.id, 120), name: tekst(p.name, 120), store: tekst(p.store, 80), storeId: tekst(p.storeId, 80) || null,
    type: p.type === 'keten' ? 'keten' : 'lokaal', category: tekst(p.category, 30), color: tekst(p.color, 30),
    style: tekst(p.style, 40), price: Number.isFinite(getal) ? Math.round(getal) : null, status: tekst(p.status, 40),
    live: !!p.live, link: !!p.link
  };
}

async function leesBody(req) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) throw new Error('te groot');
  return raw ? JSON.parse(raw) : {};
}

async function verkochtLijst(origin, stukken) {
  // Een echt (live) stuk dat niet meer in het aanbod staat, is verkocht.
  if (!stukken.some((s) => s.live)) return new Set();
  try {
    const res = await fetch(origin + '/data/aanbod.json');
    if (!res.ok) return new Set();
    const data = await res.json();
    const nog = new Set((data.listings || []).filter((l) => l.inStock !== false).map((l) => String(l.id)));
    return new Set(stukken.filter((s) => s.live && !nog.has(s.id)).map((s) => s.id));
  } catch (e) {
    return new Set();
  }
}

export default async (req, context) => {
  const db = store(context);
  const { id, actie } = context.params || {};
  const origin = new URL(req.url).origin;

  try {
    // Nieuwe deellink
    if (!id) {
      if (req.method !== 'POST') return fout('Niet toegestaan.', 405);
      const body = await leesBody(req);
      const stukken = (Array.isArray(body.stukken) ? body.stukken : []).slice(0, MAX_STUKKEN).map(schoonStuk).filter(Boolean);
      if (!stukken.length) return fout('Je selectie is leeg.', 400);
      const nieuwId = randomBytes(12).toString('base64url');
      const sleutel = randomBytes(24).toString('base64url');
      await db.setJSON(`delen/${nieuwId}`, {
        naam: tekst(body.naam, 40), stukken, eigenaarHash: hash(sleutel), gemaakt: Date.now(), bijgewerkt: Date.now()
      });
      return json({ id: nieuwId, sleutel }, 201);
    }

    if (!geldigId(id)) return fout('Deze link bestaat niet (meer).', 404);
    const deel = await db.get(`delen/${id}`, { type: 'json' });
    if (!deel) return fout('Deze link bestaat niet (meer).', 404);

    if (!actie) {
      if (req.method === 'GET') {
        const verkocht = await verkochtLijst(origin, deel.stukken);
        return json({
          naam: deel.naam,
          bijgewerkt: deel.bijgewerkt,
          stukken: deel.stukken.map((s) => Object.assign({}, s, { verkocht: verkocht.has(s.id) }))
        });
      }
      if (!isEigenaar(req, deel)) return fout('Alleen de maker van de selectie kan dit.', 403);
      if (req.method === 'PUT') {
        const body = await leesBody(req);
        if (Array.isArray(body.stukken)) deel.stukken = body.stukken.slice(0, MAX_STUKKEN).map(schoonStuk).filter(Boolean);
        if (body.naam !== undefined) deel.naam = tekst(body.naam, 40);
        deel.bijgewerkt = Date.now();
        await db.setJSON(`delen/${id}`, deel);
        return json({ ok: true });
      }
      if (req.method === 'DELETE') {
        for await (const pagina of db.list({ prefix: `reacties/${id}/`, paginate: true })) {
          for (const b of pagina.blobs) await db.delete(b.key);
        }
        await db.delete(`delen/${id}`);
        return json({ ok: true });
      }
      return fout('Niet toegestaan.', 405);
    }

    if (actie === 'reacties' && req.method === 'GET') {
      if (!isEigenaar(req, deel)) return fout('Alleen de maker van de selectie kan dit.', 403);
      const lijst = [];
      for await (const pagina of db.list({ prefix: `reacties/${id}/`, paginate: true })) {
        for (const b of pagina.blobs) {
          const r = await db.get(b.key, { type: 'json' });
          if (r) lijst.push({ voornaam: r.voornaam, oordelen: r.oordelen || {}, bijgewerkt: r.bijgewerkt });
        }
      }
      lijst.sort((a, b) => b.bijgewerkt - a.bijgewerkt);
      return json({ reacties: lijst });
    }

    if (actie === 'reactie' && req.method === 'POST') {
      const body = await leesBody(req);
      const reageerder = tekst(body.reageerder, 40);
      const voornaam = tekst(body.voornaam, 30);
      if (!/^[A-Za-z0-9_-]{8,40}$/.test(reageerder) || !voornaam) return fout('Vul eerst je voornaam in.', 400);
      const sleutel = `reacties/${id}/${hash(reageerder).slice(0, 24)}`;
      let r = await db.get(sleutel, { type: 'json' });
      if (!r) {
        let aantal = 0;
        for await (const pagina of db.list({ prefix: `reacties/${id}/`, paginate: true })) aantal += pagina.blobs.length;
        if (aantal >= MAX_REAGEERDERS) return fout('Er hebben al veel mensen gereageerd op deze selectie.', 429);
        r = { oordelen: {} };
      }
      r.voornaam = voornaam;
      const ids = new Set(deel.stukken.map((s) => s.id));
      const oordelen = body.oordelen && typeof body.oordelen === 'object' ? body.oordelen : {};
      Object.keys(oordelen).forEach((k) => {
        if (!ids.has(k)) return;
        if (oordelen[k] === 'op' || oordelen[k] === 'neer') r.oordelen[k] = oordelen[k];
        else delete r.oordelen[k];
      });
      r.bijgewerkt = Date.now();
      await db.setJSON(sleutel, r);
      return json({ ok: true, oordelen: r.oordelen });
    }

    return fout('Niet gevonden.', 404);
  } catch (e) {
    console.error('selectie-fout', e);
    return fout('Er ging iets mis. Probeer het later nog eens.', 500);
  }
};

export const config = { path: ['/api/selectie', '/api/selectie/:id', '/api/selectie/:id/:actie'] };
