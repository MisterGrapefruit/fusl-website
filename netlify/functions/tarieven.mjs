// GET/PUT /api/tarieven  (alleen met de rapportsleutel)
// Vergoeding per klik: een standaardtarief en per winkel eventueel een eigen
// tarief, een maximumbedrag per maand en een gratis periode (t/m maand).
// Staat bewust NIET in de publieke bestanden van de site, maar in Netlify Blobs.

import { getStore } from '@netlify/blobs';
import { controleerSleutel } from '../lib/winkelkliks.mjs';

const STANDAARD = { standaard: 0.45, winkels: {} };
const geld = (x) => { const n = Number(x); return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) / 100 : null; };

export default async (req) => {
  const fout = controleerSleutel(req);
  if (fout) return fout;
  const db = getStore({ name: 'instellingen', consistency: 'strong' });

  if (req.method === 'GET') {
    const t = (await db.get('tarieven', { type: 'json' })) || STANDAARD;
    return Response.json(t, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (req.method === 'PUT') {
    let body;
    try { body = JSON.parse(await req.text()); } catch (e) { return Response.json({ fout: 'Ongeldige gegevens.' }, { status: 400 }); }
    const uit = { standaard: geld(body.standaard) ?? STANDAARD.standaard, winkels: {}, bijgewerkt: Date.now() };
    Object.entries(body.winkels || {}).slice(0, 500).forEach(([id, w]) => {
      if (!/^[a-z0-9-]{1,80}$/.test(id) || !w) return;
      const r = {};
      if (geld(w.tarief) != null) r.tarief = geld(w.tarief);
      if (geld(w.max) != null && geld(w.max) > 0) r.max = geld(w.max);
      if (/^\d{4}-\d{2}$/.test(w.gratisTot || '')) r.gratisTot = w.gratisTot;
      if (Object.keys(r).length) uit.winkels[id] = r;
    });
    await db.setJSON('tarieven', uit);
    return Response.json(uit);
  }
  return new Response('Niet toegestaan.', { status: 405 });
};

export const config = { path: '/api/tarieven' };
