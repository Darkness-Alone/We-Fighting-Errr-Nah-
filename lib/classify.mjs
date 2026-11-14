// Reads a headline (or a headline-shaped URL slug) and decides how much smoke is in it.
// Pure text rules, no network. Tuned against live feeds; see test/classify.test.mjs for the cases it must get right.

export const BEEF_TYPES = [
  { tier: 0, name: 'No Smoke' },
  { tier: 1, name: "Talkin' Spicy", what: 'threats, warnings, tension' },
  { tier: 2, name: "Flexin'", what: 'troops, drills, sanctions, deployments' },
  { tier: 3, name: "Swingin'", what: 'strikes, clashes, people getting hit' },
  { tier: 4, name: 'Full Send', what: 'invasions, missile barrages, war declared' },
  { tier: 5, name: 'Nuclear Option', what: 'nuclear threats, tests or use' },
];
export const CALM_NAME = "Squashin' It";

const any = (...res) => new RegExp(res.map((r) => r.source).join('|'));

export function norm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’']s\b/g, '')
    .replace(/[‘’“”'"]/g, '')
    .replace(/[–—]/g, ' ')
    .replace(/\bu\.s\.?(a\.?)?(?=\s|$)/g, 'us')
    .replace(/\bu\.k\.?(?=\s|$)/g, 'uk')
    .replace(/\s+/g, ' ')
    .trim();
}

// Phrases that contain a trigger word but are not beef. Blanked out before anything else runs.
const NOISE = any(
  /\b(trade|price|culture|bidding|turf|console|streaming|chip|tariff|browser|ratings|gang|drug|talent|civil rights|class|currency|fare|subsidy) wars?\b/,
  /\bwar (on|against) (drugs|cancer|poverty|christmas|crime|inflation|waste|woke\w*|obesity|terror)\b/,
  /\bwar of words\b/,
  /\b(heart|panic|asthma|shark|bear|dog|acid|anxiety|knife|bee) attacks?\b/,
  /\b(hunger|labou?r|rail|train|tube|bus|teachers?|doctors?|nurses?|workers?|general|lightning|writers?|actors?|pilots?|union|transit|postal|dock|school|garbage|pay|rent|drivers?|staff|strike) strikes?\b/,
  /\bstrikes? (action|ballot|vote|deal|notice|a (deal|chord|balance|pose|tone)|gold|out|again for)\b/,
  /\b(on|goes? on|went on|going on|out on|end(s|ed)? their|threaten(s|ed)? to) strike\b/,
  /\bthree strikes\b|\bstrikers?\b|\bbombshell\w*\b|\b(photo|bath|box office|f|sex|glitter|stink) ?bombs?\b/,
  /\b(nuclear) (family|medicine)\b|\bgo(es|ing)? nuclear on\b|\bnuclear option (in|on|for) (the )?(senate|filibuster)\b/,
  /\barmy of (fans|volunteers|lawyers|bots|supporters|lobbyists)\b|\bsalvation army\b|\bold navy\b|\bnavy (blue|pier|federal)\b/,
  /\b(battle|fight|war|attack|assault|offensive|raid|invasion|siege)s? (of|on|against|over|with|for) (the )?(bulge|cancer|inflation|obesity|covid|flu|measles|climate|fraud|waste|addiction|hunger|homelessness|potholes|weeds|ants|rats|mosquito\w*)\b/,
  /\bcharm offensive\b|\boffensive (line|lineman|coordinator|rebound|comments?|remarks?|language|joke|post|tweet)\b/,
  /\bmissile(s)? of (october|love)\b|\brocket (league|mortgage|man)\b|\bsiege of (troy|orleans)\b/,
);

const SPORTS = /\b(football|soccer|nba|nfl|mlb|nhl|ncaa|premier league|champions league|la liga|bundesliga|world cup|cricket|rugby|tennis|golf|formula (1|one)|\bf1\b|grand prix|olympi\w+|playoffs?|quarterback|midfielder|goalkeeper|touchdown|innings|wicket|tournament|\bufc\b|\bmma\b|boxing|\bwwe\b|wrestl\w+|fantasy|super bowl|hat[- ]trick|transfer window|head coach|preseason|postseason|halftime|box score|highlights|\bvs\b|\bipl\b|test match|wimbledon|marathon|medal)\b/;
const ENTERTAINMENT = /\b(movies?|films?|trailer|episode|netflix|hbo|disney|marvel|star wars|album|concert|celebrit\w+|box office|recap|spoilers?|video ?games?|gaming|gamers?|playstation|xbox|nintendo|anime|tv (show|series)|sitcom|series finale|call of duty|fortnite|game of thrones|oscars?|grammys?|emmys?|bollywood|hollywood|k-?pop|novel|book review|podcast|comedian|reality tv|lego|pokemon|minecraft|warhammer|warcraft|sci[- ]fi|thriller|worldbuilding|binge|box set|soundtrack|blockbuster|sequel|prequel|franchise|apple tv|prime video|streaming|cosplay|comic)\b/;
const CRIME = /\b(gunman|shooter|mass shooting|school shooting|drive[- ]by|stabb\w+|murder\w*|homicide|manslaughter|sheriff|deputies|deputy|troopers?|police (say|said|arrest\w*|search\w*|investigat\w+|chief|officers?|shooting|will not)|arrest(ed|s)?|charged with|charges|pleads?|pleaded|sentenc\w+|jury|verdict|on trial|lawsuit|sues?|sued|court|judge|attorney|prosecut\w+|indict\w+|burglar\w*|robber\w*|carjack\w*|domestic violence|road rage|drunk driv\w+|\bdui\b|car crash|car accident|wreck|firefighters?|wildfire|house fire|inmates?|prison|jail|parole|suspects?|shoplift\w*|overdose|fentanyl|traffick\w+|bail|probation|felony|misdemeanor|standoff with police|swat)\b/;
const MIL = /\b(military|army|troops|soldiers?|air ?strikes?|missiles?|drones?|rebels?|militants?|insurgents?|navy|naval|invasion|shelling|artillery|ceasefire|idf|hamas|hezbollah|houthis?|kremlin|pentagon|nato|warships?|fighter jets?|irgc|taliban|isis|islamic state|peacekeepers|war crimes?|battlefield|front ?lines?|centcom|air force|marines|junta|coup|blockade)\b/;
const HISTORY = /\b(hiroshima|nagasaki|anniversary|tribunal|memorial|museum|historians?|documentary|oppenheimer|cold war|remembrance|commemorat\w+|years ago|decades ago|world war (ii|2|two|i|1|one)\b|wwii|ww2|wwi\b|ww1|vietnam war|korean war|civil war|veterans? day|armistice day|d-?day|holocaust|centur(y|ies)|ancient|medieval|archaeolog\w+|shipwreck|declassified|obituar\w+|dies at|died at|reef|divers?|salvage|tomb of the unknown)\b/;
const PROTEST = /\b(protest\w*|demonstrat\w+|rally|rallies|marchers?|riot police|students|picket\w*|trade unions?|strikers|general strike|strike action|walkouts?)\b/;
const SPACE = /\b(spacex|starship|falcon (9|heavy)|nasa|artemis|blue origin|rocket lab|starlink|satellite launch|astronauts?|space station|lunar|moon mission)\b/;

const TIER5 = any(
  /\bnuclear (strike|strikes|attack|war|warfare|bomb|bombs|blast|explosion|detonation|weapons? (use|test|launch)|test|tests|tested|testing|threat|threats|blackmail|sab(er|re)|escalation|alert|drill|exchange|retaliation|response|first strike|missile test|readiness|holocaust|armageddon|showdown|brink|standoff)\b/,
  /\b(tests?|tested|testing|detonat\w+|fires?|fired|launch(es|ed)?|us(es|ed|ing)|deploy(s|ed)?|threatens?( to use)?) (a |an |its |the |tactical |new |first )*(nuclear|atomic|hydrogen|thermonuclear)\b/,
  /\bnukes?\b|\batomic (bomb|weapon|blast|attack)\w*\b|\bhydrogen bomb\b|\btactical nuclear\b|\bdirty bomb\b|\bradiological (attack|weapon)\b/,
  /\bicbms?\b|\bintercontinental ballistic\b|\bdoomsday\b|\bworld war (3|iii|three)\b|\bww3\b|\bwwiii\b|\bmushroom cloud\b|\bdefcon\b|\bnuclear[- ]armed (missile|submarine|bomber)s? (launch|fir|test|patrol|deploy)\w*/,
);

const TIER4 = any(
  /\binva(de|des|ded|ding|sion)\b|\bdeclar(e|es|ed|ation of) war\b|\ball[- ]out war\b|\bfull[- ]scale (war|invasion|offensive|attack|assault)\b/,
  /\bground (offensive|invasion|incursion|assault|operation)\b|\bat war with\b|\bwar (breaks out|erupts|begins|has begun)\b|\bstate of war\b|\bact of war\b/,
  /\bballistic missiles?\b|\bhypersonic missiles?\b|\bcruise missiles? (strike|attack|hit|barrage)\w*|\bmartial law\b|\b(general|mass|full) mobili[sz]ation\b/,
  /\b(massive|large[- ]scale|major|wave of|waves of|barrage of|unprecedented|biggest|largest|heaviest) (air ?strikes?|missile|drone|bombardment|attack|strikes|assault|offensive|barrage)\b/,
  /\b(sinks?|sunk|sinking) (a |an |the |us |russian |chinese |iranian )?(warship|destroyer|frigate|carrier|submarine|navy)\b/,
  /\b(warship|destroyer|frigate|submarine|aircraft carrier) (sunk|hit|struck|attacked|destroyed)\b/,
  /\b(shoots?|shot) down (a |an |the |us |russian |chinese |israeli |iranian |two |three |several )*(fighter|jet|warplane|bomber|aircraft|plane|helicopter)s?\b/,
  /\bmilitary coup\b|\bcoup d ?etat\b|\bchemical (weapons?|attack)\b|\bbiological (weapons?|attack)\b|\bcarpet bomb\w*|\bnaval blockade\b/,
  /\bstrikes? (on|against|hit|hits|target|targets) .{0,30}(nuclear|enrichment) (site|sites|facilit\w+|plant|reactor)/,
  /\b(embassy|consulate) (bombed|attacked|stormed|hit)\b|\bcapital (falls|captured|seized|under attack)\b|\bno[- ]fly zone (declared|imposed|enforced)\b/,
  /\bassassinat(e|es|ed|ion of) .{0,25}(president|prime minister|supreme leader|general|commander|minister)/,
);

const TIER3 = any(
  /\bair ?strikes?\b|\bair raids?\b|\bmissiles? (strike|attack|hit|fired|launch|barrage|kill|land|slam)\w*|\b(fires?|fired|launch(es|ed)?) .{0,15}(missiles?|rockets?|drones?|torpedo\w*)/,
  /\brockets? (attack|fire|barrage|strike|hit|land)\w*|\bdrones? (attack|strike|barrage|swarm|hit|kill|shot down|downed|intercepted)\w*|\b(shoots?|shot|shooting) down\b/,
  /\bdowns? (a |an |the |two |three |several )?(drone|missile|jet|aircraft|uav)s?\b|\bintercept(s|ed|ing)? .{0,20}(missile|drone|rocket|jet|aircraft|bomber|warplane)s?/,
  /\bshell(ing|ed)\b|\bbombard(s|ed|ment)\b|\bbomb(ing|ings|ed)\b|\bartillery (fire|strike|barrage|duel|exchange)\w*|\bmortar (fire|attack|shell)\w*/,
  /\bstrikes? (on|in|against|near|across|kill|kills|killed|hit|hits|target|targets|destroy|destroys|wound|wounds|leave|leaves)\b/,
  /\b(israeli|russian|ukrainian|us|american|iranian|saudi|turkish|pakistani|indian|chinese|coalition|military|army|navy|drone|missile) strikes?\b/,
  /\bkill(s|ed|ing)? .{0,40}\b(soldiers?|troops|civilians?|fighters|militants|officers|sailors|marines|peacekeepers|commander|general)\b/,
  /\b(soldiers?|troops|civilians|fighters|militants|peacekeepers) (killed|dead|die|wounded|captured)\b/,
  /\b(killed|dead|die|dies|wounded|injured) (in|after|as|by) .{0,30}(strike|strikes|attack|attacks|shelling|raid|clash|clashes|bombing|fighting|ambush|blast|offensive)\b/,
  /\b(border|deadly|armed|fierce|heavy|military) (clash|clashes|fighting|battle|battles)\b|\bclash(es|ed)? (with|between|along|at|near|erupt|kill|leave)\w*\b/,
  /\bfighting (rages|erupts|intensifies|continues|breaks out|grips|kills|between|in|near|around)\b|\bambush(es|ed)?\b|\b(counter)?[- ]?offensive\b/,
  /\b(ground|night|commando|special forces|military|cross[- ]border) raids?\b|\bcross[- ]border (attack|strike|fire|shelling|raid|incursion)s?\b|\bincursions?\b|\bblockades?\b/,
  /\bsei[sz](e|es|ed|ure of) (a |an |the |two )?(ship|tanker|vessel|cargo|town|village|city|base|territory|island|oil)\w*\b/,
  /\b(tanker|ship|vessel|cargo ship|freighter) (attacked|hit|struck|seized|hijacked|sunk|boarded|disabled)\b|\bhijack(s|ed|ing)?\b|\bhostages?\b/,
  /\b(car|suicide|roadside|truck) bomb(ing|er|s)?\b|\b(insurgents?|militants?|rebels?|jihadists?|gunmen|separatists?) (kill|attack|storm|seize|overrun|ambush|capture)\w*/,
  /\btorpedo(es|ed)?\b|\b(troops|forces|tanks|soldiers|army) (enter|enters|entered|cross|crosses|crossed|storm|storms|stormed|advance|advances|push into|pushes into|move into|roll into|capture|captures|captured|seize|seizes|retake|retakes)\b/,
  /\bcaptur(e|es|ed) (the )?(town|village|city|base|airport|port|district|territory)\b|\b(mass |civilian )?casualties\b|\bwar crimes?\b|\bmassacres?\b|\bgenocide\b|\bethnic cleansing\b/,
  /\bexplosions? (rock|rocks|rocked|hit|hits|heard|kill|kills|reported in|shake)\b|\bblasts? (rock|rocks|rocked|hit|hits|kill|kills)\b|\bsieges?\b|\bbesieged\b|\bsnipers?\b/,
  /\bwarplanes? (bomb|strike|hit|attack)\w*|\bnaval (clash|battle|skirmish)\w*|\bskirmish(es)?\b|\bexchange(d|s)? (of )?fire\b|\bopen(s|ed)? fire\b|\bfir(es|ed) (on|at|upon)\b|\bwarning shots\b/,
  /\battack(s|ed)? (on|against) .{0,30}(base|embassy|convoy|ship|tanker|troops|soldiers|army|military|airport|port|pipeline|refinery|oil|power (plant|grid)|border|village|town|city|tower)/,
  /\b(drone|missile|rocket|air|bomb|suicide|militant|terror|terrorist|jihadist|rebel|insurgent|armed|military|cross-border|mortar|artillery|naval|grenade|enemy) attacks?\b/,
  /\bdestroy(s|ed)? .{0,25}(tank|jet|warship|radar|base|depot|bridge|air defen[cs]e|launcher|drone)s?\b|\b(disable|disables|disabled) .{0,20}(vessel|ship|tanker|warship)\b/,
  // "Three killed in Russia": no weapon named, but in an active war zone the cause is not in doubt.
  /\b(killed|dead|wounded) in (russia|ukraine|gaza|israel|lebanon|syria|yemen|iran|iraq|sudan|kashmir|donbas|kyiv|kharkiv|odesa|belgorod|kursk|crimea|the west bank|rafah|beirut|damascus|sanaa|tehran)\b/,
  /\b(hit|hits|hitting|struck|strikes) (a |sea |naval )?mines?\b|\b(sea|naval|limpet) mines?\b|\bmin(ed|ing) (the )?(strait|waters|harbou?r|port)\b/,
);

const TIER2 = any(
  /\bmilitary\b|\btroops?\b|\bsoldiers?\b|\barmy\b|\bnavy\b|\bnaval\b|\bair force\b|\bmarines\b|\bwarships?\b|\baircraft carriers?\b|\bcarrier (strike )?group\b|\bdestroyers?\b|\bfrigates?\b/,
  /\bfighter jets?\b|\bwarplanes?\b|\bbombers?\b|\bsubmarines?\b|\bdeploy(s|ed|ing|ment|ments)?\b|\bmobili[sz]\w+\b|\breservists?\b|\bconscript\w*\b|\bwar ?games\b/,
  /\b(military|naval|joint|live[- ]fire) (drills?|exercises?)\b|\bsanctions?\b|\bembargo\b|\barms (sale|sales|deal|shipment|shipments|embargo|race|transfer)\b/,
  /\bweapons? (shipment|sale|deliver|package|transfer|stockpile|depot)\w*\b|\bceasefire\b|\btruce\b|\bmilitias?\b|\brebels?\b|\bjunta\b|\bcoup\b|\binsurgen\w+\b|\bmilitants?\b/,
  /\bdefen[cs]e (minister|ministry|secretary|pact|budget|spending|chief|forces|system)\b|\bwar (secretary|department|minister|cabinet|footing|zone|effort)\b|\bpentagon\b|\bnato\b|\bcentcom\b/,
  /\bmissile (test|tests|tested|defen[cs]e|system|systems|launch|program)\b|\bair defen[cs]es?\b|\bpatriot (missile|batter)\w*\b|\biron dome\b|\bmissiles?\b|\bmunitions?\b|\bammunition\b/,
  /\bexpel(s|led)? .{0,20}(diplomats?|ambassador|envoy)\b|\brecall(s|ed)? (its )?ambassador\b|\b(embassy|consulate) (closes|closed|evacuat\w+)\b|\bevacuat(e|es|ed|ion)s? .{0,20}(embassy|citizens|nationals|staff|diplomats)\b/,
  /\bborder (closed|closure|tension|tensions|standoff|dispute|crisis|troops|buildup|build-up)\b|\btroop (buildup|build-up|surge|movements?)\b|\bdrones?\b|\buavs?\b|\bwar\b|\bwartime\b|\bfront ?lines?\b/,
  /\boccup(y|ies|ied|ation)\b|\bannex\w*\b|\bhamas\b|\bhezbollah\b|\bhouthis?\b|\birgc\b|\brevolutionary guards?\b|\bidf\b|\bwagner\b|\bcombat\b|\bairspace (closed|closure|violation|incursion)\b/,
  /\bjets? scrambl\w+\b|\bscrambl(e|es|ed) (jets|fighters)\b|\buranium\b|\benrichment\b|\bwarheads?\b|\bnuclear (program|programme|site|sites|facilit\w+|capabilit\w+|ambitions|weapons?|arsenal|stockpile|deterren\w+|submarine|posture|doctrine|umbrella|powers?|armed)\b/,
  /\bstrait of hormuz\b|\btaiwan strait\b|\bsouth china sea\b|\bdmz\b|\bterroris\w+\b|\bjihadis\w+\b|\bisis\b|\bislamic state\b|\bal[- ]qaeda\b|\btaliban\b|\bparamilitar\w+\b|\bmercenar\w+\b|\bprisoners? of war\b/,
);

const TIER1 = any(
  /\btensions?\b|\bthreat(en|ens|ened|ening|s)?\b|\bwarn(s|ed|ing|ings)?\b|\bstand-?off\b|\bretaliat\w+\b|\bescalat\w+\b|\bultimatum\b|\bred lines?\b|\bprovocat\w+\b|\bcondemn(s|ed)?\b/,
  /\bvow(s|ed)? (revenge|to respond|response|to retaliate|retaliation|to strike|to defend)\b|\bsab(re|er)[- ]rattl\w+\b|\bbrink\b|\bshowdown\b|\bhostil\w+\b|\baggression\b/,
  /\bsummon(s|ed)? .{0,20}(ambassador|envoy)\b|\bdiplomatic (crisis|row|spat|rift)\b|\bsevers? (ties|relations)\b|\bcuts? (diplomatic )?ties\b|\bconfrontation\b|\bfaces? off\b/,
  /\bon (high )?alert\b|\bheightened alert\b|\bstate of emergency\b|\bcurfew\b|\bunrest\b|\briots?\b|\bcrackdown\b|\buprising\b|\bsabotage\b|\bespionage\b|\bspy\b|\bspies\b|\bcyber ?attacks?\b/,
);

const CALM = any(
  /\bceasefire (agreed|reached|holds|holding|deal|takes effect|signed|extended|begins|announced|proposal|talks|plan)\b/,
  /\b(agree|agrees|agreed|sign|signs|signed|reach|reaches|reached|announce|announces|announced|broker|brokers|brokered|extend|extends|extended) (a |an |the )?(\w+ )?(ceasefire|truce|peace deal|peace agreement|armistice)\b/,
  /\bpeace (talks|deal|agreement|accord|plan|summit|treaty|process|proposal|negotiations)\b|\btruce (agreed|holds|extended|signed|reached|takes effect|talks)\b|\bde-?escalat\w+\b/,
  /\bagree(s|d)? to (talks|a ceasefire|ceasefire|a truce|truce|withdraw|peace|negotiat\w+|pull back|halt|pause)\b|\bwithdraw(s|al|n|ing)? (of )?(troops|forces|soldiers)\b/,
  /\b(troops|forces) (withdraw|pull out|pull back|leave)\b|\bprisoner (swap|exchange)\b|\bhostages? (released|freed|deal|release)\b|\brelease(s|d)? (of )?(hostages|prisoners)\b/,
  /\bdiplomatic (breakthrough|solution|talks|efforts|push)\b|\bnormali[sz]\w+ (relations|ties)\b|\brestor(e|es|ed|ing) (ties|relations|diplomatic)\b/,
  /\btalks (resume|begin|progress|under way|underway|planned|set)\b|\b(nuclear|arms control|disarmament) (deal|talks|agreement|treaty|negotiations|summit)\b|\bnegotiat\w+\b/,
  /\blift(s|ed|ing)? (the )?(sanctions|blockade|siege|embargo)\b|\bend(s|ed|ing)? (the |of (the )?)?(war|blockade|siege|conflict|fighting|hostilities)\b/,
  /\bhalt(s|ed)? (strikes|attacks|fighting|offensive|operations)\b|\bpause in fighting\b|\bhumanitarian (pause|corridor|truce)\b|\bstands? down\b|\breconciliation\b/,
  /\bnot needed against\b|\bno (further|more) (military action|strikes)\b|\brul(es|ed) out (military|strikes|war)\b|\breopen(s|ed)? (embassy|border|airspace|strait)\b/,
);
// A deal that is falling apart is the opposite of calm.
const BREAKDOWN = /\b(collaps\w+|violat\w+|breaks? down|broke down|breach\w*|falters?|shatter\w*|in tatters|fail(s|ed|ure)?|reject(s|ed)?|stall(s|ed)?|scrap(s|ped)?|walks? out|walked out|despite (the |a )?(ceasefire|truce))\b/;
const TRUCE = /\b(ceasefire|truce|armistice)\b/;
const DEAL = /\b(talks|deal|agreement|accord)\b/;

const NUKE = /\bnuclear\b|\bnukes?\b|\batomic\b|\bicbms?\b|\bwarheads?\b|\buranium\b|\benrichment\b|\bplutonium\b|\bthermonuclear\b|\bhydrogen bomb\b|\bdoomsday\b/;
const NUKE_CIVIL = /\bnuclear (power|energy|plant|plants|reactor|reactors|fusion|waste|fuel|industry|startup|engineer\w*|safety|regulator\w*)\b|\batomic (energy|clock)\b/;

const NOISE_ALL = new RegExp(NOISE.source, 'g');
const TIERS = [[5, TIER5], [4, TIER4], [3, TIER3], [2, TIER2], [1, TIER1]];

// -> { tier 0..5, calm, nuke }
export function classify(text) {
  const raw = norm(text);
  if (!raw) return { tier: 0, calm: false, nuke: false };
  if (ENTERTAINMENT.test(raw)) return { tier: 0, calm: false, nuke: false };
  const mil = MIL.test(raw);
  const t = raw.replace(NOISE_ALL, ' ');

  let tier = 0;
  for (const [n, re] of TIERS) if (re.test(t)) { tier = n; break; }
  let nuke = NUKE.test(t) && !(NUKE_CIVIL.test(t) && tier < 3);
  let calm = CALM.test(t);
  if (BREAKDOWN.test(t)) {
    if (TRUCE.test(t)) { calm = false; tier = Math.max(tier, 3); } // the shooting is about to resume
    else if (DEAL.test(t)) { calm = false; tier = Math.max(tier, 1); }
  }

  // Context that makes a scary word harmless. Real fighting (tier 3+) with a military word survives most of these.
  const kinetic = mil && tier >= 3;
  if (SPORTS.test(raw) && tier < 3) tier = 0;
  if (SPACE.test(t) && !mil) tier = 0;
  if (HISTORY.test(t)) { tier = 0; nuke = false; }
  if (CRIME.test(t) && !kinetic) tier = Math.min(tier, 1);
  if (PROTEST.test(raw) && !mil) tier = Math.min(tier, 1);
  if (calm && tier === 5) tier = 2; // "nuclear test ban talks" is diplomacy about nukes, not a nuke
  if (!tier) nuke = false;
  return { tier, calm, nuke };
}

// How hot one headline is: its tier, cut to 40% when the story is about cooling things down.
export function heatOf({ tier, calm }) {
  return calm ? tier * 0.4 : tier;
}

// Fresh news counts fully, half as much every 12 hours, nothing after 48.
export function recency(ageHours) {
  if (ageHours < 0) return 1;
  if (ageHours >= 48) return 0;
  return Math.pow(0.5, ageHours / 12);
}

// ---- Story clustering ----------------------------------------------------------
// Groups headlines about the same thing so one event carried by ten outlets counts as one story with ten sources.

const STOP = new Set(
  `the a an of in on as to for and or but after with by at from into over amid new live updates update latest news video watch
  why how what who when where is are was were be been has have had will would could should may might its their his her it this that
  these those than then more most says say said told report reports reported reportedly sources amp not no up out off about against
  between during before under near across around through he she they we you i our your them him us-led set sets gets get got make makes
  first last one two three four five day days week weeks month year years today tonight now just still also back per via vs`
    .split(/\s+/),
);
const ALIAS = {
  israeli: 'israel', israelis: 'israel', iranian: 'iran', iranians: 'iran', russian: 'russia', russians: 'russia',
  ukrainian: 'ukraine', ukrainians: 'ukraine', chinese: 'china', american: 'us', americans: 'us', america: 'us',
  palestinian: 'palestine', palestinians: 'palestine', lebanese: 'lebanon', syrian: 'syria', yemeni: 'yemen',
  turkish: 'turkey', turkiye: 'turkey', korean: 'korea', taiwanese: 'taiwan', pakistani: 'pakistan', indian: 'india',
  british: 'uk', britain: 'uk', french: 'france', german: 'germany', iraqi: 'iraq', afghan: 'afghanistan',
  venezuelan: 'venezuela', sudanese: 'sudan', houthis: 'houthi', saudis: 'saudi', kiev: 'kyiv', tehran: 'iran',
  kremlin: 'russia', moscow: 'russia', beijing: 'china', pentagon: 'us', washington: 'us', kyiv: 'ukraine',
  airstrike: 'strike', airstrikes: 'strike', strikes: 'strike', struck: 'strike', attacks: 'attack', attacked: 'attack',
  kills: 'kill', killed: 'kill', killing: 'kill', dead: 'kill', dies: 'kill', drones: 'drone', missiles: 'missile',
  troops: 'troop', soldiers: 'troop', soldier: 'troop',
};
const ENTITIES = new Set(
  `israel iran russia ukraine china us uk palestine gaza lebanon syria yemen houthi hamas hezbollah nato korea taiwan pakistan india
  iraq afghanistan venezuela sudan saudi turkey qatar bahrain uae kuwait oman egypt jordan france germany poland japan philippines
  cuba mexico colombia libya somalia ethiopia congo mali niger nigeria armenia azerbaijan belarus serbia kosovo taliban isis
  hormuz crimea donbas kashmir kharkiv odesa beirut damascus sanaa riyadh baghdad kabul taipei pyongyang seoul trump putin xi
  zelensky netanyahu khamenei kim`.split(/\s+/),
);

// Headline slugs arrive lowercase with no punctuation. This puts back the capitals a reader expects.
const ACRONYMS = new Set(['us', 'uk', 'un', 'eu', 'uae', 'nato', 'idf', 'irgc', 'isis', 'faa', 'cia', 'fbi', 'iaea']);
export function prettySlug(text) {
  const words = String(text || '').split(' ').map((w) => {
    if (ACRONYMS.has(w)) return w.toUpperCase();
    if (ENTITIES.has(w) || ENTITIES.has(ALIAS[w])) return w[0].toUpperCase() + w.slice(1);
    return w;
  });
  const out = words.join(' ');
  return out ? out[0].toUpperCase() + out.slice(1) : out;
}

export function tokens(text) {
  const out = new Set();
  for (let w of norm(text).replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)) {
    if (w.length < 2 || STOP.has(w)) continue;
    w = ALIAS[w] || w;
    if (!ENTITIES.has(w) && w.length > 4) w = w.replace(/(ing|ed|es|s)$/, '').replace(/e$/, '');
    if (w.length >= 2) out.add(w);
  }
  return out;
}

function sameStory(a, b) {
  let shared = 0, sharedEnt = 0;
  for (const w of a.tok) if (b.tok.has(w)) { shared++; if (ENTITIES.has(w)) sharedEnt++; }
  if (!shared) return false;
  const jac = shared / (a.tok.size + b.tok.size - shared);
  if (jac >= 0.5) return true;
  if (shared >= 3 && sharedEnt >= 1 && jac >= 0.3) return true;
  if (sharedEnt >= 2 && shared >= 3) return true;
  // Two outlets describing the same fight in different words: same two actors, both kinetic, same half-day.
  return sharedEnt >= 2 && a.tier >= 3 && b.tier >= 3 && a.calm === b.calm && Math.abs(a.time - b.time) < 12 * 3600000;
}

// items: [{ title, url, source, time, tier, calm, nuke, rank? }]  (rank: lower = more trusted for the display title)
export function clusterStories(items, now) {
  const clusters = [];
  const sorted = items.map((it) => ({ ...it, tok: tokens(it.title) })).sort((a, b) => b.tier - a.tier || b.time - a.time);
  for (const it of sorted) {
    if (it.tok.size < 2) continue;
    let home = null;
    for (const c of clusters) {
      if (c.members.slice(0, 4).some((m) => sameStory(m, it))) { home = c; break; }
    }
    if (home) home.members.push(it);
    else clusters.push({ members: [it] });
  }
  return clusters
    .map((c) => {
      const ms = c.members;
      const tiers = ms.map((m) => m.tier).sort((a, b) => b - a);
      // One excitable headline should not set the level for a story three outlets describe more soberly.
      const tier = ms.length >= 3 ? tiers[1] : tiers[0];
      const calm = ms.filter((m) => m.calm).length * 2 > ms.length;
      const sources = [...new Set(ms.map((m) => m.source))];
      const time = Math.max(...ms.map((m) => m.time));
      const lead = [...ms].sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9) || b.tier - a.tier || b.time - a.time)[0];
      const corroboration = 1 + 0.5 * Math.log2(sources.length);
      const heat = heatOf({ tier, calm }) * corroboration * recency((now - time) / 3600000);
      return {
        title: lead.title, url: lead.url, source: lead.source, tier, calm,
        nuke: ms.some((m) => m.nuke), sources, n: sources.length, time, heat,
        more: ms.filter((m) => m !== lead).slice(0, 4).map((m) => ({ title: m.title, url: m.url, source: m.source })),
      };
    })
    .sort((a, b) => b.heat - a.heat);
}
