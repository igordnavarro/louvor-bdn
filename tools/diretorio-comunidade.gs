/**
 * Worship Church — diretório da comunidade
 *
 * Recebe as músicas novas criadas no app e devolve a lista para todos.
 * Fica na aba "Comunidade" da planilha "Worship Church - Controle".
 *
 * Como instalar (uma vez só):
 *  1. Abra a planilha "Worship Church - Controle" → Extensões → Apps Script.
 *  2. Apague o que estiver lá, cole TODO este arquivo e clique em Salvar.
 *  3. Implantar → Nova implantação → tipo "App da Web".
 *       Executar como: Eu        Quem pode acessar: Qualquer pessoa
 *  4. Autorize, copie a "URL do app da Web" (termina em /exec) e coloque em config.js → directoryUrl.
 *
 * Moderação: para esconder uma música, escreva "oculta" na coluna "status" da aba Comunidade.
 */
const ABA = 'Comunidade';
const COLS = ['uid', 'chave', 'titulo', 'artista', 'tom', 'pad', 'bpm', 'capo', 'obs', 'youtube', 'enviado_por', 'atualizado', 'cifra', 'status'];

function aba_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ABA);
  if (!sh) { sh = ss.insertSheet(ABA); sh.appendRow(COLS); sh.setFrozenRows(1); sh.hideColumns(2); }
  return sh;
}
function hash_(s) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s)));
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
const txt_ = (v, n) => String(v == null ? '' : v).slice(0, n);

function doGet() {
  const rows = aba_().getDataRange().getValues().slice(1);
  const songs = rows.filter(r => r[0] && r[2] && r[12] && String(r[13]).toLowerCase() !== 'oculta').map(r => ({
    uid: String(r[0]), title: r[2], artist: r[3], key: r[4], pad: r[5], bpm: r[6], capo: r[7], note: r[8],
    youtube: r[9], by: r[10], t: r[11] instanceof Date ? r[11].getTime() : r[11], body: r[12]
  }));
  return json_({ ok: true, songs });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const m = JSON.parse(e.postData.contents);
    const uid = txt_(m.uid, 40).replace(/\W/g, '');
    if (!uid || !m.k) return json_({ ok: false, erro: 'sem id' });
    const sh = aba_();
    const ids = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
    let row = -1;
    for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === uid) { row = i + 1; break; }
    if (row > 0 && String(ids[row - 1][1]) !== hash_(m.k)) return json_({ ok: false, erro: 'chave' });
    if (m.a === 'del') { if (row > 0) sh.deleteRow(row); return json_({ ok: true }); }
    const title = txt_(m.title, 120).trim(), body = txt_(m.body, 30000);
    if (!title || !body.trim()) return json_({ ok: false, erro: 'vazia' });
    const status = row > 0 ? sh.getRange(row, 14).getValue() : '';
    const vals = [uid, hash_(m.k), title, txt_(m.artist, 120), txt_(m.key, 6), txt_(m.pad, 6), parseInt(m.bpm, 10) || '',
      parseInt(m.capo, 10) || 0, txt_(m.note, 500), txt_(m.youtube, 200), txt_(m.by, 60), new Date(), body, status];
    // célula começando com = + - @ seria fórmula: força texto
    const safe = vals.map(v => (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v);
    if (row > 0) sh.getRange(row, 1, 1, COLS.length).setValues([safe]); else sh.appendRow(safe);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, erro: String(err) });
  } finally { lock.releaseLock(); }
}
