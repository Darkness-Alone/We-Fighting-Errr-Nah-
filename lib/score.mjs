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

// ---- Headlines -------------------------------------------------------------

const H_TIERS = [
  [5, /nuclear (strike|attack|test|weapon|warhead|threat)|\bnukes?\b/],
  [4, /\binvasion|\binvades?\b|declares? war|all-out war|ballistic missile|state of emergency|martial law/],
  [3, /air ?strikes?|missiles?|\bstrikes? (on|in|kill|hit)|bombing|bombs\b|shelling|drone (attack|strike)|shoots? down|shot down|offensive|warships?|naval blockade|blockade|troops|killed in|rocket (attack|fire|strike)|rockets (hit|fired)/],
  [2, /military|ceasefire|sanctions|hostage|militia|coup|clash|rebels|artillery|drones?\b|army|navy|air force|fighter jets?|war\b|attack/],
  [1, /tensions?|threat|warns?|standoff|retaliat|escalat/],
];
const H_CALM = /ceasefire (agreed|reached|holds|deal)|peace (talks|deal|agreement)|truce|de-escalat|agrees? to/;

// Total headline heat that reads as about 63 on the index. Lower = more sensitive.
export const NEWS_SCALE = 30;

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
  return { score: clamp(100 * (1 - Math.exp(-heat / NEWS_SCALE))), heat, headlines: out };
}

// ---- Roll-up ---------------------------------------------------------------

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
