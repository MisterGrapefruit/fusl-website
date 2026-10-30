// Gedeelde AI-helpers: Claude aanroepen, limieten per bezoeker en een
// maandbudget. De API-sleutel staat ALLEEN in de Netlify-omgevingsvariabele
// ANTHROPIC_API_KEY, nooit in de code of in de browser.

import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

export const MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';
// Prijzen in dollar per miljoen tokens (aanpasbaar zonder codewijziging).
const PRIJS_IN = Number(process.env.AI_PRIJS_INPUT || 0.10);
const PRIJS_UIT = Number(process.env.AI_PRIJS_OUTPUT || 0.50);
const BUDGET = Number(process.env.AI_MAANDBUDGET_USD || 25);

export const STIJLEN = ['Landelijk', 'Scandinavisch', 'Industrieel', 'Knus', 'Warm minimalisme', 'Retro', 'Japandi', 'Bohemien', 'Klassiek', 'Kuststijl', 'Art Deco', 'Maximalistisch'];
export const KLEUREN = ['Naturel hout', 'Wit', 'Beige', 'Grijs', 'Zwart', 'Donkerblauw', 'Groen', 'Terracotta'];
export const SOORTEN = ['bank', 'eettafel', 'stoel', 'kast', 'bed'];

export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const aiAan = () => !!process.env.ANTHROPIC_API_KEY;

function opslag(context) {
  const omgeving = context && context.deploy && context.deploy.context;
  return getStore({ name: omgeving === 'production' ? 'ai-gebruik' : 'ai-gebruik-test', consistency: 'strong' });
}
const dag = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date());

// Controleert dag-limiet per bezoeker en het maandbudget. Geeft null terug
// als het mag, anders een foutmelding.
export async function magGebruiken(req, context, soort, perDag) {
  const db = opslag(context);
  const vandaag = dag();
  const budget = Number(await db.get(`budget/${vandaag.slice(0, 7)}`)) || 0;
  if (budget >= BUDGET) return { status: 503, fout: 'De slimme functies zijn deze maand even op. Probeer het volgende maand weer.' };
  const ip = (context && context.ip) || '';
  const wie = createHash('sha256').update([process.env.KLIK_GEHEIM || 'fusl', vandaag, ip, soort].join('|')).digest('hex').slice(0, 24);
  const sleutel = `limiet/${vandaag}/${wie}`;
  const n = Number(await db.get(sleutel)) || 0;
  if (n >= perDag) return { status: 429, fout: soort === 'moodboard' ? `Je kunt ${perDag} moodboards per dag laten herkennen. Morgen kan het weer.` : 'Je hebt vandaag veel gezocht. Gebruik gerust de filters.' };
  await db.set(sleutel, String(n + 1));
  return null;
}

async function boekKosten(context, usage) {
  if (!usage) return;
  const db = opslag(context);
  const sleutel = `budget/${dag().slice(0, 7)}`;
  const kosten = ((usage.input_tokens || 0) * PRIJS_IN + (usage.output_tokens || 0) * PRIJS_UIT) / 1e6;
  const nu = Number(await db.get(sleutel)) || 0;
  await db.set(sleutel, String(nu + kosten));
}

// Roept Claude aan en dwingt een antwoord in de vorm van één "tool".
export async function vraagClaude(context, { systeem, inhoud, tool, maxTokens = 400, timeoutMs = 20000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systeem,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: inhoud }]
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Claude ' + res.status + ': ' + ((data.error && data.error.message) || ''));
    await boekKosten(context, data.usage).catch(() => {});
    const blok = (data.content || []).find((b) => b.type === 'tool_use');
    if (!blok) throw new Error('geen antwoord');
    return blok.input;
  } finally {
    clearTimeout(timer);
  }
}
