/**
 * Poznámky k parcelám – backend pro appku „Pozemky obce Stanoviště“.
 * Ukládá poznámky do listu „Poznamky“ této Google tabulky.
 *
 * Nastavení (jednou):
 *  1. Rozšíření → Apps Script, vložit tento kód, uložit.
 *  2. Nastavení projektu (ozubené kolo) → Vlastnosti skriptu → přidat
 *     HESLO = <heslo zastupitelstva>
 *  3. Nasadit → Nové nasazení → typ „Webová aplikace“
 *     Spustit jako: Já · Přístup: Kdokoli → Nasadit → zkopírovat URL.
 */
const SHEET = 'Poznamky';
const HEAD = ['id', 'parcela', 'text', 'autor', 'datum'];

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ok: false, error: 'pozadavek'}); }
  const heslo = PropertiesService.getScriptProperties().getProperty('HESLO');
  if (!heslo || req.key !== heslo) return out({ok: false, error: 'heslo'});

  const sh = sheet();
  if (req.action === 'list') {
    const v = sh.getDataRange().getValues().slice(1).filter(r => r[0]);
    return out({ok: true, notes: v.map(r => ({id: String(r[0]), parcela: String(r[1]), text: String(r[2]), autor: String(r[3]),
      datum: r[4] instanceof Date ? r[4].toISOString() : String(r[4])}))});
  }
  if (req.action === 'add') {
    const text = String(req.text || '').slice(0, 5000).trim();
    const parcela = String(req.parcela || '').slice(0, 30).trim();
    if (!text || !parcela) return out({ok: false, error: 'prazdne'});
    const n = {id: Utilities.getUuid(), parcela: parcela, text: text, autor: String(req.autor || '').slice(0, 80), datum: new Date().toISOString()};
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try { sh.appendRow([n.id, "'" + n.parcela, n.text, n.autor, new Date(n.datum)]); } finally { lock.releaseLock(); }
    return out({ok: true, note: n});
  }
  if (req.action === 'delete') {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const v = sh.getDataRange().getValues();
      for (let i = v.length - 1; i >= 1; i--) if (String(v[i][0]) === String(req.id)) { sh.deleteRow(i + 1); break; }
    } finally { lock.releaseLock(); }
    return out({ok: true});
  }
  return out({ok: false, error: 'akce'});
}

function doGet() { return out({ok: true, info: 'Poznámky k parcelám – běží.'}); }

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(HEAD); sh.setFrozenRows(1); sh.getRange('E:E').setNumberFormat('d.m.yyyy H:mm'); }
  return sh;
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
