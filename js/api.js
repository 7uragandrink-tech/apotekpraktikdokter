// ═══════════════════════════════════════════════════════════════
//  LAPISAN API — pengganti google.script.run
//  Semua komunikasi ke backend Apps Script lewat gasPost().
//  ⚠ Content-Type WAJIB text/plain: dengan application/json browser mengirim preflight CORS (OPTIONS)
//    yang tidak dijawab oleh Apps Script, sehingga permintaan gagal.
// ═══════════════════════════════════════════════════════════════
const GAS_TIMEOUT_MS = 120000; // batas tunggu satu permintaan (ekspor/backup bisa lama)

/** URL Web App valid: https://script.google.com/macros/s/<ID>/exec (atau varian akun Workspace: /a/macros/<domain>/s/<ID>/exec). */
function gasReady() {
  const u = String(typeof GAS_URL === 'undefined' ? '' : GAS_URL).trim();
  return /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[\w-]+\/exec$/.test(u);
}

/** Kirim satu permintaan JSON; mengembalikan objek jawaban mentah {success, data|message}. Melempar Error bila jaringan/format bermasalah. */
async function gasPost(payload, opt) {
  opt = opt || {};
  if (!gasReady()) throw new Error('GAS_URL belum diisi dengan benar di js/config.js (harus berakhiran /exec).');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), opt.timeout || GAS_TIMEOUT_MS);
  let teks;
  try {
    const res = await fetch(String(GAS_URL).trim(), {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload), signal: ctl.signal, keepalive: !!opt.keepalive, cache: 'no-store'
    });
    teks = await res.text();
  } catch (e) {
    throw new Error(e && e.name === 'AbortError' ? 'Server terlalu lama menjawab. Coba lagi sebentar lagi.' : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  } finally { clearTimeout(t); }
  try { return JSON.parse(teks); } catch (e) {
    throw new Error('Jawaban server tidak dikenali. Pastikan deployment Apps Script diatur "Anyone" dan GAS_URL adalah URL /exec dari deployment terbaru.');
  }
}

/** Panggil fungsi backend yang dilindungi (token + cek peran di server). Mengembalikan data; melempar Error(message) bila success=false. */
async function gasApi(fn, args, token, opt) {
  const j = await gasPost({ action: 'api', token: token || '', fn, data: args || {} }, opt);
  if (!j || !j.success) throw new Error((j && j.message) || 'Permintaan gagal');
  return j.data;
}

/** Aksi publik tanpa token (login, lupaPassword) atau dengan token (logout). */
async function gasAction(action, data, token, opt) {
  const j = await gasPost({ action, token: token || undefined, data: data || {} }, opt);
  if (!j || !j.success) throw new Error((j && j.message) || 'Permintaan gagal');
  return j.data;
}
