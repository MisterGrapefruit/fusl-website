// /api/klik-rapport?maand=2026-11&sleutel=...[&formaat=csv][&test=1]
// Overzicht van doorverwijzingen per winkel en per stuk, als basis voor de
// maandfactuur per klik. Beveiligd met de omgevingsvariabele RAPPORT_SLEUTEL
// (instellen in Netlify: Site configuration > Environment variables).

import { getStore } from '@netlify/blobs';
import { datumNL, terugDeel, laadAanbod } from '../lib/winkelkliks.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const geheim = process.env.RAPPORT_SLEUTEL;
  if (!geheim) return new Response('Stel eerst RAPPORT_SLEUTEL in bij de Netlify-omgevingsvariabelen.', { status: 503 });
  const gegeven = url.searchParams.get('sleutel') || req.headers.get('x-rapport-sleutel');
  if (gegeven !== geheim) return new Response('Geen toegang.', { status: 401 });

  const maand = /^\d{4}-\d{2}$/.test(url.searchParams.get('maand') || '') ? url.searchParams.get('maand') : datumNL().slice(0, 7);
  const store = getStore({ name: url.searchParams.get('test') ? 'winkelkliks-test' : 'winkelkliks', consistency: 'strong' });

  const winkels = {};
  for await (const pagina of store.list({ prefix: `kliks/${maand}/`, paginate: true })) {
    for (const b of pagina.blobs) {
      const [, , winkel, product] = b.key.split('/');
      const w = (winkels[winkel] = winkels[winkel] || { kliks: 0, producten: {} });
      w.kliks += 1;
      w.producten[product] = (w.producten[product] || 0) + 1;
    }
  }

  let aanbod = [];
  try { aanbod = await laadAanbod(url.origin); } catch (e) {}
  const naamWinkel = (id) => (aanbod.find((l) => l.storeId === id) || {}).storeName || id;
  const naamProduct = (id) => (aanbod.find((l) => String(l.id) === id) || {}).name || id;

  const rijen = Object.entries(winkels).map(([w, v]) => ({
    winkelId: terugDeel(w),
    winkel: naamWinkel(terugDeel(w)),
    kliks: v.kliks,
    producten: Object.entries(v.producten)
      .map(([p, n]) => ({ productId: terugDeel(p), product: naamProduct(terugDeel(p)), kliks: n }))
      .sort((a, b) => b.kliks - a.kliks)
  })).sort((a, b) => b.kliks - a.kliks);

  if (url.searchParams.get('formaat') === 'csv') {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const lijnen = ['maand;winkel;product;kliks'];
    rijen.forEach((r) => r.producten.forEach((p) => lijnen.push([maand, q(r.winkel), q(p.product), p.kliks].join(';'))));
    return new Response(lijnen.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="fusl-kliks-${maand}.csv"` }
    });
  }
  return Response.json({ maand, totaal: rijen.reduce((s, r) => s + r.kliks, 0), winkels: rijen });
};

export const config = { path: '/api/klik-rapport' };
