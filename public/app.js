(() => {
  // Every page shares this script but carries only some sections. A missing section gets a detached
  // stand-in element, so the code that fills it runs harmlessly instead of throwing.
  const sinks = new Map();
  const $ = (id) => document.getElementById(id) || sinks.get(id) || sinks.set(id, document.createElement('div')).get(id);
  const PAGE = document.body.dataset.page || 'front';
  const PAGE_NAME = { front: 'We Beefin Index', wire: 'The Wire', card: 'The Card', vault: 'The Vault', fight: 'Deep Dive' }[PAGE];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
  const link = (u, text) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const TONE = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' };
  // Colour for any 0-100 score, using the same bands as the index.
  const band = (v) => { const st = (data && data.scales.statuses) || []; const s = st.find((b) => v < b.max) || st[st.length - 1]; return s ? s.color : 'yellow'; };
  const CON_TONE = { 5: 'green', 4: 'yellow', 3: 'orange', 2: 'red', 1: 'red' };
  const TIER_TONE = ['var(--muted)', 'var(--muted)', 'var(--yellow)', 'var(--orange)', 'var(--red)', 'var(--red)'];
  const RUNG_TONE = ['', 'var(--blue)', 'var(--yellow)', 'var(--orange)', 'var(--red)'];
  const STAKES = {
    nuclear: ['Nuclear stakes', 'var(--red)', 'Both sides have nuclear weapons, or a nuclear power faces a US treaty ally. Not that nukes are in use.'],
    big: ['Big dog involved', 'var(--orange)', 'One side has nuclear weapons.'],
    regional: ['Regional', 'var(--muted)', 'Neither side has nuclear weapons.'],
  };
  const n = (x) => Number(x).toLocaleString('en-US');
  let data = null, wireAll = false, spotsXY = [];

  function ago(t) {
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    return h < 48 ? h + 'h ago' : Math.round(h / 24) + 'd ago';
  }
  function hms(secondsToMidnight) {
    const s = 86400 - secondsToMidnight, p = (x) => String(x).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  }
  const toMidnight = (sec) => (sec >= 120 ? `${Math.floor(sec / 60)} min ${sec % 60} s to midnight` : `${sec} seconds to midnight`);
  const meter = (label, value, color, right, detail) =>
    `<div class="ing"><span><b>${esc(label)}</b></span><span>${value ?? '–'}${right ? ` <span class="pts">· ${esc(right)}</span>` : ''}</span>` +
    `<div class="track"><div class="fill" style="width:${value ?? 0}%;background:${color}"></div></div>${detail ? `<span class="d">${esc(detail)}</span>` : ''}</div>`;

  // ---- gauge: four equal segments, needle mapped piecewise across the real thresholds
  const CX = 200, CY = 204, RO = 184, RI = 116;
  const pt = (f, r) => [CX + r * Math.cos(Math.PI * (1 - f)), CY - r * Math.sin(Math.PI * (1 - f))];
  const arc = (f, r, sweep) => { const [x, y] = pt(f, r); return `A ${r} ${r} 0 0 ${sweep} ${x.toFixed(2)} ${y.toFixed(2)}`; };
  function frac(index, st) {
    for (let k = 0; k < st.length; k++) {
      if (index <= st[k].max || k === st.length - 1) return (k + (index - st[k].min) / (st[k].max - st[k].min)) / st.length;
    }
  }
  // Two lines, split between words so both halves are close in length. A band's arc holds about
  // 13 characters on the inner line, so a label too long for two lines (Told Ya To Watch Ya Mouth)
  // goes to three short lines instead of clipping.
  function lines(label) {
    const w = label.toUpperCase().split(' ');
    if (w.length <= 2) return [w.join(' ')];
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < w.length; i++) {
      const diff = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    const two = [w.slice(0, best).join(' '), w.slice(best).join(' ')];
    if (Math.max(...two.map((t) => t.length)) <= 13 || w.length < 3) return two;
    const out = [[], [], []];
    w.forEach((x, i) => out[Math.min(2, Math.floor((i * 3) / w.length))].push(x));
    return out.map((a) => a.join(' ')).filter(Boolean);
  }
  function drawGauge(d) {
    const st = d.scales.statuses, k4 = st.length, gap = 0.006;
    let defs = '', body = '', labels = '';
    st.forEach((b, k) => {
      const f0 = k / k4 + gap, f1 = (k + 1) / k4 - gap, on = d.status.key === b.key, c = TONE[b.color];
      const [ox, oy] = pt(f0, RO), [ix, iy] = pt(f1, RI);
      body += `<path d="M ${ox.toFixed(2)} ${oy.toFixed(2)} ${arc(f1, RO, 1)} L ${ix.toFixed(2)} ${iy.toFixed(2)} ${arc(f0, RI, 0)} Z" fill="${c}" fill-opacity="${on ? 0.34 : 0.1}" stroke="${c}" stroke-width="${on ? 2.5 : 1.5}"/>`;
      const ls = lines(b.label), step = 16, mid = (RO + RI) / 2 + ((ls.length - 1) * step) / 2 - 4;
      ls.forEach((t, j) => {
        const r = mid - j * step, [x, y] = pt(f0, r), id = `gl${k}_${j}`;
        defs += `<path id="${id}" d="M ${x.toFixed(2)} ${y.toFixed(2)} ${arc(f1, r, 1)}" fill="none"/>`;
        // Labels render last, on top of the needle, with a dark halo: the needle sweeps the band
        // and used to cross the text. 12px is the largest that fits the shortest arc (see lines()).
        labels += `<text class="glabel" font-size="12" font-weight="${on ? 700 : 500}" fill="${on ? 'var(--fg)' : c}" letter-spacing=".1"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(t)}</textPath></text>`;
      });
    });
    [0, ...st.map((b) => b.max)].forEach((v, k) => {
      const f = k / k4, [x1, y1] = pt(f, RI - 4), [x2, y2] = pt(f, RI - 12), [tx, ty] = pt(f, RI - 24);
      body += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--muted)" stroke-width="1.5"/>`;
      body += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" font-size="10" fill="var(--muted)" text-anchor="middle">${v}</text>`;
    });
    const c = TONE[d.status.color], deg = (v) => (180 * frac(v, st) - 90).toFixed(2);
    // Ghost needle: where the index stood a day ago.
    if (d.trend && d.trend.d24) {
      body += `<line x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - RO + 10}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 4" opacity=".7" transform="rotate(${deg(Math.max(0, Math.min(100, d.index - d.trend.d24)))} ${CX} ${CY})"><title>24 hours ago</title></line>`;
    }
    body += `<polygon class="needle" id="needle" points="${CX - 5},${CY} ${CX + 5},${CY} ${CX},${CY - RO + 6}" fill="${c}" style="transform:rotate(-90deg)"/>`;
    body += `<path d="M ${CX - 62} ${CY} A 62 62 0 0 1 ${CX + 62} ${CY} Z" fill="var(--panel-2)" stroke="${c}" stroke-width="1.5"/>`;
    body += `<text x="${CX}" y="${CY - 8}" font-size="50" font-weight="700" text-anchor="middle" fill="${c}" style="font-family:var(--display)">${d.index}</text>`;
    $('gauge').innerHTML = `<defs>${defs}</defs>${body}${labels}`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const el = $('needle'); if (el) el.style.transform = `rotate(${deg(d.index)}deg)`; }));
  }

  // ---- map: dot-matrix land (Natural Earth, sampled every 2.5 degrees) with hot spots on top
  const MASK = 'AAAAAD/////AAAAwAAYAAAAAAAAAAR/f//8ABwAAAAOAAAAAAAAA4d+P//8AAgAAgAf4AcAAAAADgKKAf/8AAAACAP/+IAAAAOADfO/wP/4AADAEG/////8Aef8/P/P77////PiQn////gAAHgAAAAPl4H//+ENAAAAAAAAAAf////pcHwHAH//////////+A////+BwDgAAPv/////////8AeD//+B+AAAAPj///////+SAAYAf//h/AAACFP///////gOAAAAP//7/gAAPP////////4MAAAAH////wAAL/////////8AAAAAD///84AAD/////////0AAAAAD////AAAB///3/////gAAAAAD///4AAAH++Dv/////MAAAAAD///wAAAPlu/3////8IAAAAAB///AAAAPAP/3///+IIAAAAAB///AAAAG+B//////s4AAAAAA//+AAAAH8AP/////DgAAAAAAf/8AAAAP/v//////gAAAAAAAP8EAAAAP///v////gAAAAAAAD4EAAAA///3x////AAAAAAAAB4AAAAA///3+H//+gAAAAAAAA4jAAAB///7/D+f4AAAAAAAAA/gQAAB///7+B8fggAAAAAAAAPwAAAB///94B4PggAAAAAAAAB4AAAB////gAwHwAAAAAAAAAAYwAAA///+4AwFgAAAAAAAAAAH/AAAf///wAIAAYAAAAAAAAAB/wAAP///wAACCAAAAAAAAAAB/8AAAD//gAAHGAAAAAAAAAAD/8AAAD//AAAGOwAAAAAAAAAD//AAAH/+AAADOBAAAAAAAAAD//4AAD/8AAABkl8gAAAAAAAD//8AAB/8AAAA4AeIAAAAAAAD//8AAB/8AAAAMAIAAAAAAAAB//4AAB/8AAAAAAAAAAAAAAAB//4AAB/8QAAAADsAAAAAAAAA//4AAD/8wAAAAfsAAAAAAAAAP/wAAB/wwAAAAf+AAAAAAAAAP/wAAB/xgAAAD//AAAAAAAAAP/AAAA/xgAAAH//gAAAAAAAAf+AAAA/gAAAAH//gAAAAAAAAf8AAAA/gAAAAD//wAAAAAAAAf8AAAAfAAAAAD//gAAAAAAAAf4AAAAeAAAAADg/gAAAAAAAAfgAAAAAAAAAAAAPAAAAAAAAA/gAAAAAAAAAAAAGACAAAAAAA+AAAAAAAAAAAAACAAAAAAAAA8AAAAAAAAAAAAAAAYAAAAAAA4AAAAAAAAAAAAAAAQAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAA4gAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const COLS = 144, ROWS = 56, TOP = 82.5, SPAN = 140;
  const LAND = (() => { const b = atob(MASK), out = new Uint8Array(COLS * ROWS); for (let i = 0; i < out.length; i++) out[i] = (b.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1; return out; })();
  // view: world coords are CSS px of the unzoomed map; screen = (world - origin) * k
  const view = { k: 1, x: 0, y: 0 }, ZMAX = 8;
  let mapW = 0, mapH = 0, picked = null, mapFrame = 0;
  const spotXY = (s) => [((s.lon + 180) / 360) * mapW, ((TOP - Math.max(-57.5, Math.min(TOP, s.lat))) / SPAN) * mapH];
  function clampView() {
    view.k = Math.max(1, Math.min(ZMAX, view.k));
    view.x = Math.max(0, Math.min(mapW - mapW / view.k, view.x));
    view.y = Math.max(0, Math.min(mapH - mapH / view.k, view.y));
  }
  // zoom to scale k keeping screen point (sx, sy) fixed
  function zoomAt(k, sx, sy) {
    const wx = view.x + sx / view.k, wy = view.y + sy / view.k;
    view.k = Math.max(1, Math.min(ZMAX, k));
    view.x = wx - sx / view.k; view.y = wy - sy / view.k;
    clampView(); queueMap();
  }
  function flyTo(s, k) {
    const [wx, wy] = spotXY(s);
    view.k = Math.max(view.k, k); view.x = wx - mapW / view.k / 2; view.y = wy - mapH / view.k / 2;
    clampView(); picked = s; showSpot(s); queueMap();
  }
  const queueMap = () => { if (!mapFrame) mapFrame = requestAnimationFrame(() => { mapFrame = 0; drawMap(); }); };
  function drawMap() {
    const d = data, cv = $('map'), wrap = $('mapwrap');
    const w = wrap.clientWidth, h = Math.round((w * ROWS) / COLS), dpr = window.devicePixelRatio || 1;
    if (!w || !d) return;
    if (mapW && w !== mapW) { const f = w / mapW; view.x *= f; view.y *= f; }
    mapW = w; mapH = h; clampView();
    const { k, x: ox, y: oy } = view;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px'; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const cell = w / COLS, r = Math.max(0.7, cell * 0.32) * (1 + (k - 1) * 0.35), sc = (wx, wy) => [(wx - ox) * k, (wy - oy) * k];
    g.fillStyle = css('--dot');
    for (let i = 0; i < LAND.length; i++) {
      if (!LAND[i]) continue;
      const [x, y] = sc(((i % COLS) + 0.5) * cell, (Math.floor(i / COLS) + 0.5) * cell);
      if (x < -r || y < -r || x > w + r || y > h + r) continue;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    // when zoomed in, faint lat/lon lines every 10 degrees help place the dots
    if (k >= 2) {
      g.strokeStyle = css('--line'); g.lineWidth = 1; g.beginPath();
      for (let lon = -180; lon <= 180; lon += 10) { const [x] = sc(((lon + 180) / 360) * w, 0); if (x >= 0 && x <= w) { g.moveTo(x, 0); g.lineTo(x, h); } }
      for (let lat = -50; lat <= 80; lat += 10) { const [, y] = sc(0, ((TOP - lat) / SPAN) * h); if (y >= 0 && y <= h) { g.moveTo(0, y); g.lineTo(w, y); } }
      g.stroke();
    }
    const spots = d.hotSpots || [], max = Math.max(1, ...spots.map((s) => s.n));
    const scale = Math.max(0.7, w / 560) * Math.pow(k, 0.3), tones = { red: css('--red'), orange: css('--orange'), yellow: css('--yellow') };
    spotsXY = [];
    [...spots].sort((a, b) => a.n - b.n).forEach((s) => {
      const [x, y] = sc(...spotXY(s));
      const rel = s.n / max, rad = (2.5 + 9 * Math.sqrt(rel)) * scale;
      if (x < -rad * 2 || y < -rad * 2 || x > w + rad * 2 || y > h + rad * 2) return;
      g.fillStyle = tones[rel >= 0.55 ? 'red' : rel >= 0.2 ? 'orange' : 'yellow'];
      g.globalAlpha = k > 1 ? 0.16 : 0.22; g.beginPath(); g.arc(x, y, rad * (k > 1 ? 1.5 : 1.9), 0, 6.2832); g.fill();
      g.globalAlpha = 0.9; g.beginPath(); g.arc(x, y, Math.max(1.6, rad * 0.55), 0, 6.2832); g.fill();
      g.globalAlpha = 1;
      spotsXY.push({ x, y, s, rad });
    });
    // name the dots once there is room: biggest first, skipping labels that would overlap
    if (k >= 2) {
      g.font = '11px ' + css('--mono'); g.textBaseline = 'middle';
      const zb = $('mapwrap').querySelector('.zoombar'), boxes = [[w - zb.offsetWidth - 12, 0, w, zb.offsetHeight + 10]];
      [...spotsXY].sort((a, b) => b.s.n - a.s.n).forEach((p) => {
        const label = `${p.s.name} ${p.s.n}`, tw = g.measureText(label).width, bx = p.x + Math.max(4, p.rad * 0.55) + 3, by = p.y - 7;
        const box = [bx - 2, by, bx + tw + 2, by + 14];
        if (box[2] > w || boxes.some((b) => !(box[0] > b[2] || box[2] < b[0] || box[1] > b[3] || box[3] < b[1]))) return;
        boxes.push(box);
        g.fillStyle = css('--bg'); g.globalAlpha = 0.7; g.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
        g.globalAlpha = 1; g.fillStyle = p.s === picked ? css('--blue') : css('--fg'); g.fillText(label, bx, p.y);
      });
    }
    if (picked) {
      const p = spotsXY.find((q) => q.s === picked);
      if (p) { g.strokeStyle = css('--blue'); g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, Math.max(7, p.rad * 0.55 + 4), 0, 6.2832); g.stroke(); }
    }
    wrap.querySelectorAll('.ping').forEach((el) => el.remove());
    spots.slice(0, 3).forEach((s, i) => {
      const [x, y] = sc(...spotXY(s));
      if (x < 0 || y < 0 || x > w || y > h) return;
      const el = document.createElement('span');
      el.className = 'ping';
      el.style.left = x.toFixed(1) + 'px';
      el.style.top = y.toFixed(1) + 'px';
      el.style.animationDelay = i * 0.8 + 's';
      wrap.appendChild(el);
    });
    wrap.classList.toggle('zoomed', k > 1.01);
    $('zlvl').textContent = k > 1.01 ? k.toFixed(1) + '×' : '';
    $('zin').disabled = k >= ZMAX - 0.01; $('zout').disabled = $('zreset').disabled = k <= 1.01;
    document.querySelectorAll('#spots button').forEach((b) => b.classList.toggle('on', picked && b.dataset.name === picked.name));
  }
  function showSpot(s) {
    $('mapcap').textContent = s ? `${s.name}: ${s.n} report${s.n === 1 ? '' : 's'} of force in 24h${s.lat != null ? ` · ${Math.abs(s.lat).toFixed(1)}°${s.lat >= 0 ? 'N' : 'S'} ${Math.abs(s.lon).toFixed(1)}°${s.lon >= 0 ? 'E' : 'W'}` : ''}` : 'Tap a dot to see the place.';
  }
  function spotAt(ev) {
    const box = $('map').getBoundingClientRect(), x = ev.clientX - box.left, y = ev.clientY - box.top;
    let best = null, bd = 22 * 22;
    for (const p of spotsXY) { const dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < bd) { bd = dd; best = p.s; } }
    return best;
  }
  function pickSpot(ev) { const s = spotAt(ev); if (s || !picked) showSpot(s); }

  // ---- small charts
  function drawHistory(d) {
    const h = d.history || [];
    $('trendnote').textContent = h.length ? `${h.length} readings kept, up to 7 days` : '';
    if (h.length < 2) { $('history').innerHTML = '<p class="note">The trend line starts drawing after the second reading.</p>'; return; }
    const W = 360, H = 124, t0 = h[0].t, t1 = h[h.length - 1].t, x = (t) => 4 + ((t - t0) / (t1 - t0 || 1)) * (W - 40), y = (v) => H - 20 - (v / 100) * (H - 28);
    let s = '';
    d.scales.statuses.slice(0, -1).forEach((b) => {
      s += `<line x1="4" x2="${W - 36}" y1="${y(b.max)}" y2="${y(b.max)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${W - 32}" y="${y(b.max) + 3}" font-size="10" fill="var(--muted)">${b.max}</text>`;
    });
    const pts = h.map((p) => `${x(p.t).toFixed(1)},${y(p.i).toFixed(1)}`), tone = TONE[d.status.color];
    s += `<polygon points="${x(t0)},${y(0)} ${pts.join(' ')} ${x(t1)},${y(0)}" fill="${tone}" fill-opacity=".12"/><polyline points="${pts.join(' ')}" fill="none" stroke="${tone}" stroke-width="2"/>`;
    s += `<circle cx="${x(t1)}" cy="${y(h[h.length - 1].i)}" r="4" fill="${tone}"/>`;
    s += `<text x="4" y="${H - 2}" font-size="10" fill="var(--muted)">${ago(t0)}</text><text x="${W - 36}" y="${H - 2}" font-size="10" fill="var(--muted)" text-anchor="end">now</text>`;
    const lo = Math.min(...h.map((p) => p.i)), hi = Math.max(...h.map((p) => p.i));
    $('history').innerHTML = `<p class="eyebrow" style="margin-bottom:6px">Index over the last ${ago(t0).replace(' ago', '')} · low ${lo} · high ${hi}</p><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Index trend">${s}</svg>`;
  }
  function drawTimeline(d) {
    const tl = d.doomsday.timeline, W = 360, H = 120, y0 = 1947, y1 = 2027;
    const x = (yr) => 6 + ((yr - y0) / (y1 - y0)) * (W - 60), ly = (sec) => 12 + ((Math.log(sec) - Math.log(40)) / (Math.log(1100) - Math.log(40))) * (H - 34);
    let path = '', s = '';
    tl.forEach(([yr, sec], i) => {
      const nx = i + 1 < tl.length ? tl[i + 1][0] : y1 - 0.4;
      path += `${i ? 'L' : 'M'} ${x(yr).toFixed(1)} ${ly(sec).toFixed(1)} L ${x(nx).toFixed(1)} ${ly(sec).toFixed(1)} `;
    });
    [[1020, '17 min'], [420, '7 min'], [180, '3 min'], [d.doomsday.official.seconds, `${d.doomsday.official.seconds} s`]].forEach(([sec, label]) => {
      s += `<line x1="6" x2="${W - 52}" y1="${ly(sec).toFixed(1)}" y2="${ly(sec).toFixed(1)}" stroke="var(--line)" stroke-dasharray="2 5"/><text x="${W - 48}" y="${(ly(sec) + 3).toFixed(1)}" font-size="10" fill="var(--muted)">${label}</text>`;
    });
    s += `<path d="${path}" fill="none" stroke="var(--fg)" stroke-width="2"/>`;
    [1947, 1970, 1991, 2010, 2026].forEach((yr, i) => { s += `<text x="${x(yr).toFixed(1)}" y="${H - 4}" font-size="10" fill="var(--muted)" text-anchor="${i ? 'middle' : 'start'}">${yr}</text>`; });
    if (d.doomsday.beefSeconds != null) {
      const by = ly(Math.max(40, Math.min(1100, d.doomsday.beefSeconds))), bx = x(y1 - 0.4), c = TONE[band(d.doomsday.score)];
      s += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="7" fill="none" stroke="${c}" stroke-width="1" opacity=".6"/><circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="5.5" fill="${c}" stroke="var(--bg)" stroke-width="1.5"/><line x1="${(bx - 14).toFixed(1)}" x2="${(bx + 6).toFixed(1)}" y1="${by.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${c}" stroke-width="1.5"/>`;
    }
    s += `<text x="6" y="9" font-size="10" fill="var(--muted)">closer to midnight ↑</text>`;
    $('timeline').innerHTML = `<p class="eyebrow" style="margin-bottom:6px">Official clock since 1947 · dot = Beef Clock now</p><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Doomsday Clock settings since 1947">${s}</svg>`;
  }
  const spark = (vals, color) => {
    const lo = Math.min(...vals), hi = Math.max(...vals), W = 120, H = 28;
    const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6)).toFixed(1)}`).join(' ');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polygon points="0,${H} ${pts} ${W},${H}" fill="${color}" fill-opacity=".14"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"/></svg>`;
  };

  // ---- wire
  function storyItem(s, d) {
    const type = s.calm ? d.scales.calm : d.scales.beefTypes[s.tier].name;
    const color = s.calm ? 'var(--blue)' : TIER_TONE[s.tier];
    const who = s.n > 1 ? `${s.n} outlets: ${s.sources.slice(0, 4).map((x) => `<span class="nowrap">${esc(x)}</span>`).join(', ')}` : esc(s.source);
    const seen = new Set([s.source]);
    const more = (s.more || []).filter((m) => !seen.has(m.source) && seen.add(m.source)).slice(0, 3).map((m) => `<span class="nowrap">${link(m.url, esc(m.source))}</span>`).join(', ');
    return `<li><span class="chips"><span class="chip" style="color:${color}">${esc(type)}</span></span><div>${link(s.url, esc(s.title))}</div>` +
      `<div class="meta">${who} · ${ago(s.time)}${more ? ` · also at ${more}` : ''}</div></li>`;
  }
  function drawWire(d) {
    const list = (wireAll ? [...d.wire.stories, ...d.wire.quiet].sort((a, b) => b.time - a.time) : d.wire.stories).slice(0, wireAll ? 30 : PAGE === 'front' ? 8 : 16);
    $('wire').innerHTML = list.length ? list.map((s) => storyItem(s, d)).join('') : '<li class="empty">No smoke on the wire right now.</li>';
    $('tab-hot').setAttribute('aria-pressed', String(!wireAll));
    $('tab-all').setAttribute('aria-pressed', String(wireAll));
    const ps = d.wire.pressStats;
    $('wirenote').textContent = `Stories from ${d.wire.outlets} outlet${d.wire.outlets === 1 ? '' : 's'}, grouped so one event counts once.` +
      (ps ? ` Across the wider press, ${n(ps.kinetic)} of ${n(ps.articles)} headlines in 24h were about fighting.` : '');
    const rd = (d.reddit && d.reddit.posts) || [], rdShow = (wireAll ? rd : rd.filter((p) => p.tier >= 2)).slice(0, wireAll ? 16 : 8);
    $('redditwrap').hidden = !rdShow.length;
    $('redditnote').textContent = `Newest from ${((d.reddit && d.reddit.subs) || []).map((s) => 'r/' + s).join(', ')} · user-written titles, not scored`;
    $('reddit').innerHTML = rdShow.map((p) => `<li><span class="chips"><span class="chip" style="color:${p.calm ? 'var(--blue)' : TIER_TONE[p.tier]}">${esc(p.calm ? d.scales.calm : d.scales.beefTypes[p.tier].name)}</span></span><div>${link(p.url, esc(p.title))}</div><div class="meta">r/${esc(p.sub)} · ${ago(p.time)}</div></li>`).join('');
    $('presswrap').hidden = !d.wire.press.length;
    $('press').innerHTML = d.wire.press.map((p) => `<li><div>${link(p.url, esc(p.title))}</div><div class="meta">${p.n} sites, including ${p.sample.map((x) => `<span class="nowrap">${esc(x)}</span>`).join(', ')} · ${ago(p.time)}</div></li>`).join('');
  }

  // Speed is set in screen pixels per second, so long posts and short headlines move equally fast.
  const TICKER_SPEED = { wire: 44, osint: 44 };
  // ---- what moved the index since the comparison reading
  function drawMove(d) {
    const mv = d.move;
    $('move').hidden = !mv || !mv.text;
    if (!mv || !mv.text) return;
    const max = Math.max(4, ...mv.drivers.map((x) => Math.abs(x.points)));
    const bars = mv.drivers.slice(0, 4).map((x) => {
      const w = (Math.abs(x.points) / max) * 50, col = x.points > 0 ? 'var(--red)' : 'var(--green)';
      const pos = x.points > 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
      return `<div class="bar" title="${esc(x.name)} went from ${x.from} to ${x.to}: ${esc(x.why)}"><span>${esc(x.name.replace('The ', ''))}</span><div class="lane2"><span style="${pos};background:${col}"></span></div><span class="${x.points > 0 ? 'up' : 'down'}">${x.points > 0 ? '+' : '−'}${Math.abs(x.points)}</span></div>`;
    }).join('');
    $('move').innerHTML = `<h3>What moved it</h3><div>${esc(mv.text)}</div>` + (bars ? `<div class="bars">${bars}</div><span class="note">Bars: index points each ingredient's change is worth. Red pushed it up, green pulled it down.</span>` : '');
  }

  // ---- keyword search: the 48-hour archive (search.json, loaded on first use) plus a live GDELT query
  const PICKS = ['Iran', 'Russia', 'Ukraine', 'China', 'Taiwan', 'Israel', 'Gaza', 'Venezuela', 'North Korea', 'Houthi', 'nuclear', 'drone strike'];
  const KINDS = {
    news: ['News', 'Front pages of major outlets'], defense: ['Defense & regional', 'Defense press and regional papers'],
    osint: ['OSINT channel', 'Public Telegram OSINT channels, unverified'], reddit: ['Reddit', 'User-posted, unverified'],
    press: ['Wider press', 'Conflict headlines from thousands of sites, via GDELT'], live: ['Worldwide', 'Live GDELT search of world news'],
  };
  let archive = null, archiveTried = false, liveRows = [], liveFor = '', liveState = '', kindFilter = 'all', shown = 40, lastLive = 0, liveTimer;
  const fromRow = (r) => ({ time: r[0], kind: r[1], source: r[2], title: r[3], url: r[4], tier: r[5], calm: !!r[6] });
  async function loadArchive() {
    if (archive || archiveTried) return;
    archiveTried = true;
    try {
      const r = await fetch('search.json?' + (data ? data.generatedAt : Date.now()));
      if (!r.ok) throw new Error(r.status);
      archive = (await r.json()).rows.map(fromRow);
    } catch {
      archive = null; // snapshot or first run: fall back to what the page itself holds
    }
    runSearch();
  }
  function pageRows(d) {
    const rows = [];
    for (const s of [...d.wire.stories, ...d.wire.quiet]) rows.push({ time: s.time, kind: 'news', source: s.n > 1 ? `${s.source} +${s.n - 1}` : s.source, title: s.title, url: s.url, tier: s.tier, calm: s.calm });
    for (const p of d.wire.press || []) rows.push({ time: p.time, kind: 'press', source: `${p.n} sites`, title: p.title, url: p.url, tier: p.tier, calm: p.calm });
    for (const p of (d.osint && d.osint.posts) || []) rows.push({ time: p.time, kind: 'osint', source: p.user, title: p.text, url: p.url, tier: 0 });
    for (const p of (d.reddit && d.reddit.posts) || []) rows.push({ time: p.time, kind: 'reddit', source: `r/${p.sub}`, title: p.title, url: p.url, tier: p.tier, calm: p.calm });
    return rows;
  }
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordsOf = (q) => q.toLowerCase().replace(/["']/g, '').split(/\s+/).filter((w) => w.length >= 2);
  // Every word must appear at the start of a word in the title or source: "iran" finds "Iranian", not "Tiranë".
  const matcher = (words) => { const res = words.map((w) => new RegExp(`(^|[^a-z0-9])${escRe(w)}`, 'i')); return (t) => res.every((re) => re.test(t)); };
  function highlight(text, words) {
    let html = esc(text);
    for (const w of words) html = html.replace(new RegExp(`(^|[^a-z0-9;])(${escRe(esc(w))})`, 'gi'), '$1<mark>$2</mark>');
    return html;
  }
  async function runLive(q, retried = false) {
    const words = wordsOf(q);
    if (words.join(' ').length < 3 || q === liveFor) return;
    const wait = lastLive + 5200 - Date.now(); // GDELT allows one request every five seconds
    if (wait > 0) { clearTimeout(liveTimer); liveTimer = setTimeout(() => runLive(q), wait); return; }
    lastLive = Date.now(); liveFor = q; liveState = 'loading'; liveRows = []; runSearch();
    const query = words.map((w) => (/\s/.test(w) ? `"${w}"` : w)).join(' ') + ' sourcelang:english';
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=75&sort=hybridrel&timespan=3d`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      if ($('q').value.trim() !== q) return; // the person has moved on
      let j; try { j = JSON.parse(text); } catch { throw new Error(text.slice(0, 120) || `HTTP ${r.status}`); }
      // GDELT matches anywhere in an article's text; keep only those whose headline or link names the search words.
      const inTitle = matcher(words);
      liveRows = (j.articles || []).filter((a) => /^https?:\/\//.test(a.url || '') && (inTitle(a.title || '') || inTitle(decodeURIComponent(a.url).replace(/[-_/]+/g, ' ')))).map((a) => {
        const d = a.seendate || '';
        return { time: Date.parse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`) || Date.now(), kind: 'live', source: a.domain || 'GDELT', title: a.title || a.url, url: a.url, tier: 0 };
      });
      liveState = liveRows.length ? 'done' : 'empty';
    } catch (err) {
      const busy = /limit|5 seconds|failed to fetch|networkerror|load failed/i.test(err.message);
      // GDELT's "slow down" reply carries no CORS header, so the browser reports it as a failed fetch. Retry once.
      if (busy && !retried && $('q').value.trim() === q) { liveFor = ''; liveState = 'loading'; runSearch(); clearTimeout(liveTimer); liveTimer = setTimeout(() => { lastLive = 0; runLive(q, true); }, 6000); return; }
      liveState = 'error:' + (busy ? 'Worldwide search (GDELT) is busy right now. Press Search again in a few seconds.' : err.name === 'TimeoutError' ? 'Worldwide search (GDELT) took too long. Press Search to try again.' : `Worldwide search (GDELT) did not answer: ${err.message}.`);
      liveFor = '';
    }
    runSearch();
  }
  function runSearch() {
    if (!document.getElementById('q')) return; // this page has no search box
    const q = $('q').value.trim(), box = $('hits'), words = wordsOf(q);
    if (!data || !words.length) { box.hidden = true; box.innerHTML = ''; return; }
    if (!archive && !archiveTried) { loadArchive(); }
    const match = matcher(words);
    const pool = [...(archive || pageRows(data)), ...liveRows];
    const seen = new Set();
    // One entry per headline: syndicated copies of the same story fold into it as "also on N sites".
    const byTitle = new Map();
    const hits = [];
    for (const r of pool.filter((r) => match(`${r.title} ${r.source}`) && !seen.has(r.url) && seen.add(r.url)).sort((a, b) => b.time - a.time)) {
      const key = r.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const first = byTitle.get(key);
      if (first) { first.also.push(r.source); continue; }
      const row = { ...r, also: [] };
      byTitle.set(key, row);
      hits.push(row);
    }
    const counts = {}; for (const h of hits) counts[h.kind] = (counts[h.kind] || 0) + 1;
    const list = kindFilter === 'all' ? hits : hits.filter((h) => h.kind === kindFilter);
    const sources = new Set(hits.map((h) => h.source)).size;
    const tabs = ['all', ...Object.keys(KINDS)].filter((k) => k === 'all' || counts[k]).map((k) =>
      `<button type="button" data-kind="${k}" aria-pressed="${k === kindFilter}" title="${esc(k === 'all' ? '' : KINDS[k][1])}">${k === 'all' ? 'All' : KINDS[k][0]} ${k === 'all' ? hits.length : counts[k]}</button>`).join('');
    const live = liveState === 'loading' ? 'Searching worldwide news (GDELT)…'
      : liveState.startsWith('error:') ? liveState.slice(6)
      : liveState === 'empty' && liveFor === q ? 'No worldwide matches from GDELT in the last 3 days.'
      : liveFor === q ? `Includes ${liveRows.length} live worldwide results from GDELT (last 3 days).`
      : 'Press Search (or Enter) to add live worldwide results from GDELT.';
    const pageHits = [
      ...(data.fightCard || []).filter((m) => match(`${m.a} ${m.b}`)).map((m) => `Fight card: ${esc(m.a)} vs ${esc(m.b)} (${esc(data.scales.rungs[m.rung - 1].name)})`),
      ...(data.hotSpots || []).filter((h) => match(h.name)).map((h) => `Hot spot: ${esc(h.name)} (${h.n} reports of force)`),
    ];
    box.hidden = false;
    box.innerHTML =
      `<p class="note">${hits.length} report${hits.length === 1 ? '' : 's'} from ${sources} source${sources === 1 ? '' : 's'} mention "${esc(q)}", newest first. ${archive ? 'Searching the last 48 hours.' : 'Searching what is on this page (the full archive is not available here).'} ${esc(live)}</p>` +
      (tabs ? `<div class="tabs tabs-wrap" id="kindtabs">${tabs}</div>` : '') +
      (list.length ? `<ul class="results">${list.slice(0, shown).map((h) => {
        const chip = h.tier ? `<span class="chip" style="color:${h.calm ? 'var(--blue)' : TIER_TONE[h.tier]}">${esc(h.calm ? data.scales.calm : data.scales.beefTypes[h.tier].name)}</span>` : '';
        return `<li><span class="chips"><span class="kind" title="${esc(KINDS[h.kind][1])}">${esc(KINDS[h.kind][0])}</span>${chip}</span><div>${link(h.url, highlight(h.title, words))}</div><div class="meta">${esc(h.source)} · ${ago(h.time)}${h.also.length ? ` · also on ${h.also.length} more site${h.also.length === 1 ? '' : 's'}` : ''}</div></li>`;
      }).join('')}</ul>` : `<p class="empty">Nothing in the last 48 hours mentions "${esc(q)}"${liveState === 'loading' ? '. Still checking worldwide news…' : '.'}</p>`) +
      (list.length > shown ? `<button class="more btn" type="button" id="moreres">Show ${Math.min(40, list.length - shown)} more of ${list.length}</button>` : '') +
      (pageHits.length ? `<p class="note">On the dashboard: ${pageHits.join(' · ')}</p>` : '');
  }

  function fillTicker(el, items, pxPerSec) {
    if (!items.length) { el.innerHTML = '<span>No smoke on the wire.</span>'; return; }
    el.innerHTML = items.join('') + items.join(''); // doubled so the loop is seamless
    const loop = el.scrollWidth / 2; // one copy of the items
    el.style.setProperty('--dur', Math.max(60, Math.round((loop || items.length * 700) / pxPerSec)) + 's');
  }
  function favicon(d) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = css('--' + d.status.color); g.fillRect(0, 0, 64, 64);
      g.fillStyle = css('--bg'); g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(d.index), 32, 35);
      let l = document.querySelector('link[rel="icon"]');
      if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); }
      l.href = c.toDataURL();
    } catch { /* decoration only */ }
  }

  // ===================================================================================================
  // Fight-night features. Everything below reads data the collector already wrote (data.json, plus
  // history.json and search.json on the deep dive) and the hand-curated curated.json. None of it feeds
  // back into the index.
  const here = (href, text) => `<a href="${esc(href)}">${text}</a>`;
  const fightUrl = (key) => `fight.html?p=${encodeURIComponent(key)}`;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDay = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return `${dd} ${MON[m - 1]} ${y}`; };
  const statusLabel = (d, k) => (d.scales.statuses.find((s) => s.key === k) || {}).label || k;
  const statusColor = (d, k) => (d.scales.statuses.find((s) => s.key === k) || {}).color || 'yellow';
  const theaterName = (d, id) => (d.theaters.find((t) => t.id === id) || {}).name || 'Parts Unknown';
  const BILLING = ['Main event', 'Co-main', 'Main card'];
  let curated = { countries: {} }, history = null, archive2 = null;

  async function getJson(url) {
    try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
  }

  // One bout on the card. `tape` adds the Tale of the Tape under it (the main event).
  function bout(m, i, d, tape, slot) {
    const rung = d.scales.rungs[m.rung - 1], [stakes, sc] = STAKES[m.stakes] || STAKES.regional;
    const move = m.move === 'up' ? ' · <span class="up">heating up right now</span>' : m.move === 'down' ? ' · <span class="down">quieter right now</span>' : '';
    return `<div class="bout${slot === 'Undercard' ? ' small' : ''}"><div class="top"><span class="eyebrow">${esc(slot || BILLING[Math.min(i, 2)])}</span><span class="chips"><span class="chip" style="color:${RUNG_TONE[m.rung]}" title="${esc(rung.name + ': ' + rung.what)}">${esc(rung.name)}</span><span class="chip" style="color:${sc}" title="${esc(STAKES[m.stakes]?.[2] || '')}">${stakes}</span></span></div>` +
      `<div class="name">${here(fightUrl(m.key), `${esc(m.a)}&nbsp;<i>vs</i>&nbsp;${esc(m.b)}`)}</div>` +
      `<div class="split"><span class="k-talk" style="flex:${m.talk}"></span><span class="k-flex" style="flex:${m.flex}"></span><span class="k-hands" style="flex:${m.hands}"></span></div>` +
      `<div class="note">${n(m.talk)} talk · ${n(m.flex)} flexin' · ${n(m.hands)} hands (${m.handsPerHour} an hour)${move} · ${here(fightUrl(m.key), 'deep dive →')}</div>` +
      (tape ? `<div class="tapebox"><h3>Tale of the Tape</h3>${taleOfTape(m)}</div>` : '') + '</div>';
  }

  // ---- 1. Tale of the Tape: each side's numbers head to head
  function taleOfTape(m) {
    const total = m.talk + m.flex + m.hands, s = m.sides;
    const split = s && (s.a.talk + s.a.flex + s.a.hands + s.b.talk + s.b.flex + s.b.hands) >= 0.6 * total;
    const row = (label, a, b, fmt = n) => {
      const lead = typeof a === 'number' && typeof b === 'number' && a !== b ? (a > b ? 'a' : 'b') : '';
      return `<div class="tr"><span class="va${lead === 'a' ? ' lead' : ''}">${fmt(a)}</span><span class="k">${label}</span><span class="vb${lead === 'b' ? ' lead' : ''}">${fmt(b)}</span></div>`;
    };
    const allies = (code) => ((curated.countries || {})[code]?.allies || []).slice(0, 3).map(esc).join('<br>') || '<span class="muted">not on our list</span>';
    let rows = `<div class="tr head"><span class="va">${esc(m.a)}</span><span class="k">vs</span><span class="vb">${esc(m.b)}</span></div>`;
    if (split) rows += row('Talk', s.a.talk, s.b.talk) + row("Flexin'", s.a.flex, s.b.flex) + row('Hands', s.a.hands, s.b.hands);
    else rows += `<div class="tr wide"><span>Between them: ${n(m.talk)} talk · ${n(m.flex)} flexin' · ${n(m.hands)} hands. The split by side fills in over the first day of readings.</span></div>`;
    rows += row('Nuclear weapons', m.na ? 'Yes' : 'No', m.nb ? 'Yes' : 'No', esc);
    rows += `<div class="tr"><span class="va small">${allies(m.ca)}</span><span class="k">Allies</span><span class="vb small">${allies(m.cb)}</span></div>`;
    return `<div class="tape">${rows}</div><p class="note">Counts are news articles in 24h that GDELT codes as that side acting on the other${split ? '' : ' (pair totals until the split is ready)'}. Allies: curated and approximate. For entertainment and situational awareness.</p>`;
  }

  // ---- 6. Cornermen: allies, arms suppliers, treaty ties for each side (curated.json)
  function cornermen(m) {
    const side = (code, name) => {
      const c = (curated.countries || {})[code];
      if (!c) return `<div><h3>${esc(name)}</h3><p class="note">Not on our curated list yet.</p></div>`;
      const list = (title, xs) => xs && xs.length ? `<dt>${title}</dt><dd>${xs.map(esc).join(' · ')}</dd>` : `<dt>${title}</dt><dd class="muted">None listed</dd>`;
      return `<div><h3>${esc(name)}</h3><dl class="terms tight">${list('Allies', c.allies)}${list('Arms suppliers', c.arms)}${list('Treaty ties', c.treaties)}</dl></div>`;
    };
    return `<div class="corner2">${side(m.ca, m.a)}${side(m.cb, m.b)}</div><p class="note">${esc(curated.note || 'Curated by hand and approximate.')}</p>`;
  }

  // ---- 5. Press Conference: one line per side, from headlines where that side is the one talking
  function presser(d, m) {
    const p = m && (d.pressers || {})[m.key];
    $('presser').hidden = !p;
    if (!p) return;
    const side = (q, name) => `<div><h3>${esc(name)}</h3>${q ? `<blockquote>${link(q.url, esc(q.text))}</blockquote><p class="note">${esc(q.source)} · ${ago(q.time)}</p>` : '<p class="note">Nothing on the record from this corner in the last 48 hours.</p>'}</div>`;
    $('presserbody').innerHTML = side(p.a, m.a) + side(p.b, m.b);
    if (PAGE === 'card') $('pressernote').textContent = `Main event, ${m.a} vs ${m.b} · the sharpest recent line from each side`;
  }

  // ---- 14. The Poster: a typographic fight poster
  function poster(d, m, billing) {
    if (!m) { $('poster').hidden = true; return; }
    const rung = d.scales.rungs[m.rung - 1], [stakes] = STAKES[m.stakes] || STAKES.regional;
    const date = new Date(d.generatedAt).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const rest = billing === 'Main event' ? d.fightCard.slice(1, 4).map((x) => `${esc(x.a)} vs ${esc(x.b)}`).join(' · ') : '';
    $('poster').hidden = false;
    $('poster').className = `poster c-${statusColor(d, d.status.key)}`;
    $('poster').innerHTML = `<p class="p-top">We Beefin Index presents</p><p class="p-bill">${esc(billing)}</p>` +
      `<div class="p-fight"><span class="p-a">${esc(m.a)}</span><span class="p-vs">vs</span><span class="p-b">${esc(m.b)}</span></div>` +
      `<p class="p-rung" style="color:${RUNG_TONE[m.rung]}">${esc(rung.name)} · ${esc(stakes)}</p>` +
      `<div class="p-meta"><span>Date</span><b>${esc(date)}</b><span>Venue</span><b>${esc(theaterName(d, m.theater))}</b></div>` +
      (rest ? `<p class="p-under">Also on the card: ${rest}</p>` : '') +
      `<p class="p-fine">Index ${d.index} · TheseHandsCon ${d.handsCon.level} · for entertainment and situational awareness</p>`;
  }

  // ---- 15. The Weigh-In: today on one screenshot-sized card
  function weighIn(d) {
    const m = d.fightCard[0], st = d.streak;
    const date = new Date(d.generatedAt).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    $('weighin').hidden = false;
    $('wi').className = `wi c-${d.status.color}`;
    $('wi').innerHTML = `<div class="wi-top"><b>WE FIGHTING ERRR NAH?</b><span>${esc(date)}</span></div>` +
      `<div class="wi-row"><div class="wi-cell"><span class="k">We Beefin Index</span><span class="v">${d.index}</span><span class="s">${esc(d.status.label)}</span></div>` +
      `<div class="wi-cell c-${CON_TONE[d.handsCon.level]}"><span class="k">TheseHandsCon</span><span class="v">${d.handsCon.level}</span><span class="s">${esc(d.handsCon.name)}</span></div></div>` +
      (m ? `<div class="wi-main"><span class="k">Main event</span><b>${esc(m.a)} vs ${esc(m.b)}</b><span class="s" style="color:${RUNG_TONE[m.rung]}">${esc(d.scales.rungs[m.rung - 1].name)}</span></div>` : '') +
      `<div class="wi-foot"><span>${st ? `${st.days} day${st.days === 1 ? '' : 's'} at this level` : ''}${d.trend && d.trend.d24 != null ? ` · ${d.trend.d24 > 0 ? '+' : ''}${d.trend.d24} on the day` : ''}</span><span>For entertainment and situational awareness</span></div>`;
  }

  // ---- 13. The Streak (near the gauge, and big in The Vault)
  function streakLine(d) {
    const st = d.streak;
    $('streak').hidden = !st;
    if (!st) return;
    $('streak').innerHTML = st.days > 1
      ? `<b>${st.days} days straight</b> in ${esc(st.label)} · since ${fmtDay(st.since)}`
      : `<b>Day 1</b> in ${esc(st.label)}`;
    const best = d.records && d.records.longest.find((l) => l.status === st.status);
    $('streakbig').innerHTML = `<div class="big c-${d.status.color}"><span class="v">${st.days}</span><span class="k">day${st.days === 1 ? '' : 's'} straight in ${esc(st.label)}</span></div>` +
      `<p class="note">Since ${fmtDay(st.since)}. A day counts at the level it closed on (UTC).${best && best.days ? ` Longest run at this level on file: ${best.days} day${best.days === 1 ? '' : 's'} (${fmtDay(best.from)} to ${fmtDay(best.to)}).` : ''}</p>`;
  }

  // ---- 11. The Judges' Split: shown only when the ingredients land two or more levels apart
  function judges(d) {
    const st = d.scales.statuses, level = (v) => Math.max(0, st.findIndex((s) => v < s.max) === -1 ? st.length - 1 : st.findIndex((s) => v < s.max));
    const scored = d.ingredients.filter((i) => i.score != null).map((i) => ({ ...i, lvl: level(i.score) }));
    const hot = scored.reduce((a, i) => (!a || i.score > a.score ? i : a), null), cold = scored.reduce((a, i) => (!a || i.score < a.score ? i : a), null);
    const split = hot && cold && hot.lvl - cold.lvl >= 2;
    $('judges').hidden = !split;
    if (!split) return;
    const say = (i) => `<b>${esc(i.name)}</b> scores it ${i.score}: ${esc(st[i.lvl].label)}`;
    $('judges').innerHTML = `<h3>The Judges' Split</h3><p>${say(hot)}, while ${say(cold)}. The index splits the difference, so read the ingredients below before reading too much into ${d.index}.</p><p class="note">For entertainment and situational awareness.</p>`;
  }

  // ---- 2. The Undercard · 3. Card Changes
  function undercard(d) {
    const u = d.undercard || [];
    $('undercard').innerHTML = u.length ? u.map((m, i) => bout(m, i, d, false, 'Undercard')).join('') : '<p class="empty">Nothing below the main card right now.</p>';
  }
  function cardChanges(d) {
    const c = d.cardChanges;
    if (!c) { $('changes').innerHTML = '<p class="empty">No card on file for today yet.</p>'; return; }
    if (c.first) {
      $('changesnote').textContent = 'First card tracked';
      $('changes').innerHTML = `<p>Today's card is the first one on file (${fmtDay(c.since)}). Debuts and drop-offs start showing tomorrow.</p>`;
      return;
    }
    $('changesnote').textContent = `Today against ${fmtDay(c.vs)}`;
    const list = (xs) => xs.map((m) => `<li>${here(fightUrl(m.key), esc(m.name))} <span class="chip" style="color:${RUNG_TONE[m.rung]}">${esc(d.scales.rungs[m.rung - 1].name)}</span></li>`).join('');
    $('changes').innerHTML =
      (c.newMain ? `<p><b>New main event:</b> ${here(fightUrl(c.newMain.now.key), esc(c.newMain.now.name))}, taking over from ${esc(c.newMain.was.name)}.</p>` : '') +
      `<div><h3>Debuted</h3>${c.debuts.length ? `<ul class="plain">${list(c.debuts)}</ul>` : '<p class="note">No new bouts.</p>'}</div>` +
      `<div><h3>Fell off</h3>${c.dropped.length ? `<ul class="plain">${list(c.dropped)}</ul>` : '<p class="note">Nobody dropped off.</p>'}</div>`;
  }

  // ---- 9. The Cutman · 10. Training Camp
  function cornerList(id, items, color, empty) {
    $(id).innerHTML = items && items.length
      ? items.map((x) => `<li><span class="chips"><span class="chip" style="color:${color}">${esc(x.what)}</span></span><div>${link(x.url, esc(x.title))}</div><div class="meta">${esc(x.where)} · ${esc(x.source)} · ${ago(x.time)}</div></li>`).join('')
      : `<li class="empty">${empty}</li>`;
  }

  // ---- 12. The Record Book
  function recordBook(d) {
    const r = d.records;
    if (!r) { $('records').innerHTML = '<p class="empty">The record book opens with the first reading.</p>'; return; }
    $('recordnote').textContent = `${r.tracked} day${r.tracked === 1 ? '' : 's'} on file since ${fmtDay(r.since)}`;
    const runs = r.longest.map((l) => `<tr><td><span class="sw" style="background:${TONE[statusColor(d, l.status)]}"></span>${esc(l.label)}</td><td class="num">${l.days ? `${l.days} day${l.days === 1 ? '' : 's'}` : '–'}</td><td>${l.days ? `${fmtDay(l.from)}${l.to !== l.from ? ` to ${fmtDay(l.to)}` : ''}` : '<span class="muted">not yet</span>'}</td></tr>`).join('');
    $('records').innerHTML =
      `<div class="tiles"><div class="tile"><span class="k">All-time high</span><span class="v" style="color:${TONE[band(r.high.i)]}">${r.high.i}</span><span class="note">${fmtDay(r.high.d)}</span></div>` +
      `<div class="tile"><span class="k">All-time low</span><span class="v" style="color:${TONE[band(r.low.i)]}">${r.low.i}</span><span class="note">${fmtDay(r.low.d)}</span></div></div>` +
      `<div><h3>Longest streak at each level</h3><div class="scroll"><table><thead><tr><th>Level</th><th class="num">Run</th><th>When</th></tr></thead><tbody>${runs}</tbody></table></div></div>` +
      `<div><h3>On this day in beef history</h3>${r.onThisDay.length
        ? `<ul class="plain">${r.onThisDay.map((e) => `<li><b>${fmtDay(e.d)}</b>: index ${e.i}, ${esc(statusLabel(d, e.s))}${e.c ? `, TheseHandsCon ${e.c}` : ''}${e.main ? `. Main event: ${esc(e.main)}` : ''}</li>`).join('')}</ul>`
        : `<p class="note">Nothing on file for ${fmtDay(new Date(d.generatedAt).toISOString().slice(0, 10)).replace(/ \d+$/, '')} in an earlier year yet. The book opened on ${fmtDay(r.since)}.</p>`}</div>` +
      (r.mostMain.length ? `<div><h3>Most days as the main event</h3><ul class="plain">${r.mostMain.map((m) => `<li>${here(fightUrl(m.key), esc(m.name))}: ${m.days} day${m.days === 1 ? '' : 's'}</li>`).join('')}</ul></div>` : '') +
      `<p class="note">Built from this site's own readings: the last reading of each UTC day is that day's record. Days before the record book existed come from the 7-day trend.</p>`;
  }

  // ---- 16. The Scorebug: a mini scoreboard pinned to the top once the gauge scrolls away
  let bugWatch = null;
  function scorebug(d) {
    const m = d.fightCard[0];
    $('scorebug').className = `scorebug c-${d.status.color}`;
    $('scorebug').innerHTML = `<span class="sb-i">${d.index}</span><span class="sb-s">${esc(d.status.label)}</span><span class="sb-c c-${CON_TONE[d.handsCon.level]}">THC ${d.handsCon.level}</span>${m ? `<span class="sb-m">${esc(m.a)} vs ${esc(m.b)}</span>` : ''}<span class="sb-up">▲ top</span>`;
    const hero = document.getElementById('hero');
    if (bugWatch || !hero || !('IntersectionObserver' in window)) return;
    bugWatch = new IntersectionObserver(([e]) => { $('scorebug').hidden = e.isIntersecting || e.boundingClientRect.top > 0; });
    bugWatch.observe(hero);
  }

  // ---- 4. Main Event Deep Dive (fight.html?p=RUS-UKR): one template page, driven by the query string
  const pairKey = () => { const p = new URLSearchParams(location.search).get('p') || ''; return /^[A-Z]{3}-[A-Z]{3}$/.test(p) ? p : null; };
  function findBout(d, key) {
    const i = d.fightCard.findIndex((m) => m.key === key);
    if (i >= 0) return { m: d.fightCard[i], billing: BILLING[Math.min(i, 2)] };
    const u = (d.undercard || []).find((m) => m.key === key);
    if (u) return { m: u, billing: 'Undercard' };
    // Not on today's card: rebuild the bout from the last day it was on file.
    const day = (history?.days || []).slice().reverse().find((e) => e.card && e.card.some((c) => c[0] === key));
    if (!day) return null;
    const c = day.card.find((x) => x[0] === key), [ca, cb] = key.split('-');
    return { m: { key, a: c[1], b: c[2], ca, cb, talk: c[3], flex: c[4], hands: c[5], rung: c[6], handsPerHour: 0, stakes: 'regional', theater: 'other', sides: null, na: false, nb: false, move: 'flat' },
      billing: `Off the card today · last on ${fmtDay(day.d)}`, stale: true };
  }
  function rematch(d, m) {
    const days = (history?.days || []).filter((e) => e.card);
    if (!days.length) { $('rematch').innerHTML = '<p class="note">No stored readings yet.</p>'; return; }
    const flare = days.map((e) => ({ e, row: e.card.find((c) => c[0] === m.key) })).filter((x) => x.row && x.row[6] >= 3);
    const todayD = days[days.length - 1].d;
    // The current flare-up, if they are swinging today, runs back while the days are consecutive.
    let i = flare.length - 1, cutoff = todayD;
    const prevDay = (dd) => new Date(Date.parse(dd + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
    if (i >= 0 && flare[i].e.d === todayD) { while (i > 0 && flare[i - 1].e.d === prevDay(flare[i].e.d)) i--; cutoff = flare[i].e.d; i--; }
    const last = flare.filter((x) => x.e.d < cutoff).pop();
    const since = `The record book has ${days.length} day${days.length === 1 ? '' : 's'} of cards, from ${fmtDay(days[0].d)}.`;
    if (!last) {
      $('rematch').innerHTML = `<p>${cutoff !== todayD ? `Swingin' or worse every day on file since ${fmtDay(cutoff)}. No earlier flare-up on record.` : 'No earlier flare-up on file for these two.'}</p><p class="note">A flare-up is a day the bout closed at Swingin' or Full Send. ${since}</p>`;
      return;
    }
    const e = last.e;
    $('rematch').innerHTML = `<div class="big c-${statusColor(d, e.s)}"><span class="v">${fmtDay(e.d)}</span><span class="k">${esc(d.scales.rungs[last.row[6] - 1].name)} · ${n(last.row[5])} hands articles</span></div>` +
      `<p>That day the index closed at <b>${e.i}</b> (${esc(statusLabel(d, e.s))})${e.c ? `, TheseHandsCon <b>${e.c}</b>` : ''}.</p><p class="note">A flare-up is a day the bout closed at Swingin' or Full Send. ${since}</p>`;
  }
  function pairHistory(m) {
    const days = (history?.days || []).filter((e) => e.card).slice(-30);
    const rows = days.map((e) => ({ d: e.d, c: e.card.find((c) => c[0] === m.key) }));
    if (!rows.some((r) => r.c)) { $('pairhist').innerHTML = '<p class="note">No stored readings for this matchup yet.</p>'; return; }
    // Drawn at the panel's real width (one unit = one pixel) so labels stay 10px on any screen.
    const W = Math.max(300, Math.round($('pairhist').clientWidth || 360)), H = 130;
    const max = Math.max(...rows.map((r) => (r.c ? r.c[3] + r.c[4] + r.c[5] : 0)), 1), bw = Math.min(28, (W - 10) / Math.max(rows.length, 7));
    let s = '';
    rows.forEach((r, i) => {
      const x = 5 + i * bw;
      if (!r.c) { s += `<rect x="${x.toFixed(1)}" y="${H - 22}" width="${(bw - 2).toFixed(1)}" height="2" fill="var(--line)"/>`; return; }
      let y = H - 20;
      [[r.c[3], 'var(--blue)'], [r.c[4], 'var(--yellow)'], [r.c[5], 'var(--red)']].forEach(([v, col]) => {
        const h = (v / max) * (H - 34); y -= h;
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${col}"><title>${fmtDay(r.d)}: ${n(r.c[3])} talk, ${n(r.c[4])} flexin', ${n(r.c[5])} hands</title></rect>`;
      });
    });
    s += `<text x="5" y="${H - 4}" font-size="10" fill="var(--muted)">${fmtDay(rows[0].d)}</text><text x="${W - 5}" y="${H - 4}" font-size="10" fill="var(--muted)" text-anchor="end">${fmtDay(rows[rows.length - 1].d)}</text>`;
    $('pairhist').innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Talk, flexin' and hands per day">${s}</svg><span class="key"><span><i class="k-talk"></i>talk</span><span><i class="k-flex"></i>flexin'</span><span><i class="k-hands"></i>hands</span></span><p class="note">Each bar is the last reading of a UTC day. A flat line means the bout was off the card that day.</p>`;
  }
  let pbpShown = 20;
  function pairFeed(d, m) {
    const rows = (archive2 || []).filter((r) => { const c = (r[7] || '').split(','); return c.includes(m.ca) && c.includes(m.cb); });
    // 8. Home Crowd: each side's own press, by outlet (curated.json)
    const crowd = (code, name) => {
      const mine = rows.filter((r) => r[8] === code).slice(0, 8);
      return `<div><h3>${esc(name)} press</h3>${mine.length ? `<ul class="plain crowd">${mine.map((r) => `<li>${link(r[4], esc(r[3]))}<span class="note"> · ${esc(r[2])} · ${ago(r[0])}</span></li>`).join('')}</ul>` : `<p class="note">No outlet we file under ${esc(name)} ran this matchup in the last 48 hours.</p>`}</div>`;
    };
    $('homecrowd').innerHTML = crowd(m.ca, m.a) + crowd(m.cb, m.b) + '';
    $('homepanel').querySelector('.note.tail')?.remove();
    $('homepanel').insertAdjacentHTML('beforeend', '<p class="note tail">Outlets are filed under the country whose domestic press they are, from a short curated list plus web addresses (.ru, .il, .ua…). Unknown outlets are left out.</p>');
    // Timeline: reports per two hours over 48h, stacked by beef type
    const now = d.generatedAt, W = Math.max(300, Math.round($('pairline').clientWidth || 360)), H = 140, B = 24, bucket = 2 * 3600000, cols = Array.from({ length: B }, () => [0, 0, 0, 0]);
    for (const r of rows) {
      const k = B - 1 - Math.floor((now - r[0]) / bucket);
      if (k < 0 || k >= B) continue;
      cols[k][r[6] ? 0 : r[5] >= 4 ? 3 : r[5] >= 3 ? 2 : 1]++;
    }
    const mx = Math.max(1, ...cols.map((c) => c[0] + c[1] + c[2] + c[3])), bw = (W - 10) / B;
    let s = '';
    cols.forEach((c, i) => {
      let y = H - 18;
      [[c[0], 'var(--blue)'], [c[1], 'var(--yellow)'], [c[2], 'var(--orange)'], [c[3], 'var(--red)']].forEach(([v, col]) => {
        if (!v) return; const h = (v / mx) * (H - 30); y -= h;
        s += `<rect x="${(5 + i * bw).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" fill="${col}"/>`;
      });
    });
    s += `<text x="5" y="${H - 4}" font-size="10" fill="var(--muted)">48h ago</text><text x="${W - 5}" y="${H - 4}" font-size="10" fill="var(--muted)" text-anchor="end">now</text>`;
    $('pairline').innerHTML = rows.length
      ? `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Reports naming both sides over 48 hours">${s}</svg><span class="key"><span><i style="background:var(--blue)"></i>squashin' it</span><span><i style="background:var(--yellow)"></i>talk and flexin'</span><span><i style="background:var(--orange)"></i>swingin'</span><span><i style="background:var(--red)"></i>full send</span></span><p class="note">${n(rows.length)} reports in the last 48 hours name both ${esc(m.a)} and ${esc(m.b)}, in two-hour bars.</p>`
      : '<p class="note">No reports in the last 48 hours name both sides.</p>';
    // Play-by-play: newest first
    $('pbp').innerHTML = rows.slice(0, pbpShown).map((r) => {
      const type = r[6] ? d.scales.calm : d.scales.beefTypes[r[5]].name, color = r[6] ? 'var(--blue)' : TIER_TONE[r[5]];
      return `<li><span class="chips"><span class="chip" style="color:${color}">${esc(type)}</span></span><div>${link(r[4], esc(r[3]))}</div><div class="meta">${esc(r[2])} · ${ago(r[0])}</div></li>`;
    }).join('') || '<li class="empty">Nothing yet.</li>';
    $('pbpmore').hidden = rows.length <= pbpShown;
  }
  function deepDive(d) {
    const key = pairKey(), found = key && findBout(d, key);
    $('fightmissing').hidden = !!found;
    for (const id of ['tapepanel', 'cornerpanel', 'rematchpanel', 'pairhistpanel', 'homepanel', 'pairlinepanel', 'pbppanel']) $(id).hidden = !found;
    if (!found) {
      $('poster').hidden = true; $('presser').hidden = true;
      $('fightmissing').innerHTML = `That matchup isn't on file. Pick a bout from ${here('card.html', 'The Card')}.`;
      return;
    }
    const { m, billing } = found;
    document.title = `${m.a} vs ${m.b} · Deep Dive · We Beefin Index`;
    poster(d, m, billing);
    $('tape').innerHTML = taleOfTape(m);
    $('corners').innerHTML = cornermen(m);
    presser(d, m);
    rematch(d, m);
    pairHistory(m);
    pairFeed(d, m);
  }

  // ---- old one-page bookmarks: sections that moved to another page
  const MOVED = {
    wirepanel: 'wire.html', presswrap: 'wire.html', press: 'wire.html', redditwrap: 'wire.html', reddit: 'wire.html', xtick: 'wire.html',
    extras: 'wire.html', skypanel: 'wire.html', moneypanel: 'wire.html', advpanel: 'wire.html', nature: 'wire.html',
    cardhelp: 'card.html', undercard: 'card.html', poster: 'card.html', camp: 'card.html', cutman: 'card.html',
    log: 'vault.html', logpanel: 'vault.html', receipts: 'vault.html', srcs: 'vault.html', downwrap: 'vault.html', method: 'vault.html', records: 'vault.html',
  };
  function followMovedAnchor() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (PAGE === 'front' && id && !document.getElementById(id) && MOVED[id]) location.replace(`${MOVED[id]}#${encodeURIComponent(id)}`);
  }
  // The "we moved" note shows until the end of January 2027, or until it is dismissed.
  function movedNote() {
    let gone = false;
    try { gone = localStorage.getItem('beef-moved') === '1'; } catch { /* private mode */ }
    if (gone || Date.now() > Date.parse('2027-02-01')) return;
    $('moved').hidden = false;
    $('movedx').onclick = () => { $('moved').hidden = true; try { localStorage.setItem('beef-moved', '1'); } catch { /* ignore */ } };
  }

  function renderFeatures(d) {
    if (d.index == null) return;
    const main = d.fightCard[0];
    streakLine(d);
    judges(d);
    if (PAGE === 'front') { weighIn(d); scorebug(d); }
    if (PAGE === 'card') {
      poster(d, main, 'Main event');
      presser(d, main);
      undercard(d);
      cardChanges(d);
      cornerList('camp', d.camp, 'var(--yellow)', 'Nobody in camp: no drills, call-ups or deployments in the last 24 hours.');
      cornerList('cutman', d.cutman, 'var(--blue)', 'Nothing on the table: no ceasefire talk, mediators or negotiations for today\'s card.');
    }
    if (PAGE === 'vault') recordBook(d);
    if (PAGE === 'fight') deepDive(d);
  }

  function render(d) {
    data = d;
    const good = d.sources.filter((s) => s.ok), bad = d.sources.filter((s) => !s.ok);
    $('srcs').innerHTML = good.map((s) => `<li>${esc(s.name)}${s.note ? ` <span>· ${esc(s.note)}</span>` : ''}</li>`).join('');
    $('downwrap').hidden = !bad.length;
    $('downsum').textContent = `${bad.length} source${bad.length === 1 ? '' : 's'} not reporting on this reading`;
    $('down').innerHTML = bad.map((s) => `<li class="bad">${esc(s.name)}${s.note ? ` <span>· ${esc(s.note)}</span>` : ''}</li>`).join('');
    if (d.index == null) {
      $('status').textContent = 'No Signal';
      $('fresh').textContent = 'Every feed failed. Retrying.';
      $('dot').classList.add('stale');
      return;
    }
    const tone = d.status.color, ct = CON_TONE[d.handsCon.level];
    document.title = PAGE === 'front' ? `${d.index} · ${d.status.label} · We Beefin Index` : `${d.index} · ${PAGE_NAME} · We Beefin Index`;
    favicon(d);

    // hero
    $('hero').className = 'panel hero c-' + tone;
    $('status').textContent = d.status.label;
    drawGauge(d);
    const t = d.trend, arrow = { up: '▲', down: '▼', flat: '■', new: '·' }[t.key];
    const delta = t.d24 != null ? `${t.d24 > 0 ? '+' : ''}${t.d24} on the day` : t.d1 != null ? `${t.d1 > 0 ? '+' : ''}${t.d1} in the last hour` : 'building history';
    $('trend').className = 'trend c-' + (t.key === 'up' ? 'red' : t.key === 'down' ? 'green' : 'yellow');
    $('trend').innerHTML = `<b>${arrow} ${esc(t.label)}</b><span>${delta}</span>`;
    drawMove(d);
    $('blurb').textContent = d.status.blurb;
    $('parts').innerHTML = d.ingredients.map((i) => i.score == null
      ? `<div class="ing"><span><b>${esc(i.name)}</b></span><span class="pts">no signal</span><span class="d">${esc(i.what)}. Its share goes to the others.</span></div>`
      : meter(i.name, i.score, TONE[band(i.score)], `adds ${i.points}`, i.detail || i.what)).join('');

    // posture
    $('conpanel').className = 'panel c-' + ct;
    $('conbig').textContent = `TheseHandsCon ${d.handsCon.level}`;
    $('ladder').innerHTML = [...d.scales.handsCon].reverse().map((r) => `<div class="rung${r.level === d.handsCon.level ? ' on' : ''}"><span class="n">${r.level}</span><div><div class="nm">${esc(r.name)}</div><div class="bl">${esc(r.blurb)}</div></div></div>`).join('');
    $('why').innerHTML = d.handsCon.why.map((w) => `<li>${esc(w)}</li>`).join('');
    const tighter = d.scales.handsCon.find((h) => h.level === d.handsCon.level - 1);
    $('connote').textContent = `US posture score ${d.handsCon.score} out of 100.` + (tighter ? ` Level ${tighter.level} starts at ${tighter.min}.` : '');

    // rundown
    $('rundown').innerHTML = d.rundown.map((s) => `<p>${esc(s)}</p>`).join('');

    // alert banner: the latest level change, if it is recent
    const last = (d.log || [])[d.log.length - 1];
    if (last && Date.now() - last.t < 12 * 3600000) {
      const label = (k) => (d.scales.statuses.find((s) => s.key === k) || {}).label || k;
      const hotter = last.kind === 'con' ? last.to < last.from : d.scales.statuses.findIndex((s) => s.key === last.to) > d.scales.statuses.findIndex((s) => s.key === last.from);
      $('alert').hidden = false;
      $('alert').className = 'alert c-' + (hotter ? 'red' : 'green');
      $('alert').innerHTML = `<b>${last.kind === 'con' ? `TheseHandsCon moved ${last.from} → ${last.to}` : `Status changed: ${esc(label(last.from))} → ${esc(label(last.to))}`}</b><span>${ago(last.t)}</span>`;
    } else $('alert').hidden = true;

    // map + regions
    if (picked) picked = (d.hotSpots || []).find((s) => s.name === picked.name) || null;
    drawMap();
    $('spots').innerHTML = (d.hotSpots || []).slice(0, 8).map((s) => `<li><button type="button" data-name="${esc(s.name)}" title="Zoom to ${esc(s.name)}">${esc(s.name)} · <b>${s.n}</b></button></li>`).join('') || '<li class="note">No event data on this reading.</li>';
    $('theaters').innerHTML = d.theaters.map((r) => {
      const sub = [r.hands && `${n(r.hands)} force reports`, r.stories && `${r.stories} stor${r.stories === 1 ? 'y' : 'ies'}`].filter(Boolean).join(' · ');
      return `<div class="heat"><span class="nm">${esc(r.name)}</span><span class="val">${r.heat}</span><div class="track"><div class="fill" style="width:${r.heat}%;background:${TONE[band(r.heat * 0.9)]}"></div></div>` +
        `<span class="sub">${sub}${r.top ? ` · ${link(r.top.url, esc(r.top.title))}` : ''}</span></div>`;
    }).join('') || '<p class="empty">Nobody beefin. Enjoy it.</p>';

    // fight card: the top of the card on the front page, all eight bouts on The Card. Each bout opens its deep dive;
    // the main event carries the Tale of the Tape.
    $('card').innerHTML = d.fightCard.slice(0, PAGE === 'front' ? 4 : 8).map((m, i) => bout(m, i, d, i === 0)).join('') ||
      '<p class="empty">No matchups to show. The event feed is down, or the world took a day off.</p>';

    // doomsday
    const o = d.doomsday.official, b = d.doomsday.beefSeconds;
    $('clocks').innerHTML =
      (b == null ? '' : `<div class="clock"><span class="k">Beef Clock · live</span><span class="t" style="color:${TONE[band(d.doomsday.score)]}">${hms(b)}</span><span class="note">${toMidnight(b)}${b === o.seconds ? '' : ` · ${Math.abs(b - o.seconds)} s ${b > o.seconds ? 'better' : 'worse'} than official`}</span></div>`) +
      `<div class="clock"><span class="k">Doomsday Clock · official</span><span class="t">${hms(o.seconds)}</span><span class="note">${toMidnight(o.seconds)} · set ${esc(o.setOn)} by the ${esc(o.source)}</span></div>`;
    $('doomparts').innerHTML = d.doomsday.drivers.map((x) => x.value == null ? '' : meter(x.label, x.value, TONE[band(x.value)], '', x.what)).join('');
    const tests = d.doomsday.nukeTests;
    $('boom').innerHTML = tests == null ? '' : tests.length
      ? `<b class="up">Seismic boom check: ${tests.length} nuclear explosion${tests.length === 1 ? '' : 's'} logged in 30 days.</b> ${tests.map((x) => link(x.url, esc(x.title))).join('; ')}`
      : 'Seismic boom check: no nuclear test picked up by the USGS network in the last 30 days.';
    drawTimeline(d);

    // history + log
    drawHistory(d);
    const lbl = (k) => (d.scales.statuses.find((s) => s.key === k) || {}).label || k;
    $('log').innerHTML = (d.log || []).slice().reverse().slice(0, 6).map((e) =>
      `<div>${e.kind === 'con' ? `TheseHandsCon ${e.from} → ${e.to}` : `${esc(lbl(e.from))} → ${esc(lbl(e.to))}`} <span class="note">· ${ago(e.t)}</span>${e.why ? `<div class="note">${esc(e.why)}</div>` : ''}</div>`).join('')
      || '<p class="note">No level changes logged yet. Changes to the status or TheseHandsCon show up here.</p>';

    drawWire(d);

    // optional panels: shown only when their feed answered
    $('skypanel').hidden = !d.sky;
    if (d.sky) {
      $('sky').innerHTML = d.sky.groups.map((gr) => {
        // Each "N place" chunk stays on one line; wrapping happens at the comma between chunks.
        const where = Object.entries(gr.where).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, v]) => `<span class="nowrap">${v} ${esc(k === 'position hidden' ? k : 'over ' + k)}</span>`).join(', ');
        return `<div class="tile" title="${esc(gr.what)}"><span class="k">${esc(gr.name)}</span><span class="v">${gr.n}</span><span class="note">${where || esc(gr.what)}</span></div>`;
      }).join('');
      const usual = d.sky.usual != null ? ` Doomsday planes, bombers and tankers together: ${d.sky.strategic}, usually about ${d.sky.usual} (${d.sky.note}).` : ' Building a week of baseline before judging what is unusual.';
      const calls = d.sky.notable.length ? ` Up now: ${d.sky.notable.map((x) => `${esc(x.callsign || x.type)} (${esc(x.type)}, ${esc(x.region)})`).join(', ')}.` : '';
      $('skynote').innerHTML = `${n(d.sky.airborne)} military aircraft visible to volunteer receivers.${usual}${calls}`;
    }
    $('moneypanel').hidden = !d.money;
    if (d.money) {
      const tile = (k, q, unit, color) => q ? `<div class="tile"><span class="k">${k}</span><span class="v">${unit}${q.price}</span><span class="note ${q.change5d > 0 ? 'up' : 'down'}">${q.change5d > 0 ? '▲' : '▼'} ${Math.abs(q.change5d)}% in 5 days</span>${spark(q.spark, color)}<span class="note">close of <span class="nowrap">${esc(q.date)}</span></span></div>` : '';
      $('money').innerHTML = tile('Fear gauge (VIX)', d.money.vix, '', css('--yellow')) + tile('Oil (Brent)', d.money.oil, '$', css('--orange'));
    }
    $('advpanel').hidden = !d.advisories;
    if (d.advisories) {
      $('adv').innerHTML = d.advisories.doNotTravel.map((c) => `<span>${esc(c)}</span>`).join('');
      $('advfresh').innerHTML = d.advisories.fresh.length
        ? '<h3>Updated in the last two weeks</h3>' + d.advisories.fresh.map((a) => `<div>${a.url ? link(a.url, esc(a.country)) : esc(a.country)} <span class="note">· Level ${a.level} · ${ago(a.time)}</span></div>`).join('')
        : `<p class="note">${d.advisories.doNotTravel.length} countries on "Do Not Travel", ${d.advisories.reconsider} on "Reconsider Travel". Nothing changed in the last two weeks.</p>`;
    }

    // nature
    const q = d.nature.quakes || [], kp = d.nature.kp;
    const storm = kp ? (kp.kp >= 7 ? 'Severe geomagnetic storm' : kp.kp >= 5 ? 'Geomagnetic storm' : kp.kp >= 4 ? 'Unsettled' : 'Quiet') : null;
    $('nature').innerHTML =
      (kp ? `<div><h3>Space weather · NOAA</h3><div>Planetary Kp: <b>${kp.kp.toFixed(1)}</b> · ${storm} · 24h peak ${kp.max24h.toFixed(1)}</div></div>` : '') +
      `<div><h3>Significant earthquakes, 7 days · USGS</h3>${q.length ? q.map((e) => `<div>${link(e.url, esc(e.title))} <span class="note">· ${ago(e.time)}</span></div>`).join('') : '<div class="note">None logged this week.</div>'}</div>`;

    $('conf').textContent = `${d.confidence.label} · ${d.confidence.ok} of ${d.confidence.total} sources reporting`;
    fillTicker($('tick'), d.wire.stories.slice(0, 16).map((s) => `<span><b style="color:${s.calm ? 'var(--blue)' : TIER_TONE[s.tier]}">${esc(s.source.toUpperCase())}</b> ${link(s.url, esc(s.title))}</span>`), TICKER_SPEED.wire);
    // OSINT channels on Telegram: latest posts, or links to the channels when none came through.
    const feed = d.osint || { channels: [], posts: [] };
    fillTicker($('xtick'), feed.posts.length
      ? feed.posts.map((p) => `<span><b style="color:var(--blue)">${esc(p.user.toUpperCase())}</b> ${link(p.url, esc(p.text))} <span class="note">${ago(p.time)}</span></span>`)
      : feed.channels.map((c) => `<span>${link('https://t.me/' + encodeURIComponent(c.name), '<b style="color:var(--blue)">' + esc(c.label) + '</b>')} <span class="note">tap to open</span></span>`), TICKER_SPEED.osint);
    runSearch();
    freshness();
    renderFeatures(d);
  }

  function freshness() {
    if (!data || data.index == null) return;
    const stale = Date.now() - data.generatedAt > 45 * 60000;
    $('dot').classList.toggle('stale', stale || !!window.__SNAPSHOT__);
    $('fresh').textContent = (window.__SNAPSHOT__ ? 'Snapshot · ' : stale ? 'Stale · ' : 'Live · ') + 'read ' + ago(data.generatedAt);
  }

  async function load() {
    if (window.__SNAPSHOT__) return render(window.__SNAPSHOT__);
    try {
      const r = await fetch('data.json?' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      if (!data || d.generatedAt !== data.generatedAt) render(d);
    } catch (err) {
      if (!(err instanceof TypeError && /fetch/i.test(err.message)) && !/^\d+$/.test(err.message)) console.error(err);
      if (!data) $('fresh').textContent = 'No reading yet. Run the collector, then reload.';
      $('dot').classList.add('stale');
    }
  }

  $('picks').innerHTML = PICKS.map((p) => `<button type="button" data-q="${esc(p)}">${esc(p)}</button>`).join('');
  const newQuery = () => { kindFilter = 'all'; shown = 40; };
  $('picks').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $('q').value = b.dataset.q; newQuery(); runSearch(); runLive(b.dataset.q); });
  let searchTimer;
  $('q').addEventListener('input', () => { newQuery(); clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 150); });
  $('q').addEventListener('focus', loadArchive, { once: true });
  $('qform').addEventListener('submit', (e) => { e.preventDefault(); newQuery(); runSearch(); runLive($('q').value.trim()); });
  $('hits').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-kind]');
    if (tab) { kindFilter = tab.dataset.kind; shown = 40; runSearch(); return; }
    if (e.target.id === 'moreres') { shown += 40; runSearch(); }
  });
  // The search box always starts empty. (It used to remember the last search; clear what older visits saved.)
  try { localStorage.removeItem('beef-q'); } catch { /* private mode */ }
  $('tab-hot').onclick = () => { wireAll = false; if (data) drawWire(data); };
  $('tab-all').onclick = () => { wireAll = true; if (data) drawWire(data); };
  // map zoom + pan: wheel, pinch, drag, double-click, buttons
  {
    const cv = $('map'), pts = new Map();
    let drag = null, moved = false;
    const local = (ev) => { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
    cv.addEventListener('wheel', (ev) => {
      if (ev.deltaY > 0 && view.k <= 1.01) return; // let the page scroll when fully zoomed out
      ev.preventDefault();
      const [sx, sy] = local(ev);
      zoomAt(view.k * Math.exp(-ev.deltaY * (ev.deltaMode ? 0.04 : 0.0012)), sx, sy);
    }, { passive: false });
    cv.addEventListener('pointerdown', (ev) => {
      pts.set(ev.pointerId, local(ev)); moved = false;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; drag = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k }; }
      else if (view.k > 1.01 || ev.pointerType === 'mouse') drag = { at: local(ev), x: view.x, y: view.y };
      if (drag) cv.setPointerCapture(ev.pointerId);
    });
    cv.addEventListener('pointermove', (ev) => {
      if (!pts.has(ev.pointerId)) { pickSpot(ev); return; }
      pts.set(ev.pointerId, local(ev));
      if (drag && drag.pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        zoomAt(drag.k * (Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.pinch), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        moved = true;
      } else if (drag && drag.at && view.k > 1.01) {
        const [sx, sy] = local(ev), dx = sx - drag.at[0], dy = sy - drag.at[1];
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) { $('mapwrap').classList.add('dragging'); view.x = drag.x - dx / view.k; view.y = drag.y - dy / view.k; clampView(); queueMap(); }
      } else pickSpot(ev);
    });
    const end = (ev) => {
      pts.delete(ev.pointerId);
      if (pts.size < 2 && drag && drag.pinch) drag = null;
      if (!pts.size) { drag = null; $('mapwrap').classList.remove('dragging'); }
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('click', (ev) => {
      if (moved) return;
      const s = spotAt(ev); picked = s; showSpot(s); queueMap();
    });
    cv.addEventListener('dblclick', (ev) => { ev.preventDefault(); const [sx, sy] = local(ev); zoomAt(view.k * 2, sx, sy); });
    const mid = (f) => zoomAt(view.k * f, mapW / 2, mapH / 2);
    $('zin').onclick = () => mid(2); $('zout').onclick = () => mid(0.5);
    $('zreset').onclick = () => { view.k = 1; view.x = view.y = 0; picked = null; showSpot(null); queueMap(); };
    $('spots').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-name]'); if (!b || !data) return;
      const s = (data.hotSpots || []).find((x) => x.name === b.dataset.name); if (s) flyTo(s, 4);
    });
  }
  $('copy').onclick = async () => {
    if (!data) return;
    const text = data.rundown.join('\n');
    try { await navigator.clipboard.writeText(text); $('copy').textContent = 'Copied'; }
    catch { const r = document.createRange(); r.selectNodeContents($('rundown')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('copy').textContent = 'Selected'; }
    setTimeout(() => { $('copy').textContent = 'Copy'; }, 1800);
  };
  let resizeTimer;
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (data && data.index != null) drawMap(); }, 120); }).observe($('mapwrap'));
  setInterval(() => { $('utc').textContent = new Date().toISOString().slice(11, 19) + ' Zulu'; freshness(); }, 1000);
  followMovedAnchor();
  window.addEventListener('hashchange', followMovedAnchor);
  if (PAGE === 'front') movedNote();
  $('pbpbtn').onclick = () => { pbpShown += 20; const f = data && findBout(data, pairKey()); if (f) pairFeed(data, f.m); };
  (async () => {
    // The pages that show allies wait for the curated list; the deep dive also needs the archive files.
    if (['front', 'card', 'fight'].includes(PAGE) && !window.__SNAPSHOT__) curated = (await getJson('curated.json')) || curated;
    if (PAGE === 'fight') [history, archive2] = await Promise.all([getJson('history.json'), getJson('search.json').then((j) => j && j.rows)]);
    await load();
    if (!window.__SNAPSHOT__) setInterval(load, 60000);
  })();
})();
