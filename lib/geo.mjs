// Geography tables: country names, regions ("theaters"), and how much a matchup
// between two countries matters strategically.

// GDELT actor codes (mostly ISO alpha-3). Anything missing is shown as its code.
export const COUNTRY = {
  USA: 'US', RUS: 'Russia', UKR: 'Ukraine', CHN: 'China', TWN: 'Taiwan', IRN: 'Iran', ISR: 'Israel',
  PSE: 'Palestine', LBN: 'Lebanon', SYR: 'Syria', IRQ: 'Iraq', YEM: 'Yemen', SAU: 'Saudi Arabia',
  ARE: 'UAE', QAT: 'Qatar', BHR: 'Bahrain', KWT: 'Kuwait', OMN: 'Oman', JOR: 'Jordan', EGY: 'Egypt',
  TUR: 'Turkey', PRK: 'North Korea', KOR: 'South Korea', JPN: 'Japan', IND: 'India', PAK: 'Pakistan',
  AFG: 'Afghanistan', GBR: 'UK', FRA: 'France', DEU: 'Germany', POL: 'Poland', ITA: 'Italy', ESP: 'Spain',
  EUR: 'Europe', BLR: 'Belarus', MDA: 'Moldova', GEO: 'Georgia', ARM: 'Armenia', AZE: 'Azerbaijan',
  EST: 'Estonia', LVA: 'Latvia', LTU: 'Lithuania', FIN: 'Finland', SWE: 'Sweden', NOR: 'Norway',
  DNK: 'Denmark', NLD: 'Netherlands', BEL: 'Belgium', ROU: 'Romania', HUN: 'Hungary', CZE: 'Czechia',
  SVK: 'Slovakia', BGR: 'Bulgaria', GRC: 'Greece', SRB: 'Serbia', KSV: 'Kosovo', BIH: 'Bosnia',
  CAN: 'Canada', MEX: 'Mexico', CUB: 'Cuba', VEN: 'Venezuela', COL: 'Colombia', BRA: 'Brazil',
  ARG: 'Argentina', HTI: 'Haiti', PAN: 'Panama', ECU: 'Ecuador', PER: 'Peru', CHL: 'Chile', GUY: 'Guyana',
  AUS: 'Australia', NZL: 'New Zealand', PHL: 'Philippines', VNM: 'Vietnam', THA: 'Thailand',
  KHM: 'Cambodia', MMR: 'Myanmar', IDN: 'Indonesia', MYS: 'Malaysia', BGD: 'Bangladesh', LKA: 'Sri Lanka',
  NPL: 'Nepal', SDN: 'Sudan', SSD: 'South Sudan', ETH: 'Ethiopia', ERI: 'Eritrea', SOM: 'Somalia',
  KEN: 'Kenya', COD: 'DR Congo', RWA: 'Rwanda', UGA: 'Uganda', NGA: 'Nigeria', NER: 'Niger', MLI: 'Mali',
  BFA: 'Burkina Faso', TCD: 'Chad', LBY: 'Libya', DZA: 'Algeria', MAR: 'Morocco', TUN: 'Tunisia',
  ZAF: 'South Africa', GIN: 'Guinea', CMR: 'Cameroon', MOZ: 'Mozambique', IRL: 'Ireland', CHE: 'Switzerland',
  AUT: 'Austria', PRT: 'Portugal', KAZ: 'Kazakhstan', UZB: 'Uzbekistan', TJK: 'Tajikistan', KGZ: 'Kyrgyzstan',
};
export const countryName = (code) => COUNTRY[code] || code;

// GDELT also codes whole regions as actors ("Africa", "the West"). Too vague for a matchup,
// except Europe, which in practice means the EU.
const REGION_CODES = new Set(
  'AFR ASA BLK CRB CAU CFR CAS CEU EIN EAF EEU LAM MEA MDT NAF NMR PGS SCN SAM SAS SEA SAF WAF WST'.split(' '),
);
export const isRegionCode = (code) => REGION_CODES.has(code);

// ---- Theaters ----------------------------------------------------------------
// Each theater is matched three ways: by GDELT actor code, by GDELT place code (FIPS), and by headline words.

export const THEATERS = [
  { id: 'gulf', name: 'Iran & the Gulf', actors: 'IRN IRQ BHR QAT ARE KWT OMN', fips: 'IR IZ BA QA AE KU MU',
    re: /\biran|hormuz|khamenei|irgc|tehran|kharg|persian gulf|bahrain|qatar|\buae\b|emirates|iraq|baghdad|kuwait/ },
  { id: 'levant', name: 'Israel & the Levant', actors: 'ISR PSE LBN SYR JOR EGY', fips: 'IS GZ WE LE SY JO EG',
    re: /israel|gaza|hamas|hezbollah|lebanon|beirut|west bank|netanyahu|syria|damascus|palestin|\bidf\b|jerusalem/ },
  { id: 'redsea', name: 'Yemen & the Red Sea', actors: 'YEM SAU', fips: 'YM SA',
    re: /houthi|yemen|red sea|bab el-mandeb|saudi|sanaa|\baden\b|riyadh/ },
  { id: 'ukraine', name: 'Russia, Ukraine & NATO', actors: 'RUS UKR BLR MDA POL EST LVA LTU FIN EUR ROU', fips: 'RS UP BO MD PL EN LG LH FI RO',
    re: /ukrain|russia|putin|zelensk|kremlin|kyiv|moscow|\bnato\b|crimea|donbas|belarus|baltic|kharkiv|odesa/ },
  { id: 'pacific', name: 'China, Taiwan & the Pacific', actors: 'CHN TWN PHL JPN VNM', fips: 'CH TW RP JA VM',
    re: /taiwan|china|chinese|beijing|\bxi\b|south china sea|philippines|taipei|\bpla\b|japan|senkaku/ },
  { id: 'korea', name: 'Korean Peninsula', actors: 'PRK KOR', fips: 'KN KS', re: /korea|pyongyang|kim jong|seoul|\bdmz\b/ },
  { id: 'southasia', name: 'South Asia', actors: 'IND PAK AFG BGD', fips: 'IN PK AF BG',
    re: /\bindia|pakistan|kashmir|afghan|taliban|islamabad|new delhi|kabul|balochistan/ },
  { id: 'americas', name: 'The Americas', actors: 'VEN CUB MEX COL HTI PAN ECU GUY', fips: 'VE CU MX CO HA PM EC GY',
    re: /venezuela|cuba|mexico|colombia|maduro|haiti|panama|greenland|ecuador|cartel/ },
  { id: 'africa', name: 'Africa', actors: 'SDN SSD ETH ERI SOM COD RWA UGA NGA NER MLI BFA TCD LBY KEN GIN CMR MOZ',
    fips: 'SU OD ET ER SO CG RW UG NI NG ML UV CD LY KE GV CM MZ',
    re: /sudan|congo|sahel|\bmali\b|somalia|ethiopia|eritrea|\bniger\b|nigeria|libya|uganda|guinea|kenya|burkina|rwanda|darfur|m23|al-shabab|boko haram/ },
];
for (const t of THEATERS) {
  t.actorSet = new Set(t.actors.split(' '));
  t.fipsSet = new Set(t.fips.split(' '));
}
export const OTHER_THEATER = { id: 'other', name: 'Everywhere Else' };

export function theaterOfText(text) {
  const t = text.toLowerCase();
  for (const th of THEATERS) if (th.re.test(t)) return th.id;
  return 'other';
}
export function theaterOfFips(fips) {
  for (const th of THEATERS) if (th.fipsSet.has(fips)) return th.id;
  return 'other';
}
// A matchup belongs to the first theater either side sits in. The US is everywhere, so it never decides.
export function theaterOfDyad(a, b) {
  for (const th of THEATERS) if ((a !== 'USA' && th.actorSet.has(a)) || (b !== 'USA' && th.actorSet.has(b))) return th.id;
  return 'other';
}

// ---- Strategic weight of a matchup -------------------------------------------
// 1.0 = two nuclear-armed rivals facing each other directly. Lower = less able to end the world.

export const NUCLEAR = new Set(['USA', 'RUS', 'CHN', 'GBR', 'FRA', 'IND', 'PAK', 'ISR', 'PRK']);
const NATO = new Set(
  'USA GBR FRA DEU POL EST LVA LTU FIN SWE NOR DNK NLD BEL ITA ESP PRT GRC TUR ROU HUN CZE SVK BGR CAN EUR'.split(' '),
);
const PACIFIC_ALLIES = new Set(['TWN', 'JPN', 'KOR', 'PHL', 'AUS']);
// Nuclear pairs that are allies or partners: friction between them is talk, not a path to war.
const FRIENDLY = {
  'GBR-USA': 0.1, 'FRA-USA': 0.1, 'ISR-USA': 0.1, 'FRA-GBR': 0.1, 'GBR-ISR': 0.1, 'FRA-ISR': 0.1,
  'IND-USA': 0.15, 'GBR-IND': 0.15, 'FRA-IND': 0.15, 'IND-ISR': 0.15, 'IND-RUS': 0.2,
  'PAK-USA': 0.25, 'GBR-PAK': 0.25, 'FRA-PAK': 0.25, 'CHN-PAK': 0.2, 'CHN-RUS': 0.4, 'PRK-RUS': 0.2, 'CHN-PRK': 0.3,
};

export function dyadKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function dyadWeight(a, b) {
  const key = dyadKey(a, b);
  if (key in FRIENDLY) return FRIENDLY[key];
  const na = NUCLEAR.has(a), nb = NUCLEAR.has(b);
  if (na && nb) return 1;
  const has = (x) => a === x || b === x;
  const other = (x) => (a === x ? b : a);
  if (has('RUS') && NATO.has(other('RUS'))) return 0.8; // Article 5 territory
  if (has('CHN') && PACIFIC_ALLIES.has(other('CHN'))) return 0.8; // US treaty allies and Taiwan
  if (has('PRK') && PACIFIC_ALLIES.has(other('PRK'))) return 0.8;
  if (has('IRN') && (na || nb)) return 0.55; // threshold nuclear state against a nuclear one
  if (na || nb) return 0.35;
  return 0.15;
}

// "Gaza, Israel (general), Israel" -> "Gaza, Israel"
export function placeName(full) {
  const parts = String(full || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0], last = parts[parts.length - 1];
  return first === last ? first : `${first}, ${last}`;
}
