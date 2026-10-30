// /naar/<product-id>
// Stuurt de bezoeker door naar het stuk op de site van de winkel (met
// UTM-codes), en telt de doorverwijzing voor de afrekening per klik.
// Lukt het tellen niet, dan wordt de bezoeker gewoon doorgestuurd.

import { storeVoor, telKlik, laadAanbod, metUtm } from '../lib/winkelkliks.mjs';

export default async (req, context) => {
  const origin = new URL(req.url).origin;
  const terug = () => Response.redirect(origin + '/aanbod.html', 302);

  let id = '';
  try { id = decodeURIComponent(context.params.id || ''); } catch (e) { return terug(); }
  if (!id) return terug();

  let listing;
  try {
    listing = (await laadAanbod(origin)).find((l) => String(l.id) === id);
  } catch (e) {
    console.error('aanbod niet geladen', e);
  }
  if (!listing || !/^https?:\/\//i.test(listing.productUrl || '')) return terug();

  let doel;
  try { doel = metUtm(listing.productUrl, listing.category); } catch (e) { return terug(); }

  try {
    await telKlik(storeVoor(context), { req, context, listing });
  } catch (e) {
    console.error('klik niet geteld', e);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: doel, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
  });
};

export const config = { path: '/naar/:id' };
