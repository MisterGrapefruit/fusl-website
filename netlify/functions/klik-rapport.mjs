// /api/klik-rapport?maand=2026-11[&formaat=csv][&test=1]   (rapportsleutel via header x-rapport-sleutel)
// Overzicht van doorverwijzingen per winkel, per stuk, per dag en per bron,
// plus de bezoekers van FUSL's eigen teller. Basis voor de maandfactuur per klik.

import { getStore } from '@netlify/blobs';
import { datumNL, terugDeel, laadAanbod, controleerSleutel } from '../lib/winkelkliks.mjs';

async function alleSleutels(store, prefix) {
  const uit = [];
  for await (const pagina of store.list({ prefix, paginate: true })) pagina.blobs.forEach((b) => uit.push(b.key));
  return uit;
}

export default async (req) => {
  const fout = controleerSleutel(req);
  if (fout) return fout;
  const url = new URL(req.url);

  const maand = /^\d{4}-\d{2}$/.test(url.searchParams.get('maand') || '') ? url.searchParams.get('maand') : datumNL().slice(0, 7);
  const store = getStore({ name: url.searchParams.get('test') ? 'winkelkliks-test' : 'winkelkliks', consistency: 'strong' });

  // ---- Kliks naar winkels ----
  const winkels = {};
  const perDag = {};
  const perBron = {};
  for (const key of await alleSleutels(store, `kliks/${maand}/`)) {
    const [, , winkel, product, rest = ''] = key.split('/');
    const [ts, , bron = 'onbekend'] = rest.split('-');
    const w = (winkels[winkel] = winkels[winkel] || { kliks: 0, producten: {} });
    w.kliks += 1;
    w.producten[product] = (w.producten[product] || 0) + 1;
    const dag = Number(ts) ? datumNL(new Date(Number(ts))) : null;
    if (dag) perDag[dag] = (perDag[dag] || 0) + 1;
    perBron[bron] = (perBron[bron] || 0) + 1;
  }

  // ---- Bezoekers (eigen teller) ----
  const bezoek = { bezoekers: 0, weergaven: 0, perDag: {}, herkomst: {}, paginas: {} };
  for (const key of await alleSleutels(store, `bezoekers/${maand}-`)) {
    const [, dag, bron] = key.split('/');
    bezoek.bezoekers += 1;
    const d = (bezoek.perDag[dag] = bezoek.perDag[dag] || { bezoekers: 0, weergaven: 0 });
    d.bezoekers += 1;
    const b = terugDeel(bron);
    bezoek.herkomst[b] = (bezoek.herkomst[b] || 0) + 1;
  }
  // Oudere dagen zijn samengevat tot totalen (zonder dagcodes)
  for (const key of await alleSleutels(store, `dagtotaal/${maand}-`)) {
    const dag = key.split('/')[1];
    const herkomst = (await store.get(key, { type: 'json' })) || {};
    Object.entries(herkomst).forEach(([b, n]) => {
      bezoek.bezoekers += n;
      const d = (bezoek.perDag[dag] = bezoek.perDag[dag] || { bezoekers: 0, weergaven: 0 });
      d.bezoekers += n;
      bezoek.herkomst[b] = (bezoek.herkomst[b] || 0) + n;
    });
  }
  for (const key of await alleSleutels(store, `pv/${maand}-`)) {
    const [, dag, pad] = key.split('/');
    bezoek.weergaven += 1;
    const d = (bezoek.perDag[dag] = bezoek.perDag[dag] || { bezoekers: 0, weergaven: 0 });
    d.weergaven += 1;
    const p = terugDeel(pad);
    bezoek.paginas[p] = (bezoek.paginas[p] || 0) + 1;
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
  return Response.json({ maand, totaal: rijen.reduce((s, r) => s + r.kliks, 0), winkels: rijen, perDag, perBron, bezoek },
    { headers: { 'Cache-Control': 'no-store' } });
};

export const config = { path: '/api/klik-rapport' };
