'use strict';
const CATS = [
  ['H2 lesní pozemky', 'Lesní pozemky', '#2f7d3a'],
  ['H3 orná', 'Orná půda', '#e0b21f'],
  ['H3 trvalý travní porost', 'Trvalý travní porost', '#9fd45a'],
  ['H3 zahrady', 'Zahrady', '#4fd1b5'],
  ['H3 sad', 'Ovocný sad', '#f0773f'],
  ['H3 vodní plocha', 'Vodní plochy', '#3b9be8'],
  ['H4 zastavěná plocha', 'Zastavěné plochy (budovy)', '#e0384f'],
  ['H5 ostatní plocha', 'Ostatní plochy (cesty, prostranství)', '#b49ae0']
];
const COL = {}, NAME = {};
CATS.forEach(c => { COL[c[0]] = c[2]; NAME[c[0]] = c[1]; });
const nf = new Intl.NumberFormat('cs-CZ');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ls = {get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
            set(k, v) { try { localStorage.setItem(k, v); } catch {} }};
const norm = s => String(s).replace(/\s/g, '').toLowerCase();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

const map = L.map('map', {zoomSnap: .5, attributionControl: false, zoomControl: false, maxZoom: 20});
map.createPane('ortoPane'); map.getPane('ortoPane').style.zIndex = 150;

let OWN, BG, ORTO, ownLayer, bgLayer;
const byP = {};          // normalizovane cislo -> {layer, own:bool, props}
let notes = [];          // vsechny poznamky
let notesLayer = L.layerGroup();

Promise.all(['data/pozemky.json', 'data/okoli.json', 'data/orto.json'].map(u => fetch(u).then(r => r.json())))
  .then(([o, b, t]) => { OWN = o; BG = b; ORTO = t; init(); });

/* ---------- map ---------- */
let ortoOn = ls.get('orto', '1') === '1', ortoOv, ortoHi;
const BGS = {orto: {color: '#fff', weight: .8, opacity: .8, fillOpacity: 0},
             plain: {color: '#8f8d86', weight: .8, opacity: 1, fillColor: '#8f8d86', fillOpacity: .06}};

function init() {
  ortoOv = L.imageOverlay('orto/overview.jpg', ORTO.find(x => x.n === 'overview.jpg').b, {pane: 'ortoPane', interactive: false});
  ortoHi = ORTO.filter(x => x.n !== 'overview.jpg').map(x => ({b: L.latLngBounds(x.b), l: L.imageOverlay('orto/' + x.n, x.b, {pane: 'ortoPane', interactive: false})}));

  bgLayer = L.geoJSON(BG, {style: ortoOn ? BGS.orto : BGS.plain, onEachFeature: (f, l) => {
    const p = f.properties.p; byP[norm(p)] = {layer: l, own: false, props: {parcela: p}};
    l.on('click', () => openParcel(p));
  }}).addTo(map);

  let tot = 0;
  ownLayer = L.geoJSON(OWN, {
    style: f => ({color: COL[f.properties.kat], weight: 1.4, fillColor: COL[f.properties.kat], fillOpacity: .5}),
    onEachFeature: (f, l) => {
      const p = f.properties; tot += p.vymera;
      byP[norm(p.parcela)] = {layer: l, own: true, props: p};
      l.on('click', () => openParcel(p.parcela));
    }
  }).addTo(map);

  map.fitBounds(bgLayer.getBounds(), {padding: [10, 10]});
  map.setMaxBounds(bgLayer.getBounds().pad(.6));
  $('#tn').textContent = OWN.features.length;
  $('#ta').textContent = (tot / 1e4).toLocaleString('cs-CZ', {maximumFractionDigits: 1});
  buildLegend();
  map.on('moveend', () => { ortoUpd(); labels(); });
  ortoUpd(); labels();
  $('#bLayer').classList.toggle('on', ortoOn);
  notesInit();
}

function ortoUpd() {
  if (!ortoOn) { map.removeLayer(ortoOv); ortoHi.forEach(o => map.removeLayer(o.l)); return; }
  if (!map.hasLayer(ortoOv)) ortoOv.addTo(map);
  const v = map.getBounds().pad(.3), hi = map.getZoom() >= 15.5;
  ortoHi.forEach(o => { if (hi && v.intersects(o.b)) { if (!map.hasLayer(o.l)) o.l.addTo(map); } else if (map.hasLayer(o.l)) map.removeLayer(o.l); });
}

const labLayer = L.layerGroup().addTo(map);
function labels() {
  labLayer.clearLayers();
  if (map.getZoom() < 17) return;
  const b = map.getBounds().pad(.1);
  for (const k in byP) {
    const e = byP[k];
    if (!map.hasLayer(e.layer)) continue;
    e.c = e.c || e.layer.getBounds().getCenter();
    if (!b.contains(e.c)) continue;
    labLayer.addLayer(L.marker(e.c, {interactive: false, icon: L.divIcon({className: 'lbl ' + (e.own ? 'own' : 'bg'), html: esc(e.props.parcela), iconSize: null})}));
  }
}

function buildLegend() {
  const cd = $('#cats');
  CATS.forEach(c => {
    const fs = OWN.features.filter(f => f.properties.kat === c[0]); if (!fs.length) return;
    const a = fs.reduce((s, f) => s + f.properties.vymera, 0);
    const d = document.createElement('div'); d.className = 'cat';
    d.innerHTML = `<span class="sw" style="background:${c[2]}"></span><span>${c[1]}</span><span class="n">${fs.length} · ${(a / 1e4).toLocaleString('cs-CZ', {maximumFractionDigits: 2})} ha</span>`;
    const ls_ = fs.map(f => byP[norm(f.properties.parcela)].layer);
    d.onclick = () => { const on = !d.classList.toggle('off'); ls_.forEach(l => on ? ownLayer.addLayer(l) : ownLayer.removeLayer(l)); labels(); };
    cd.appendChild(d);
  });
  const d = document.createElement('div'); d.className = 'cat';
  d.innerHTML = `<span class="sw" style="background:rgba(143,141,134,.2);border:1px solid #8f8d86"></span><span>Ostatní parcely (nejsou obce)</span><span class="n">${BG.features.length}</span>`;
  d.onclick = () => { if (map.hasLayer(bgLayer)) { map.removeLayer(bgLayer); d.classList.add('off'); } else { bgLayer.addTo(map); bgLayer.bringToBack(); d.classList.remove('off'); } labels(); };
  cd.appendChild(d);
}

$('#bLayer').onclick = () => {
  ortoOn = !ortoOn; ls.set('orto', ortoOn ? '1' : '0');
  $('#bLayer').classList.toggle('on', ortoOn); bgLayer.setStyle(ortoOn ? BGS.orto : BGS.plain); ortoUpd();
};

/* ---------- sheets ---------- */
function show(id) { ['sheet', 'menu'].forEach(x => $('#' + x).hidden = x !== id); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $('#' + b.dataset.close).hidden = true; highlight(null); });
$('#bMenu').onclick = () => { renderNotesCfg(); show('menu'); };

let hl = null;
function highlight(l) {
  if (hl) { hl.setStyle({weight: hl._own ? 1.4 : .8}); hl = null; }
  if (l) { l._own = !!byP[norm(l.feature.properties.parcela || l.feature.properties.p)]?.own; l.setStyle({weight: 4}); l.bringToFront(); hl = l; }
}

function centroidOf(l) { return l.getBounds().getCenter(); }

function openParcel(num, fly) {
  const e = byP[norm(num)]; if (!e) return;
  highlight(e.layer);
  if (fly) map.fitBounds(e.layer.getBounds(), {maxZoom: 18.5, padding: [60, 60]});
  const p = e.props, c = centroidOf(e.layer);
  let h = `<h2>Parcela ${esc(p.parcela)}</h2>`;
  if (e.own) {
    h += `<span class="tag" style="background:${COL[p.kat]}">Obecní · ${esc(NAME[p.kat])}</span>
      <table class="kv"><tr><td>Druh (soupis)</td><td>${esc(p.druh)}</td></tr>
      <tr><td>Výměra (soupis)</td><td>${nf.format(p.vymera)} m²</td></tr>
      ${p.vymera !== p.plocha_gis ? `<tr><td>Výměra (z hranic)</td><td>${nf.format(p.plocha_gis)} m²</td></tr>` : ''}
      ${p.pozn ? `<tr><td>Poznámka ze soupisu</td><td>${esc(p.pozn)}</td></tr>` : ''}</table>`;
  } else {
    h += `<span class="tag" style="background:#8f8d86">Není ve vlastnictví obce</span>`;
  }
  h += `<div class="links">
    ${e.own ? `<a class="btn" href="https://nahlizenidokn.cuzk.gov.cz/ZobrazObjekt.aspx?typ=parcela&id=${p.id}" target="_blank" rel="noopener">Nahlížení do KN</a>` : `<a class="btn" href="https://nahlizenidokn.cuzk.gov.cz/" target="_blank" rel="noopener">Nahlížení do KN</a>`}
    <a class="btn" href="https://mapy.com/cs/letecka?x=${c.lng.toFixed(6)}&y=${c.lat.toFixed(6)}&z=18" target="_blank" rel="noopener">Mapy.cz</a>
    <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat.toFixed(6)},${c.lng.toFixed(6)}" target="_blank" rel="noopener">Navigovat</a></div>`;
  h += `<h3>Poznámky</h3><div id="pNotes"></div>`;
  $('#sheetBody').innerHTML = h;
  renderParcelNotes(p.parcela);
  show('sheet');
}

/* ---------- search ---------- */
$('#bSearch').onclick = () => { const s = $('#searchBox'); s.hidden = !s.hidden; if (!s.hidden) $('#q').focus(); };
$('#q').oninput = () => {
  const v = norm($('#q').value), res = $('#res'); res.innerHTML = ''; if (!v) return;
  const ks = Object.keys(byP).filter(k => k.startsWith(v) || k.replace('st.', '').startsWith(v))
    .sort((a, b) => (byP[b].own - byP[a].own) || a.length - b.length || a.localeCompare(b)).slice(0, 15);
  ks.forEach(k => {
    const e = byP[k], d = document.createElement('div');
    d.className = e.own ? 'own' : '';
    d.textContent = e.props.parcela + (e.own ? ' – obecní, ' + NAME[e.props.kat].toLowerCase() : ' – není obce');
    d.onclick = () => { $('#searchBox').hidden = true; $('#q').blur(); openParcel(e.props.parcela, true); };
    res.appendChild(d);
  });
  if (!ks.length) res.innerHTML = '<div class="mut">Nic nenalezeno.</div>';
};

/* ---------- GPS ---------- */
let watch = null, meMk = null, meCirc = null, firstFix = true, curParcel = null;
$('#bGps').onclick = () => {
  if (watch !== null) { stopGps(); return; }
  if (!navigator.geolocation) { alertHere('Tento prohlížeč neumí zjistit polohu.'); return; }
  $('#bGps').classList.add('wait'); firstFix = true;
  watch = navigator.geolocation.watchPosition(onPos, err => {
    stopGps();
    alertHere(err.code === 1 ? 'Poloha není povolená. Povol ji v nastavení prohlížeče pro tuto stránku.' : 'Polohu se nepodařilo zjistit.');
  }, {enableHighAccuracy: true, maximumAge: 5000, timeout: 20000});
};
function stopGps() {
  if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null;
  $('#bGps').classList.remove('on', 'wait');
  if (meMk) { map.removeLayer(meMk); map.removeLayer(meCirc); meMk = meCirc = null; }
  $('#here').hidden = true;
}
function alertHere(t) { const h = $('#here'); h.innerHTML = esc(t); h.hidden = false; h.onclick = () => h.hidden = true; }
function onPos(pos) {
  const ll = [pos.coords.latitude, pos.coords.longitude], acc = pos.coords.accuracy;
  $('#bGps').classList.remove('wait'); $('#bGps').classList.add('on');
  if (!meMk) {
    meCirc = L.circle(ll, {radius: acc, color: '#1a73e8', weight: 1, fillOpacity: .12, interactive: false}).addTo(map);
    meMk = L.marker(ll, {icon: L.divIcon({className: 'me'}), interactive: false, zIndexOffset: 1000}).addTo(map);
  } else { meMk.setLatLng(ll); meCirc.setLatLng(ll).setRadius(acc); }
  const inside = bgLayer.getBounds().pad(.05).contains(ll);
  if (firstFix) { firstFix = false; if (inside) map.setView(ll, Math.max(map.getZoom(), 17.5)); }
  const hit = whichParcel(ll[1], ll[0]);
  const h = $('#here'); h.hidden = false;
  const accTxt = `přesnost ±${Math.round(acc)} m`;
  if (!inside && !hit) { h.innerHTML = `<b>Jsi mimo katastr Stanoviště</b><span class="mut">${accTxt}</span>`; h.onclick = null; curParcel = null; return; }
  if (!hit) { h.innerHTML = `<b>Parcelu se nepodařilo určit</b><span class="mut">${accTxt}</span>`; h.onclick = null; return; }
  curParcel = hit.props.parcela;
  h.innerHTML = hit.own
    ? `<b><span class="sw" style="background:${COL[hit.props.kat]}"></span>Stojíš na obecní parcele ${esc(curParcel)}</b><span class="mut">${esc(NAME[hit.props.kat])} · ${accTxt}</span>`
    : `<b>Parcela ${esc(curParcel)} – není obce</b><span class="mut">${accTxt}</span>`;
  h.onclick = () => openParcel(curParcel);
}
function inRing(x, y, r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function inFeature(x, y, f) {
  return f.geometry.coordinates.some(poly => inRing(x, y, poly[0]) && !poly.slice(1).some(h => inRing(x, y, h)));
}
function whichParcel(x, y) {
  for (const f of OWN.features) if (inFeature(x, y, f)) return byP[norm(f.properties.parcela)];
  for (const f of BG.features) if (inFeature(x, y, f)) return byP[norm(f.properties.p)];
  return null;
}

/* ---------- notes (Google Apps Script) ---------- */
const notesOn = () => !!window.NOTES_URL;
const key = () => ls.get('notesKey', '');
const author = () => ls.get('notesAuthor', '');

async function api(body) {
  const r = await fetch(window.NOTES_URL, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({...body, key: key()})});
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Chyba'); return j;
}
async function notesInit() {
  map.addLayer(notesLayer);
  if (!notesOn() || !key()) return;
  try { notes = (await api({action: 'list'})).notes; drawNoteMarks(); } catch (e) { console.warn(e); }
}
function drawNoteMarks() {
  notesLayer.clearLayers();
  const seen = new Set(notes.map(n => norm(n.parcela)));
  seen.forEach(k => { const e = byP[k]; if (e) notesLayer.addLayer(L.marker(centroidOf(e.layer), {icon: L.divIcon({className: 'nmark'}), interactive: false})); });
}
function renderParcelNotes(parcela) {
  const box = $('#pNotes'); if (!box) return;
  if (!notesOn()) { box.innerHTML = '<p class="mut">Poznámky zatím nejsou zapnuté.</p>'; return; }
  if (!key()) { box.innerHTML = '<p class="mut">Pro poznámky zadej v menu ☰ své jméno a heslo zastupitelstva.</p>'; return; }
  const list = notes.filter(n => norm(n.parcela) === norm(parcela)).sort((a, b) => b.datum.localeCompare(a.datum));
  box.innerHTML = (list.length ? list.map(n => `<div class="note"><div>${esc(n.text).replace(/\n/g, '<br>')}</div>
      <div class="meta"><span>${esc(n.autor)} · ${new Date(n.datum).toLocaleDateString('cs-CZ')}</span>
      <button class="del" data-id="${esc(n.id)}">smazat</button></div></div>`).join('') : '<p class="mut">Zatím žádná poznámka.</p>')
    + `<textarea id="nText" placeholder="Nová poznámka k parcele ${esc(parcela)}…"></textarea>
       <div class="row"><button class="btn pri" id="nAdd">Uložit poznámku</button><span class="mut" id="nMsg"></span></div>`;
  box.querySelectorAll('.del').forEach(b => b.onclick = async () => {
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'opravdu smazat?'; return; }
    try { await api({action: 'delete', id: b.dataset.id}); notes = notes.filter(n => n.id !== b.dataset.id); drawNoteMarks(); renderParcelNotes(parcela); }
    catch (e) { $('#nMsg').textContent = 'Nepodařilo se smazat: ' + e.message; }
  });
  $('#nAdd').onclick = async () => {
    const t = $('#nText').value.trim(); if (!t) return;
    $('#nAdd').disabled = true; $('#nMsg').textContent = 'Ukládám…';
    try { const j = await api({action: 'add', parcela, text: t, autor: author() || 'neuvedeno'}); notes.push(j.note); drawNoteMarks(); renderParcelNotes(parcela); }
    catch (e) { $('#nMsg').textContent = 'Nepodařilo se uložit: ' + e.message; $('#nAdd').disabled = false; }
  };
}
function renderNotesCfg() {
  const box = $('#notesCfg');
  if (!notesOn()) { box.innerHTML = '<p class="mut">Poznámky zatím nejsou zapnuté (chybí napojení na tabulku).</p>'; return; }
  box.innerHTML = `<p class="mut">Poznámky k parcelám se ukládají do společné tabulky a vidí je všichni zastupitelé.</p>
    <input class="txt" id="cAuth" placeholder="Tvoje jméno" value="${esc(author())}">
    <div style="height:8px"></div>
    <input class="txt" id="cKey" type="password" placeholder="Heslo zastupitelstva" value="${esc(key())}">
    <div class="row"><button class="btn pri" id="cSave">Uložit</button><span class="mut" id="cMsg"></span></div>`;
  $('#cSave').onclick = async () => {
    ls.set('notesAuthor', $('#cAuth').value.trim()); ls.set('notesKey', $('#cKey').value);
    $('#cMsg').textContent = 'Ověřuji…';
    try { notes = (await api({action: 'list'})).notes; drawNoteMarks(); $('#cMsg').textContent = `Hotovo, načteno ${notes.length} poznámek.`; }
    catch (e) { $('#cMsg').textContent = e.message === 'heslo' ? 'Špatné heslo.' : 'Nepodařilo se připojit.'; }
  };
}
