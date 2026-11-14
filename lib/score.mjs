// Scoring engine for the We Beefin Index.
// Pure functions only: no network, no clock reads except through `now` arguments.

export const STATUSES = [
  { key: 'cool', label: 'We Cool', min: 0, max: 30, color: 'green' },
  { key: 'lookin', label: 'Why They Lookin At Me', min: 30, max: 60, color: 'yellow' },
  { key: 'squared', label: 'Squared Up', min: 60, max: 85, color: 'orange' },
  { key: 'mouth', label: 'Told Ya Too Watch Ya Mouth', min: 85, max: 100, color: 'red' },
];

export const HANDSCON = [
  { level: 5, min: 0, name: 'Hands In Pockets', blurb: 'Peacetime posture. Everybody minding their business.' },
  { level: 4, min: 20, name: 'Hands On Hips', blurb: 'Side-eyes exchanged. Somebody said something slick.' },
  { level: 3, min: 40, name: 'Hands Up', blurb: 'Guard is up. Jewelry coming off, friends being held back.' },
  { level: 2, min: 60, name: 'Knuckles Cracked', blurb: 'One wrong word from a swing. Phones are out and recording.' },
  { level: 1, min: 80, name: 'Hands Thrown', blurb: 'It is on. Maximum readiness, no more talking.' },
];

export const THEATERS = [
  { id: 'iran', name: 'Iran & the Gulf', re: /\biran|hormuz|khamenei|irgc|tehran|kharg|persian gulf|bahrain|qatar|\buae\b|emirates/ },
  { id: 'levant', name: 'Israel & the Levant', re: /israel|gaza|hamas|hezbollah|lebanon|west bank|netanyahu|syria|palestin/ },
  { id: 'redsea', name: 'Yemen & the Red Sea', re: /houthi|yemen|red sea|bab el-mandeb|saudi|aden\b|taiz/ },
  { id: 'ukraine', name: 'Russia & Ukraine', re: /ukrain|russia|putin|zelensky|kremlin|kyiv|moscow|\bnato\b|crimea/ },
  { id: 'taiwan', name: 'China & Taiwan', re: /taiwan|china|chinese|beijing|\bxi\b|south china sea|philippines/ },
  { id: 'korea', name: 'Korean Peninsula', re: /korea|pyongyang|kim jong/ },
  { id: 'southasia', name: 'South Asia', re: /india|pakistan|kashmir|afghan/ },
  { id: 'americas', name: 'The Americas', re: /venezuela|cuba|mexico|greenland|colombia|maduro|haiti|panama/ },
  { id: 'africa', name: 'Africa', re: /sudan|congo|sahel|mali\b|somalia|ethiopia|niger|libya|uganda|guinea|kenya/ },
];

export function theaterOf(text) {
  const t = text.toLowerCase();
  for (const th of THEATERS) if (th.re.test(t)) return th.id;
  return 'other';
}

// ---- Markets ---------------------------------------------------------------

const M_EXCLUDE = /\b(who will|where will|how long|how many|what will|which)\b|election|minister|\bout (as|by|before)\b|leader|\bhug\b|shake hands|renames|attributed|public appearance|\bmeets?\b|meeting|endorses|seats|arrives|accused|imports|abraham accords|acquire|visits|all time high|obtains/;
const M_BREAKDOWN = /ceasefire (continues|holds)|truce (continues|holds)/;
const M_THAW = /ceasefire|peace deal|peace agreement|truce|\bdeal\b|agreement|end of .*blockade|blockade lifted|returns to normal|prisoner exchange|agrees to/;
const M_ESCALATION = [
  [5, /\bnuke|nuclear (weapon|test|detonat|strike|attack)|nuclear war/],
  [4, /\binvade|invasion|declares? war|world war/],
  [3, /military clash|military action|\bstrike|blockade|airspace clos|effectively closed|attack|\btarget|bomb|missile|(troops|forces|army|houthis) enter|no longer under/],
  [1.5, /capture/],
];

// Decide whether a market belongs in the index and which way its odds point.
//   escalation: risk = P(yes)          e.g. "Will X invade Y?"
//   breakdown:  risk = 1 - P(yes)      e.g. "Ceasefire continues through...?"
//   thaw:       risk = 1 - P(yes), low weight   e.g. "Peace deal by...?"
export function classifyMarket(text) {
  const t = text.toLowerCase();
  if (M_EXCLUDE.test(t)) return null;
  if (M_BREAKDOWN.test(t)) return { kind: 'breakdown', severity: 3 };
  if (M_THAW.test(t)) return { kind: 'thaw', severity: 2 };
  for (const [severity, re] of M_ESCALATION) if (re.test(t)) return { kind: 'escalation', severity };
  return null;
}

const KIND_WEIGHT = { escalation: 1, breakdown: 1, thaw: 0.35 };

export function marketWeight(m) {
  return m.severity * Math.log10(10 + Math.max(0, m.vol24h || 0)) * KIND_WEIGHT[m.kind];
}

// markets: [{kind, severity, pYes, vol24h}] -> adds risk + weight, returns score 0..100
export function scoreMarkets(markets, limit = 28) {
  const scored = markets
    .map((m) => {
      const risk = m.kind === 'escalation' ? m.pYes : 1 - m.pYes;
      return { ...m, risk, weight: marketWeight(m) };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
  if (!scored.length) return { score: null, markets: [] };

  const wSum = scored.reduce((s, m) => s + m.weight, 0);
  const mean = scored.reduce((s, m) => s + m.weight * m.risk, 0) / wSum;
  // "Peak" term: the hottest live escalation odds, so one market popping off moves the needle.
  const hot = scored
    .filter((m) => m.kind !== 'thaw')
    .map((m) => m.risk * Math.min(1, m.severity / 3))
    .sort((a, b) => b - a)
    .slice(0, 3);
  const peak = hot.length ? hot.reduce((s, x) => s + x, 0) / hot.length : mean;
  const score = 100 * (0.6 * mean + 0.4 * peak);
  return { score: clamp(score), mean, peak, markets: scored };
}

// ---- Headlines -------------------------------------------------------------

const H_TIERS = [
  [5, /nuclear (strike|attack|test|weapon|warhead|threat)|\bnukes?\b/],
  [4, /\binvasion|\binvades?\b|declares? war|all-out war|ballistic missile|state of emergency|martial law/],
  [3, /air ?strikes?|missiles?|\bstrikes? (on|in|kill|hit)|bombing|bombs\b|shelling|drone (attack|strike)|shoots? down|shot down|offensive|warships?|naval blockade|blockade|troops|killed in|rocket (attack|fire|strike)|rockets (hit|fired)/],
  [2, /military|ceasefire|sanctions|hostage|militia|coup|clash|rebels|artillery|drones?\b|army|navy|air force|fighter jets?|war\b|attack/],
  [1, /tensions?|threat|warns?|standoff|retaliat|escalat/],
];
const H_CALM = /ceasefire (agreed|reached|holds|deal)|peace (talks|deal|agreement)|truce|de-escalat|agrees? to/;

export function scoreHeadline(text) {
  const t = text.toLowerCase();
  let tier = 0;
  for (const [n, re] of H_TIERS) if (re.test(t)) { tier = n; break; }
  if (!tier) return { tier: 0, heat: 0 };
  const heat = H_CALM.test(t) ? tier / 2 : tier;
  return { tier, heat };
}

export function recencyWeight(ageHours) {
  if (ageHours < 6) return 1;
  if (ageHours < 24) return 0.6;
  if (ageHours < 48) return 0.3;
  return 0;
}

// headlines: [{title, time(ms)}] -> score 0..100 plus annotated list
export function scoreNews(headlines, now) {
  const out = headlines.map((h) => {
    const s = scoreHeadline(h.title + ' ' + (h.summary || ''));
    const age = (now - h.time) / 3600000;
    return { ...h, tier: s.tier, heat: s.heat * recencyWeight(age) };
  });
  if (!out.length) return { score: null, heat: 0, headlines: out };
  const heat = out.reduce((s, h) => s + h.heat, 0);
  return { score: clamp(100 * (1 - Math.exp(-heat / 45))), heat, headlines: out };
}

// ---- Roll-up ---------------------------------------------------------------

export function combine(marketScore, newsScore) {
  if (marketScore == null && newsScore == null) return null;
  if (marketScore == null) return Math.round(newsScore);
  if (newsScore == null) return Math.round(marketScore);
  return Math.round(0.6 * marketScore + 0.4 * newsScore);
}

export function statusFor(index) {
  return STATUSES.find((s) => index < s.max) || STATUSES[STATUSES.length - 1];
}

// nukeHeat (0..1) can push the posture one step tighter than the index alone.
export function handsConFor(index, nukeHeat = 0) {
  let i = 0;
  for (let k = 0; k < HANDSCON.length; k++) if (index >= HANDSCON[k].min) i = k;
  if (nukeHeat >= 0.25 && i < HANDSCON.length - 1) i += 1;
  return HANDSCON[i];
}

// Our own clock: 100 on the index = midnight, 0 = a full 12 minutes out.
export function beefClockSeconds(index) {
  return Math.round(720 * Math.pow(1 - clamp(index) / 100, 1.5));
}

export function clamp(x, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, x));
}
