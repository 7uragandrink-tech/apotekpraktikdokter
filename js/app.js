// ═══ UTIL ═══
const MEM = {};
const NS = 'apk_'; // awalan kunci penyimpanan: origin github.io dipakai bersama oleh semua repo milik satu akun
const store = {
  get(k, p) { try { if (k === 'tk') return sessionStorage.getItem(NS + 'tk') || localStorage.getItem(NS + 'tk'); return (p ? localStorage : sessionStorage).getItem(NS + k); } catch (e) { return MEM[k] || null; } }, // token: sesi biasa atau 'Tetap masuk'
  set(k, v, p) { try { (p ? localStorage : sessionStorage).setItem(NS + k, v); } catch (e) { MEM[k] = v; } },
  del(k) { try { sessionStorage.removeItem(NS + k); } catch (e) {} if (k === 'tk') { try { localStorage.removeItem(NS + 'tk'); } catch (e) {} } delete MEM[k]; }
};
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const tgl = s => s ? String(s).split('-').reverse().join('/') : '';
// Pustaka berat dimuat HANYA saat dibutuhkan (mempercepat pembukaan aplikasi)
const LIBS = { qr: ['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'], chart: ['https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'], xlsx: ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'],
  pdf: ['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'] };
const LOADED = {};
function lib(name, quiet) {
  if (LOADED[name]) return LOADED[name];
  if (!quiet) spin(1);
  return LOADED[name] = LIBS[name].reduce((p, u) => p.then(() => new Promise((ok, no) => { const s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = () => no(new Error('Gagal memuat pustaka dari internet, periksa koneksi')); document.head.appendChild(s); })), Promise.resolve())
    .then(() => { if (!quiet) spin(-1); }, e => { if (!quiet) spin(-1); delete LOADED[name]; throw e; });
}
// Lewati pembaruan tampilan bila isinya identik (tidak berkedip, tidak memutus ketikan/scroll)
(() => { const el = $('#view'), d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'); let last = null;
  Object.defineProperty(el, 'innerHTML', { configurable: true, get() { return d.get.call(this); }, set(v) { if (v === last) return; last = v; d.set.call(this, v); } }); })();
const AK = 'Apotek dan Kasir'; // peran gabungan Apotek + Kasir
let U, CFG = {}, DOK = [], V = 'beranda', timer, busy = 0, MB, chart, OBAT = [], ITEMS = [], PICK = null;
let PBFL = [], PG = [], DKL = [], RS = [], PTAB = 'antrian', RH = null, RW = null, RHL = [], ATAB = 'masuk', RR = null, RRL = [], PB = null, PBL = [], PI = [];
let FORM_ID = null, FORM_RO = false, DIRTY = false, AS;

let BG = false, spinT = null; // BG = sedang refresh otomatis (tanpa indikator)
function spin(d) { // indikator hanya muncul jika proses > 0,4 detik, sehingga tidak berkedip
  busy += d;
  if (busy > 0) { if (!spinT && $('#spin').classList.contains('d-none')) spinT = setTimeout(() => { spinT = null; if (busy > 0) $('#spin').classList.remove('d-none'); }, 400); }
  else { busy = 0; clearTimeout(spinT); spinT = null; $('#spin').classList.add('d-none'); }
}
function call(fn, a, quiet) { // fetch ke Apps Script (lihat js/api.js); sesi habis → kembali ke halaman masuk
  quiet = quiet || BG;
  if (!quiet) spin(1);
  return gasApi(fn, a || {}, store.get('tk')).then(d => { if (!quiet) spin(-1); return d; }, e => {
    if (!quiet) spin(-1);
    if (/Sesi berakhir/.test(e.message)) { store.del('tk'); showLogin(); }
    throw e;
  });
}
function toast(m, t = 'success') { // id pesan = #tmsg (sebelumnya bentrok dengan tabel #tb)
  const e = $('#T'); e.className = 'toast align-items-center border-0 text-bg-' + t;
  e.querySelector('.btn-close').classList.toggle('btn-close-white', !['warning', 'info'].includes(t));
  $('#tmsg').textContent = m; bootstrap.Toast.getOrCreateInstance(e, { delay: 4000 }).show();
}
const guard = async (p, ok) => { try { const r = await p; if (ok) toast(ok); return r; } catch (e) { toast(e.message, 'danger'); throw e; } };
function modal(title, body, foot, size) {
  $('#mt').textContent = title; $('#mb').innerHTML = body;
  $('#mf').innerHTML = foot || '<button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>';
  $('#md').className = 'modal-dialog modal-dialog-centered ' + (size || ''); MB = MB || new bootstrap.Modal($('#M')); MB.show();
}
const closeM = () => MB && MB.hide();
const badge = s => `<span class="badge bg-${({Menunggu:'warning text-dark','Masuk Ruangan':'info',Diperiksa:'primary',Selesai:'success',Batal:'danger',Dibuat:'warning text-dark',Diproses:'info',Diserahkan:'success',Dibatalkan:'danger',Draf:'secondary',Terkirim:'success'})[s] || 'secondary'}">${esc(s)}</span>`;
const val = id => ($('#' + id) || {}).value || '';
function toggleDark() { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; setTheme(n); store.set('th', n, true); $('#dm').checked = n === 'dark'; }
function setTheme(t) { document.documentElement.dataset.theme = t; document.documentElement.dataset.bsTheme = t; }
function toggleSide() { $('#sidebar').classList.toggle('show'); $('#shade').classList.toggle('show'); }

// ═══ INIT & NAVIGASI ═══
const MENU = [
  ['beranda','Beranda','house-door','*'], ['antrian','Pendaftaran & Antrian','people','Pemilik,Pendaftaran,Dokter,'+AK],
  ['periksa','Pemeriksaan','clipboard2-pulse','Pemilik,Dokter'], ['apotek','Resep & Apotek','capsule','Pemilik,Dokter,'+AK],
  ['stok','Stok Obat','box-seam','Pemilik,'+AK], ['pbf','Kerja Sama PBF','truck','Pemilik,'+AK], ['kasir','Kasir','cash-coin','Pemilik,'+AK],
  ['laporan','Laporan Kas','graph-up','Pemilik,'+AK], ['pengaturan','Pengaturan','gear','Pemilik']
];
let started = false;
function initApp() {
  if (!gasReady()) { const b = $('#boot'); if (b) b.innerHTML = '<div class="text-white text-center p-4" style="max-width:520px"><h5>URL backend belum diisi</h5><p class="mb-0">Buka berkas <code>js/config.js</code>, isi <code>GAS_URL</code> dengan URL Web App Apps Script (berakhiran <code>/exec</code>), simpan, lalu muat ulang halaman.</p></div>'; return; }
  try {
    const th = store.get('th', true) || 'light'; setTheme(th); $('#dm').checked = th === 'dark';
    if (store.get('tk')) start(); else showLogin();
  } catch (e) { showLogin(); toast(e.message, 'danger'); }
  finally { const b = $('#boot'); if (b) b.remove(); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp); else initApp();
function showLogin() { // username terakhir & pilihan 'Tetap masuk' diingat; kursor langsung ke password
  clearInterval(timer); $('#login').classList.remove('d-none'); $('#lp').value = ''; showPanel(1);
  const lu = store.get('lu', true) || ''; $('#lu').value = lu; $('#lingat').checked = store.get('ingat', true) === '1'; $(lu ? '#lp' : '#lu').focus(); }
function showPanel(n) { $('#lg1').classList.toggle('d-none', n !== 1); $('#lg2').classList.toggle('d-none', n !== 2); $('#lg3').classList.toggle('d-none', n !== 3); $('#lerr').textContent = ''; $('#lerr2').textContent = ''; }
function togglePw(id, btn) { const i = $('#' + id), s = i.type === 'password'; i.type = s ? 'text' : 'password'; btn.innerHTML = '<i class="bi bi-eye' + (s ? '-slash' : '') + '"></i>'; }
const pwField = (id, label) => `<label class="small mt-2">${label}</label><div class="input-group"><input id="${id}" type="password" class="form-control" autocomplete="new-password"><button class="btn btn-outline-secondary" type="button" tabindex="-1" title="Tampilkan / sembunyikan" onclick="togglePw('${id}',this)"><i class="bi bi-eye"></i></button></div>`;
function fmtKode(el) { const v = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); el.value = (v.match(/.{1,4}/g) || []).join('-'); } // XXXX-XXXX-XXXX otomatis
function unduhKode(kode) { tbSave(new Blob(['Kode Pemulihan - ' + (CFG.nama_praktik || 'Praktek Mandiri Dokter Spesialis') + '\r\n' + kode + '\r\n\r\nSimpan di tempat aman. Dipakai di halaman masuk > Lupa password (khusus Pemilik).\r\n'], { type: 'text/plain' }), 'Kode_Pemulihan.txt'); }
let LUPA = null;
function lupaForm(kode) { // validasi form Lupa Password; kode=true → wajib isi kode pemulihan
  const u = val('fu').trim(), k = val('fk').trim(), p = val('fp1');
  if (kode && k.replace(/[^A-Za-z0-9]/g, '').length < 12) { $('#lerr2').textContent = 'Kode pemulihan harus 12 karakter (XXXX-XXXX-XXXX)'; return null; }
  if (!p) { $('#lerr2').textContent = 'Isi password baru'; return null; }
  if (p.length < 6) { $('#lerr2').textContent = 'Password baru minimal 6 karakter'; return null; }
  if (p !== val('fp2')) { $('#lerr2').textContent = 'Konfirmasi password tidak sama'; return null; }
  $('#lerr2').textContent = ''; return { u, k, p };
}
function lupaOk(r, p) { // sukses: tampilkan kode pemulihan baru; tombol berikutnya langsung masuk dengan password baru
  LUPA = { u: r.username, p }; ['fk', 'fp1', 'fp2'].forEach(id => $('#' + id).value = '');
  showPanel(3); $('#nk').textContent = r.kode; toast('Password berhasil diatur ulang.');
}
function lupaMasuk() { if (!LUPA) return showPanel(1); $('#lu').value = LUPA.u; $('#lp').value = LUPA.p; LUPA = null; showPanel(1); doLogin(); }
function doLupa() {
  const f = lupaForm(true); if (!f) return; spin(1);
  gasAction('lupaPassword', { username: f.u, kode: f.k, baru: f.p }).then(d => { spin(-1); lupaOk(d, f.p); }, e => { spin(-1); $('#lerr2').textContent = e.message; });
}
function copyText(t) {
  const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('Tersalin'); } catch (e) { toast('Salin manual', 'warning'); } ta.remove();
}
function doLogin() {
  const u = val('lu').trim(), p = val('lp'), ingat = $('#lingat').checked; if (!u || !p) return $('#lerr').textContent = 'Username dan password wajib diisi';
  spin(1);
  gasAction('login', { username: u, password: p, ingat }).then(d => { spin(-1);
    store.del('tk'); store.set('tk', d.token, !!d.ingat); store.set('lu', u.toLowerCase(), true); store.set('ingat', d.ingat ? '1' : '0', true);
    $('#login').classList.add('d-none'); start();
  }, e => { spin(-1); $('#lerr').textContent = e.message; });
}
function doLogout() { // pastikan server sempat mencabut token (penting untuk 'Tetap masuk') sebelum halaman dimuat ulang
  const tk = store.get('tk'); store.del('tk');
  Promise.race([tk ? gasAction('logout', {}, tk, { keepalive: true }).catch(() => {}) : Promise.resolve(), new Promise(r => setTimeout(r, 2500))]).then(() => location.reload());
}
async function start() {
  try {
    const b = await call('boot'); U = b.user; CFG = b.cfg; CFG.today = b.today;
    if (U.wajib_ganti) return pwWajib();
    DOK = b.dokter || [];
    document.documentElement.dataset.role = U.peran; $('#brandName').textContent = CFG.nama_praktik || 'Klinik';
    $('#uName').textContent = U.nama; $('#uRole').textContent = U.peran;
    $('#menu').innerHTML = MENU.filter(m => m[3] === '*' || m[3].split(',').includes(U.peran))
      .map(m => `<li><a data-v="${m[0]}" onclick="nav('${m[0]}')"><i class="bi bi-${m[2]}"></i>${m[1]}${m[0] === 'apotek' ? '<span id="bd_apotek" class="badge bg-danger ms-auto d-none"></span>' : ''}${m[0] === 'kasir' ? '<span id="bd_kasir" class="badge bg-success ms-auto d-none"></span>' : ''}</a></li>`).join('');
    if (!started) { started = true; let day = new Date().toDateString();
      setInterval(() => { $('#clock').textContent = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }); if (new Date().toDateString() !== day) { day = new Date().toDateString(); hariBaru(); } }, 5000); }
    nav('beranda');
    if (b.perluKode && U.peran === 'Pemilik') setTimeout(() => kodeBuat(true).catch(() => {}), 700); // Pemilik belum punya kode pemulihan
    if (['Pemilik', AK, 'Dokter'].includes(U.peran) && !window._rt) { cekResep(); window._rt = setInterval(cekResep, 10000); }
  } catch (e) { if (!/Sesi berakhir/.test(e.message)) toast(e.message, 'danger'); }
}
async function hariBaru() {
  try { CFG.today = await call('hariIni', {}, true); toast('Hari baru: antrian direset otomatis', 'info'); if (!FORM_ID) nav(V); } catch (e) {}
}
let RESEP_N = null;
async function cekResep() { // lencana + notifikasi antar aplikasi (apotek: resep baru; dokter: resep direvisi apoteker)
  if (document.hidden || !store.get('tk')) return;
  try {
    const r = await call('notif', {}, true), b = $('#bd_apotek'), dok = U.peran === 'Dokter', n = dok ? r.revisi : r.n;
    if (b) { b.className = 'badge ms-auto ' + (dok ? 'bg-warning text-dark' : 'bg-danger') + (n ? '' : ' d-none'); b.textContent = n; }
    if (dok) {
      if (RESEP_N === null ? n > 0 : n > RESEP_N) {
        const x = (r.daftar || []).slice(-1)[0];
        toast((x ? (x.jenis === 'hapus' ? 'Permintaan hapus resep ' : 'Resep ') + x.nama_pasien + ' — ' + x.pesan : 'Ada pemberitahuan resep dari apotek') + (n > 1 ? ' (+' + (n - 1) + ' lainnya)' : ''), 'warning');
        if (V === 'apotek') VIEWS.apotek(); else if (V === 'beranda') VIEWS.beranda();
      }
    } else if (RESEP_N !== null && n > RESEP_N) { toast('Resep baru masuk dari dokter (' + n + ' menunggu)', 'info'); if (V === 'apotek' && ATAB === 'masuk') VIEWS.apotek(); }
    RESEP_N = n;
    const bk = $('#bd_kasir'); if (bk && !dok) { const nb = r.bayar || 0; bk.textContent = nb; bk.classList.toggle('d-none', !nb); }
  } catch (e) {}
}
async function notifBaca(id) { await guard(call('notifBaca', { id }), 'Ditandai sudah dibaca'); cekResep(); if (V === 'apotek') VIEWS.apotek(); }
function pwWajib() {
  $('#brandName').textContent = CFG.nama_praktik || 'Klinik'; $('#uName').textContent = U.nama; $('#uRole').textContent = U.peran; $('#menu').innerHTML = '';
  $('#view').innerHTML = `<div class="card p-4 mx-auto" style="max-width:430px"><h5><i class="bi bi-shield-lock"></i> Buat Password Baru</h5><div class="small text-muted">Demi keamanan, ganti password sementara Anda sebelum memakai aplikasi.</div>${pwField('w0', 'Password saat ini')}${pwField('w1', 'Password baru (min. 6 karakter)')}${pwField('w2', 'Ulangi password baru')}<div class="small text-muted mt-2"><i class="bi bi-info-circle"></i> Pemilik klinik dapat melihat password akun ini di menu Pengaturan.</div><button class="btn btn-brand mt-3" onclick="pwWajibSave()">Simpan &amp; Lanjutkan</button></div>`;
}
async function pwWajibSave() {
  if (val('w1') !== val('w2')) return toast('Konfirmasi password tidak sama', 'warning');
  await guard(call('gantiPassword', { lama: val('w0'), baru: val('w1') }), 'Password diganti'); start();
}
function pwForm() {
  modal('Ganti Password', pwField('pw0', 'Password lama') + pwField('pw1', 'Password baru (min. 6 karakter)') + pwField('pw2', 'Ulangi password baru') + '<div class="small text-muted mt-2"><i class="bi bi-info-circle"></i> Pemilik klinik dapat melihat password akun ini di menu Pengaturan.</div>',
    '<button class="btn btn-brand" onclick="pwSave()">Simpan</button>');
}
async function pwSave() {
  if (val('pw1') !== val('pw2')) return toast('Konfirmasi password tidak sama', 'warning');
  await guard(call('gantiPassword', { lama: val('pw0'), baru: val('pw1') }), 'Password diganti'); closeM();
}
function nav(v) {
  if (FORM_ID && DIRTY && !FORM_RO) autoSave(); // simpan dulu sebelum pindah halaman
  V = v; clearInterval(timer); clearTimeout(AS); FORM_ID = null; $('#view').oninput = null; $('#sidebar').classList.remove('show'); $('#shade').classList.remove('show');
  document.querySelectorAll('.menu a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  const f = VIEWS[v];
  if (!f) return;
  const go = () => f().catch(e => { toast(e.message, 'danger'); showErr(e, v); });
  go(); if (['beranda','antrian','periksa','apotek','kasir','stok','pbf'].includes(v)) timer = setInterval(() => { // refresh otomatis 15 dtk, senyap
    if (document.hidden || document.querySelector('.modal.show')) return;
    BG = true; try { f().catch(() => {}); } finally { BG = false; }
  }, v === 'beranda' ? 30000 : 10000);
}
/** Tampilkan galat langsung di halaman (toast hilang dalam 4 detik sehingga penyebabnya sulit terbaca). */
function showErr(e, v) {
  if (V !== v || BG) return;
  $('#view').innerHTML = `<div class="card p-4 mx-auto" style="max-width:640px"><h6 class="text-danger"><i class="bi bi-exclamation-triangle-fill"></i> Halaman tidak dapat dimuat</h6><div class="small mb-3" style="word-break:break-word">${esc(e && e.message || e)}</div><div><button class="btn btn-brand btn-sm" onclick="nav('${v}')"><i class="bi bi-arrow-clockwise"></i> Coba lagi</button></div></div>`;
}
const head = (t, btn) => `<div class="ph"><h5>${t}</h5><div>${btn || ''}</div></div>`;
const empty = (c, t) => `<tr><td colspan="${c}" class="text-center text-muted py-4">${t || 'Belum ada data'}</td></tr>`;

// ═══ VIEWS ═══
const VIEWS = {
  async beranda() {
    const d = await call('dash');
    const kpi = (l, v, i) => `<div class="col-6 col-lg-3"><div class="card kpi"><div class="v">${v}</div><div class="l"><i class="bi bi-${i}"></i> ${l}</div></div></div>`;
    const ins = [`${d.pasien} pasien terdaftar hari ini, ${d.menunggu} masih menunggu.`];
    if (d.menipis && d.menipis.length) ins.push('Stok menipis: ' + d.menipis.slice(0, 4).join(', ') + (d.menipis.length > 4 ? ' dll.' : '') + '. Pertimbangkan pembelian/opname.');
    if (d.resep) ins.push(`${d.resep} resep menunggu diproses apotek.`);
    if (d.bayar) ins.push(`${d.bayar} pasien siap membayar di kasir.`);
    if (d.revisi) ins.push(`${d.revisi} pemberitahuan dari apotek menunggu Anda (resep direvisi/dihapus atau permintaan persetujuan hapus). Buka menu Resep & Apotek.`);
    if (d.pbf && d.pbf.length) ins.push('Kontrak PBF segera berakhir: ' + d.pbf.map(p => p.nama + (p.sisa < 0 ? ' (sudah berakhir)' : ' (' + p.sisa + ' hari)')).join(', ') + '.');
    $('#view').innerHTML = head('Beranda — Ringkasan Hari Ini') + `<div class="row g-3 mb-3">${kpi('Pasien hari ini', d.pasien, 'people')}${kpi('Menunggu', d.menunggu, 'hourglass-split')}${kpi('Resep aktif', d.resep, 'capsule')}${d.kas !== null ? kpi('Kas masuk', rp(d.kas), 'cash-coin') : kpi('Selesai', d.selesai, 'check2-circle')}</div>
    <div class="row g-3"><div class="col-lg-8">${d.k7.length ? '<div class="card p-3"><h6>Kas masuk 7 hari</h6><canvas id="ch" height="110"></canvas></div>' : ''}</div>
    <div class="col-lg-4"><div class="insight"><h6><i class="bi bi-lightbulb"></i> Ringkasan Otomatis</h6><ul class="mb-0 ps-3">${ins.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div></div></div>`;
    if (d.k7.length) lib('chart', true).then(() => { if (chart) chart.destroy(); const dk = document.documentElement.dataset.theme === 'dark';
      chart = new Chart($('#ch'), { type: 'bar', data: { labels: d.k7.map(x => x.d), datasets: [{ data: d.k7.map(x => x.v), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() }] },
        options: { animation: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: dk ? '#ccc' : '#444' } }, y: { ticks: { color: dk ? '#ccc' : '#444' } } } } }); }).catch(() => {});
  },
  async antrian() {
    const l = await call('antrianHari'), reg = ['Pemilik', 'Pendaftaran'].includes(U.peran), isDok = ['Pemilik', 'Dokter'].includes(U.peran);
    $('#view').innerHTML = head('Pendaftaran & Antrian — ' + tgl(CFG.today || ''), reg ? '<button class="btn btn-brand" onclick="regModal()"><i class="bi bi-plus-lg"></i> Daftarkan Pasien</button>' : '') +
      `<div class="card"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>No</th><th>Pasien</th><th>Dokter</th><th>Jenis</th><th>Daftar</th><th>Status</th><th></th></tr></thead><tbody>${
      l.map(a => `<tr><td><b>${a.nomor}</b></td><td>${esc(a.nama_pasien)}<div class="small text-muted">${a.id_pasien} ${a.tanggal !== CFG.today ? '<span class="badge bg-warning text-dark">sisa ' + tgl(a.tanggal) + '</span>' : ''}</div></td><td>${esc(a.dokter || '-')}</td><td>${a.jenis}</td><td>${a.jam_daftar}</td><td>${badge(a.status)}</td><td class="text-end text-nowrap">${
        isDok && a.jenis === 'Konsultasi' && (U.peran !== 'Dokter' || a.dokter === U.nama) ? (a.status === 'Menunggu' ? `<button class="btn btn-sm btn-info text-white me-1" onclick="masukRuangan('${a.id}')"><i class="bi bi-door-open"></i> Masuk Ruangan</button>` : ['Masuk Ruangan', 'Diperiksa'].includes(a.status) ? `<button class="btn btn-sm btn-brand me-1" onclick="masukRuangan('${a.id}')"><i class="bi bi-clipboard2-pulse"></i> Lanjut Periksa</button>` : '') : ''}${
        reg && ['Menunggu', 'Masuk Ruangan'].includes(a.status) ? `<button class="btn btn-sm btn-outline-danger" onclick="batalAntrian('${a.id}')">Batal</button>` : ''}</td></tr>`).join('') || empty(7, 'Belum ada antrian hari ini')}</tbody></table></div></div>`;
  },
  async periksa() {
    if (PTAB === 'riwayat') { if (BG) return; return vRiwayat(); } // tab riwayat tidak di-refresh otomatis
    const l = (await call('antrianHari')).filter(a => a.jenis === 'Konsultasi' && (U.peran !== 'Dokter' || a.dokter === U.nama));
    $('#view').innerHTML = head('Pemeriksaan') + ptabs() + `<div class="card"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>No</th><th>Pasien</th><th>Dokter</th><th>Status</th><th></th></tr></thead><tbody>${
      l.map(a => `<tr><td><b>${a.nomor}</b>${a.tanggal !== CFG.today ? `<div class="small text-warning">${tgl(a.tanggal)}</div>` : ''}</td><td>${esc(a.nama_pasien)}</td><td>${esc(a.dokter)}</td><td>${badge(a.status)}</td><td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-dark me-1" onclick="riwayat('${a.id_pasien}')"><i class="bi bi-clock-history"></i> Riwayat</button>${
        a.status === 'Menunggu' ? `<button class="btn btn-sm btn-info text-white" onclick="masukRuangan('${a.id}')"><i class="bi bi-door-open"></i> Masuk Ruangan</button>` : ''}${
        ['Masuk Ruangan', 'Diperiksa', 'Selesai'].includes(a.status) ? `<button class="btn btn-sm btn-brand" onclick="formPeriksa('${a.id}')"><i class="bi bi-clipboard2-pulse"></i> ${a.status === 'Selesai' ? 'Lihat' : 'Periksa'}</button>` : ''}</td></tr>`).join('') || empty(5, 'Tidak ada pasien')}</tbody></table></div></div>`;
  },
  async apotek() {
    if (ATAB !== 'masuk' && ['Pemilik', AK].includes(U.peran)) { if (BG) return; return ATAB === 'riwayat' ? vResepRiwayat() : vPenjualan(); }
    const st = val('fSt') || 'Aktif'; const all = await call('resepMasuk', {}), l = all.filter(r => st === 'Semua' || (st === 'Aktif' ? ['Dibuat', 'Diproses'].includes(r.status) : r.status === st));
    RS = l; const ap = ['Pemilik', AK].includes(U.peran);
    const unread = U.peran === 'Dokter' ? all.filter(r => r.notif_dokter === 'Ya' && r.hapus_minta !== 'Ya') : [], mintaHapus = U.peran === 'Dokter' ? all.filter(r => r.hapus_minta === 'Ya' && r.status === 'Diserahkan') : [];
    const bannerHapus = mintaHapus.length ? `<div class="alert alert-danger"><div class="fw-semibold mb-2"><i class="bi bi-shield-exclamation"></i> ${mintaHapus.length} permintaan hapus resep menunggu persetujuan Anda</div>${mintaHapus.map(r => `<div class="border rounded bg-body text-body p-2 mb-2"><div class="small"><b>${esc(r.nama_pasien)}</b> · ${tgl(r.tanggal)} · ${r.items.map(i => esc(i.nama) + ' ×' + i.jumlah).join(', ')}<br>Diminta oleh <b>${esc(r.hapus_minta_oleh)}</b>: ${esc(r.hapus_minta_alasan)}</div><div class="mt-2 d-flex gap-2"><button class="btn btn-sm btn-danger" onclick="hapusSetuju('${r.id}')"><i class="bi bi-check2"></i> Setujui hapus</button><button class="btn btn-sm btn-outline-secondary" onclick="hapusTolakForm('${r.id}')">Tolak</button></div></div>`).join('')}</div>` : '';
    const banner = unread.length ? `<div class="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2"><div><i class="bi bi-bell-fill"></i> <b>${unread.length} pemberitahuan dari apotek.</b>${unread.map(r => `<div class="small">${esc(r.nama_pasien)} — ${esc(r.notif_pesan || r.revisi || '')}</div>`).join('')}</div><button class="btn btn-sm btn-dark" onclick="notifBaca('semua')"><i class="bi bi-check2-all"></i> Tandai semua sudah dibaca</button></div>` : '';
    $('#view').innerHTML = head('Resep Masuk', `<div class="d-flex gap-2"><button class="btn btn-sm btn-outline-secondary" title="Muat ulang" onclick="VIEWS.apotek()"><i class="bi bi-arrow-clockwise"></i></button><select id="fSt" style="width:auto" class="form-select form-select-sm" onchange="VIEWS.apotek()">${['Aktif', 'Diserahkan', 'Dibatalkan', 'Semua'].map(s => `<option ${s === st ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`) +
      `${bannerHapus}${banner}${atabs()}<div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Resep_Apotek" class="table table-hover mb-0"><thead><tr><th>Tanggal</th><th>Pasien</th><th>Dokter</th><th>Item</th><th>Status</th><th class="noexp"></th></tr></thead><tbody>${
      l.map(r => `<tr class="${r.notif_dokter === 'Ya' ? 'table-warning' : ''}"><td>${tgl(r.tanggal)}</td><td>${esc(r.nama_pasien)}</td><td>${esc(r.dokter)}</td><td>${r.items.map(i => `<div>${esc(i.nama)} <b>×${i.jumlah}</b> <span class="text-muted small">${esc(i.aturan)}</span>${['Dibuat', 'Diproses'].includes(r.status) && i.id_obat && Number(i.stok) < Number(i.jumlah) ? ` <span class="badge bg-danger">stok ${Number(i.stok) <= 0 ? 'habis' : 'kurang (sisa ' + i.stok + ')'}</span>` : ''}${i.nama_asli && i.nama_asli !== i.nama ? `<div class="small text-muted">pengganti dari: ${esc(i.nama_asli)}</div>` : ''}</div>`).join('')}${r.revisi ? `<div class="small text-warning-emphasis mt-1"><i class="bi bi-pencil-square"></i> Revisi: ${esc(r.revisi)}</div>` : ''}</td><td>${badge(r.status)}${r.notif_dokter === 'Ya' ? '<div><span class="badge bg-warning text-dark"><i class="bi bi-bell-fill"></i> Direvisi</span></div>' : ''}</td><td class="text-end text-nowrap">${ap ? (
        r.status === 'Dibuat' ? `<button class="btn btn-sm btn-info text-white" onclick="resepAksi('${r.id}','Diproses')">Proses</button> ` : '') + (
        ['Dibuat', 'Diproses'].includes(r.status) ? `<button class="btn btn-sm btn-warning" onclick="revisiForm('${r.id}')"><i class="bi bi-arrow-repeat"></i> Revisi</button> <button class="btn btn-sm btn-success" onclick="resepAksi('${r.id}','Diserahkan')">Serahkan</button> ` : '') + (
        ['Dibuat', 'Diproses', 'Diserahkan'].includes(r.status) ? `<button class="btn btn-sm btn-outline-danger" onclick="resepBatal('${r.id}')">Batal</button>` : '') : (r.hapus_minta === 'Ya' && r.status === 'Diserahkan' ? `<button class="btn btn-sm btn-danger" onclick="hapusSetuju('${r.id}')">Setujui hapus</button> <button class="btn btn-sm btn-outline-secondary" onclick="hapusTolakForm('${r.id}')">Tolak</button>` : r.notif_dokter === 'Ya' ? `<button class="btn btn-sm btn-dark" onclick="notifBaca('${r.id}')"><i class="bi bi-check2"></i> Tandai dibaca</button>` : '')}</td></tr>`).join('') || empty(6, st === 'Aktif' ? 'Tidak ada resep yang menunggu. Resep dari dokter muncul otomatis setelah pemeriksaan diselesaikan.' : 'Belum ada data')}</tbody></table></div></div>`;
  },
  async stok() {
    OBAT = await call('obatList');
    $('#view').innerHTML = head('Stok & Master Obat', '<button class="btn btn-success me-1" onclick="pembelianForm()"><i class="bi bi-cart-plus"></i> Pembelian Obat</button><button class="btn btn-brand" onclick="obatForm()"><i class="bi bi-plus-lg"></i> Obat Baru</button>') +
      `<div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Stok_Obat" class="table table-hover mb-0"><thead><tr><th>Kode</th><th>Nama</th><th>Kategori</th><th>Stok</th><th>Min</th><th>Harga Beli</th><th>Harga Jual</th><th class="noexp"></th></tr></thead><tbody>${
      OBAT.map(o => `<tr><td>${o.kode}</td><td>${esc(o.nama)} ${o.aktif === 'Tidak' ? '<span class="badge bg-secondary">Nonaktif</span>' : ''}</td><td>${esc(o.kategori)}</td><td><b class="${o.stok <= o.stok_min ? 'text-danger' : ''}">${o.stok}</b> ${esc(o.satuan)} ${o.stok <= o.stok_min ? '<span class="badge bg-danger">Menipis</span>' : ''}</td><td>${o.stok_min}</td><td>${rp(o.harga_beli)}</td><td>${rp(o.harga_jual)}</td><td class="text-nowrap"><button class="ib ed" title="Ubah" onclick="obatForm('${o.id}')"><i class="bi bi-pencil-square"></i></button><button class="ib" style="color:#f59f00" title="Koreksi stok (opname)" onclick="opnameForm('${o.id}')"><i class="bi bi-clipboard-check"></i></button></td></tr>`).join('') || empty(8)}</tbody></table></div></div>`;
  },
  async kasir() {
    const l = await call('kasirAntrian');
    $('#view').innerHTML = head('Kasir — Menunggu Pembayaran') + `<div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Kasir" class="table table-hover mb-0"><thead><tr><th>No</th><th>Pasien</th><th>Jenis</th><th>Resep</th><th class="noexp"></th></tr></thead><tbody>${
      l.map(a => `<tr><td><b>${a.nomor}</b></td><td>${esc(a.nama_pasien)}</td><td>${a.jenis}</td><td>${a.resep === '-' ? (a.jenis === 'Beli Obat' ? '<span class="badge bg-info text-dark">Beli obat</span>' : '-') : badge(a.resep)}</td><td class="text-end">${a.siap ? `<button class="btn btn-sm btn-brand" onclick="bayarForm('${a.id}')"><i class="bi bi-cash"></i> Bayar</button>` : `<span class="small text-muted me-2">Menunggu obat diserahkan</span><button class="btn btn-sm btn-outline-secondary" onclick="nav('apotek')"><i class="bi bi-capsule"></i> Ke Apotek</button>`}</td></tr>`).join('') || empty(5, 'Tidak ada tagihan')}</tbody></table></div></div>`;
  },
  async laporan() {
    const dr = val('lDr') || CFG.today, sp = val('lSp') || CFG.today, r = await call('kasLaporan', { dari: dr, sampai: sp });
    $('#view').innerHTML = head('Laporan Kas Masuk') + `<div class="card p-3 mb-3"><div class="row g-2 align-items-end"><div class="col-6 col-md-3"><label class="small">Dari</label><input type="date" id="lDr" class="form-control" value="${dr}"></div><div class="col-6 col-md-3"><label class="small">Sampai</label><input type="date" id="lSp" class="form-control" value="${sp}"></div><div class="col-md-2"><button class="btn btn-brand w-100" onclick="VIEWS.laporan()">Tampilkan</button></div><div class="col-md-4 text-md-end"><div class="small text-muted">Total kas masuk</div><h4 class="mb-0">${rp(r.total)}</h4></div></div>
      <div class="small mt-2">${Object.entries(r.kat).map(([k, v]) => `<span class="badge bg-secondary me-1">${k}: ${rp(v)}</span>`).join('')} ${Object.entries(r.met).map(([k, v]) => `<span class="badge bg-info text-dark me-1">${k}: ${rp(v)}</span>`).join('')}</div></div>
      <div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Laporan_Kas" class="table table-hover mb-0"><thead><tr><th>Tanggal</th><th>Pasien</th><th>Metode</th><th>Kasir</th><th class="text-end">Total</th></tr></thead><tbody>${r.rows.map(x => `<tr><td>${tgl(x.tanggal)}</td><td>${esc(x.nama)}</td><td>${x.metode}</td><td>${esc(x.kasir)}</td><td class="text-end">${rp(x.total)}</td></tr>`).join('') || empty(5)}</tbody></table></div></div>`;
  },
  async pbf() {
    if (BTAB === 'beli') return vPembelian();
    const l = await call('pbfList'); PBFL = l; const aktif = l.filter(p => p.status === 'Aktif'), segera = aktif.filter(p => p.sisa_hari !== null && p.sisa_hari <= 30);
    const kpi = (t, v, i) => `<div class="col-6 col-lg-3"><div class="card kpi"><div class="v">${v}</div><div class="l"><i class="bi bi-${i}"></i> ${t}</div></div></div>`;
    const masa = p => `${p.mulai ? tgl(p.mulai) : '-'} – ${p.berakhir ? tgl(p.berakhir) : 'tanpa batas'}` + (p.berakhir && p.status === 'Aktif' ? (p.sisa_hari < 0 ? ' <span class="badge bg-danger">Berakhir</span>' : p.sisa_hari <= 30 ? ` <span class="badge bg-warning text-dark">${p.sisa_hari} hari lagi</span>` : '') : '');
    $('#view').innerHTML = head('Kerja Sama PBF', '<button class="btn btn-brand" onclick="pbfForm()"><i class="bi bi-plus-lg"></i> Rekanan Baru</button>') + btabs() +
      `<div class="card p-3 mb-3"><h6><i class="bi bi-info-circle"></i> Informasi Kerja Sama dengan PBF (Pedagang Besar Farmasi)</h6><div class="row g-3 small"><div class="col-md-4"><b>Alur pengadaan obat</b><ol class="mb-0 ps-3"><li>Pilih rekanan PBF aktif dan cek termin serta diskonnya.</li><li>Kirim permintaan pesanan lewat WhatsApp (ikon hijau). Daftar obat yang stoknya menipis terisi otomatis.</li><li>Saat barang datang, catat di <a href="#" onclick="BTAB='beli';VIEWS.pbf();return false">Pembelian dari PBF</a>: stok bertambah otomatis dan total pembelian rekanan terhitung di sini.</li></ol></div><div class="col-md-4"><b>Hal yang perlu dicek</b><ul class="mb-0 ps-3"><li>Pastikan PBF memiliki izin resmi dan catat nomor izinnya.</li><li>Cocokkan faktur dengan barang: nama, jumlah, nomor batch, dan tanggal kedaluwarsa.</li><li>Obat tertentu (misalnya psikotropika atau narkotika) wajib dipesan dengan surat pesanan khusus sesuai peraturan yang berlaku.</li></ul></div><div class="col-md-4"><b>Pengingat otomatis</b><ul class="mb-0 ps-3"><li>Kontrak yang berakhir kurang dari 30 hari ditandai kuning dan muncul di Beranda.</li><li>Nama rekanan aktif tersedia sebagai pilihan supplier di form Pembelian dari PBF.</li><li>Total pembelian dihitung dari riwayat Pembelian dari PBF dengan nama supplier yang sama.</li></ul></div></div></div>
      <div class="row g-3 mb-3">${kpi('Rekanan aktif', aktif.length, 'truck')}${kpi('Total rekanan', l.length, 'building')}${kpi('Kontrak segera berakhir', segera.length, 'hourglass-split')}${kpi('Total pembelian', rp(l.reduce((s, p) => s + p.total_beli, 0)), 'cart-check')}</div>
      <div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Rekanan_PBF" class="table table-hover mb-0"><thead><tr><th>Nama PBF</th><th>PIC</th><th>Kontak</th><th>Termin</th><th>Diskon</th><th>Masa Kerja Sama</th><th>Status</th><th>Total Pembelian</th><th class="noexp"></th></tr></thead><tbody>${
      l.map(p => `<tr><td><b>${esc(p.nama)}</b><div class="small text-muted">${esc(p.produk)}</div></td><td>${esc(p.pic)}</td><td>${esc(p.telp)}${p.wa ? '<br>WA ' + esc(p.wa) : ''}${p.email ? '<br>' + esc(p.email) : ''}</td><td>${esc(p.termin)}</td><td>${esc(p.diskon)}</td><td>${masa(p)}</td><td><span class="badge bg-${p.status === 'Aktif' ? 'success' : p.status === 'Prospek' ? 'info' : 'secondary'}">${esc(p.status)}</span></td><td>${rp(p.total_beli)}<div class="small text-muted">${p.jml_faktur} faktur</div></td><td class="text-nowrap text-end"><button class="ib ed" title="Detail" onclick="pbfDetail('${p.id}')"><i class="bi bi-eye-fill"></i></button><button class="ib" style="color:#25d366" title="Kirim permintaan pesanan" onclick="pbfPesan('${p.id}')"><i class="bi bi-whatsapp"></i></button><button class="ib ed" title="Ubah" onclick="pbfForm('${p.id}')"><i class="bi bi-pencil-square"></i></button>${U.peran === 'Pemilik' ? `<button class="ib dl" title="Hapus" onclick="pbfHapusKonfirm('${p.id}')"><i class="bi bi-trash3-fill"></i></button>` : ''}</td></tr>`).join('') || empty(9, 'Belum ada rekanan PBF. Klik "Rekanan Baru" untuk menambahkan.')}</tbody></table></div></div>`;
  },
  async pengaturan() {
    const pd = await call('pengaturanData'), pg = pd.pengguna, tf = pd.tarif, dk = pd.dokter, bk = pd.backup; PG = pg; DKL = dk;
    $('#view').innerHTML = head('Pengaturan') + `<div class="row g-3"><div class="col-lg-7"><div class="card p-3"><div class="d-flex justify-content-between"><h6>Pengguna</h6><button class="btn btn-sm btn-brand" onclick='penggunaForm()'>+ Tambah</button></div>
      <table class="table table-sm"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Password</th><th>Aktif</th><th></th></tr></thead><tbody>${pg.map(p => `<tr><td>${esc(p.nama)}</td><td>${esc(p.username)}</td><td>${p.peran}</td><td>${pwCell(p)}</td><td>${p.aktif}</td><td class="text-nowrap"><button class="ib ed" title="Ubah" onclick='penggunaForm(${JSON.stringify({ ...p, pwt: undefined }).replace(/'/g, "&#39;")})'><i class="bi bi-pencil-square"></i></button> ${p.username === U.username ? '' : `<button class="ib" style="color:#f59f00" title="Reset password" onclick="resetKonfirm('${p.id}')"><i class="bi bi-key-fill"></i></button><button class="ib dl" title="Hapus" onclick="hapusKonfirm('pengguna','${p.id}')"><i class="bi bi-trash3-fill"></i></button>`}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="col-lg-5"><div class="card p-3 mb-3"><h6>Data Praktik</h6>${['nama_praktik', 'alamat', 'metode_bayar'].map(k => `<label class="small mt-2">${k.replace('_', ' ')}</label><input class="form-control" id="cfg_${k}" value="${esc(CFG[k])}">`).join('')}<button class="btn btn-brand mt-3" onclick="cfgSave()">Simpan</button></div>
      <div class="card p-3"><h6>Tarif</h6>${tf.map(t => `<div class="d-flex gap-2 mb-2"><input class="form-control" id="tn_${t.id}" value="${esc(t.nama)}"><input type="number" class="form-control" id="th_${t.id}" value="${t.harga}"><button class="btn btn-outline-success" onclick="tarifSave('${t.id}')"><i class="bi bi-check2"></i></button></div>`).join('')}</div>
      <div class="card p-3 mt-3"><h6><i class="bi bi-wrench-adjustable"></i> Pemeliharaan Data</h6><div class="small text-muted mb-2">Memeriksa seluruh sheet database, membuat sheet yang hilang, dan menambah kolom baru tanpa menghapus data. Jalankan jika ada data yang tidak muncul setelah pembaruan aplikasi.</div><button class="btn btn-sm btn-outline-secondary" onclick="diagnosa()">Periksa &amp; Perbaiki Struktur Data</button></div>
      <div class="card p-3 mt-3"><h6><i class="bi bi-cloud-arrow-up"></i> Backup Data</h6><div class="small text-muted mb-2">Salinan seluruh database ke Google Drive (folder "Backup Praktek Dokter", 30 salinan terakhir).<br>Terakhir: <b>${bk.terakhir ? esc(bk.terakhir) : 'belum pernah'}</b> · Backup otomatis harian 23.00: <b>${bk.aktif ? 'Aktif' : 'Nonaktif'}</b>${bk.err ? '<br><span class="text-danger">Izin Drive/trigger belum diberikan. Deploy ulang lalu setujui izin baru.</span>' : ''}</div><div class="d-flex flex-wrap gap-2"><button class="btn btn-sm btn-dark" onclick="backupNow()">Backup ke Drive sekarang</button><button class="btn btn-sm btn-outline-secondary" onclick="backupToggle(${!bk.aktif})">${bk.aktif ? 'Matikan' : 'Aktifkan'} backup harian</button><button class="btn btn-sm btn-outline-success" onclick="backupModal()">Unduh backup (Excel/JSON/PDF)</button></div></div>
      <div class="card p-3 mt-3"><h6><i class="bi bi-shield-lock"></i> Keamanan Akun</h6><div class="small text-muted mb-2">Kode pemulihan: ${pd.kode && pd.kode.ada ? '<b class="text-success">aktif</b>' + (pd.kode.dibuat ? ' (dibuat ' + tgl(pd.kode.dibuat) + ')' : '') : '<b class="text-danger">belum dibuat</b>'}. Dipakai Pemilik yang lupa password (halaman masuk → Lupa password?); setelah dipakai, kode baru dibuat otomatis. Staf yang lupa: gunakan ikon kunci kuning di daftar Pengguna. Mengganti password otomatis mengeluarkan perangkat lain yang memakai “Tetap masuk”.</div><button class="btn btn-sm btn-outline-secondary me-1" onclick="kodeLihat()"><i class="bi bi-eye"></i> Lihat Kode Saat Ini</button><button class="btn btn-sm btn-outline-secondary" onclick="kodeBuat()">Buat Kode Baru</button></div>
      <div class="card p-3 mt-3"><div class="d-flex justify-content-between"><h6>Daftar Dokter</h6><button class="btn btn-sm btn-brand" onclick="dokterForm()">+ Tambah</button></div>${dk.map(d => `<div class="d-flex justify-content-between align-items-center border-bottom py-1"><span>${esc(d.nama)} <small class="text-muted">${esc(d.sip)}</small> ${d.aktif === 'Tidak' ? '<span class="badge bg-secondary">Nonaktif</span>' : ''}</span><span class="text-nowrap"><button class="ib ed" title="Ubah" onclick='dokterForm(${JSON.stringify(d).replace(/'/g, "&#39;")})'><i class="bi bi-pencil-square"></i></button> <button class="ib dl" title="Hapus" onclick="hapusKonfirm('dokter','${d.id}')"><i class="bi bi-trash3-fill"></i></button></span></div>`).join('') || '<div class="text-muted small">Belum ada dokter</div>'}<div class="form-text mt-2">Akun login dokter harus memakai <b>Nama</b> yang sama persis dengan nama di daftar ini.</div></div></div></div>`;
  }
};

// ═══ AKSI ═══
async function masukRuangan(id) {
  const a = (await call('antrianHari')).find(x => x.id === id);
  if (a && a.status === 'Menunggu') await guard(call('antrianStatus', { id, status: 'Masuk Ruangan' }), 'Pasien masuk ruangan');
  V = 'periksa'; document.querySelectorAll('.menu a').forEach(m => m.classList.toggle('on', m.dataset.v === 'periksa'));
  await formPeriksa(id).catch(e => toast(e.message, 'danger'));
}
async function setStatus(id, status, alasan) { await guard(call('antrianStatus', { id, status, alasan }), 'Status diperbarui'); VIEWS[V](); }
function batalAntrian(id) { modal('Batalkan antrian', '<label>Alasan pembatalan</label><input id="alasan" class="form-control">', `<button class="btn btn-danger" onclick="doBatal('${id}')">Batalkan</button>`); }
async function doBatal(id) { const a = val('alasan'); await setStatus(id, 'Batal', a); closeM(); }

// pendaftaran
async function regModal() {
  PICK = null;
  modal('Daftarkan Pasien', `<div class="input-group mb-2"><input id="cq" class="form-control" placeholder="Cari nama / No. RM / telepon" oninput="cariPasien()"><button class="btn btn-outline-secondary" onclick="pasienForm()">Pasien Baru</button></div><div id="cres" class="list-group mb-3"></div><div id="cpick" class="alert alert-info d-none"></div>
    <div class="row g-2"><div class="col-md-6"><label class="small">Jenis kunjungan</label><select id="cj" class="form-select" onchange="$('#cd').disabled=this.value!=='Konsultasi'"><option>Konsultasi</option><option>Beli Obat</option></select></div><div class="col-md-6"><label class="small">Dokter</label><select id="cd" class="form-select">${DOK.length ? '' : '<option value="">(Belum ada dokter — tambah di Pengaturan)</option>'}${DOK.map(d => `<option>${esc(d)}</option>`).join('')}</select></div></div>`,
    '<button class="btn btn-brand" onclick="regSave()">Daftarkan</button>');
}
let cT; function cariPasien() { clearTimeout(cT); cT = setTimeout(async () => { const r = await call('pasienCari', { q: val('cq') }).catch(() => []);
  $('#cres').innerHTML = r.map(p => `<a class="list-group-item list-group-item-action" onclick='pickPasien(${JSON.stringify(p).replace(/'/g, "&#39;")})'>${esc(p.nama)} <small class="text-muted">${p.id} · ${esc(p.telp)}</small></a>`).join(''); }, 350); }
function pickPasien(p) { PICK = p; $('#cres').innerHTML = ''; $('#cpick').classList.remove('d-none'); $('#cpick').innerHTML = `<button class="btn btn-sm btn-outline-secondary float-end" onclick="pasienForm(PICK)"><i class="bi bi-pencil"></i> Ubah data</button><b>${esc(p.nama)}</b> (${p.id})` + (p.alergi ? `<br><span class="text-danger">Alergi: ${esc(p.alergi)}</span>` : ''); }
function pasienForm(p) {
  p = p || {}; const f = (id, l, k, t = 'text') => `<div class="col-md-6"><label class="small">${l}</label><input type="${t}" id="${id}" class="form-control" value="${esc(p[k])}"></div>`;
  modal(p.id ? 'Ubah Data Pasien' : 'Pasien Baru', `<div class="row g-2">${f('pn', 'Nama lengkap *', 'nama')}${f('pk', 'NIK (opsional)', 'nik')}<div class="col-md-6"><label class="small">Jenis kelamin *</label><select id="pj" class="form-select"><option value="L">Laki-laki</option><option value="P" ${p.jk === 'P' ? 'selected' : ''}>Perempuan</option></select></div>${f('pt', 'Tanggal lahir *', 'tgl_lahir', 'date')}${f('ptl', 'No. telepon *', 'telp', 'tel')}${f('pa', 'Alergi', 'alergi')}<div class="col-12"><label class="small">Alamat</label><textarea id="pal" class="form-control" rows="2">${esc(p.alamat)}</textarea></div></div>`,
    `<button class="btn btn-brand" onclick="pasienSave('${p.id || ''}')">Simpan</button>`);
}
async function pasienSave(id) { const p = await guard(call('pasienSimpan', { id: id || undefined, nama: val('pn'), nik: val('pk'), jk: val('pj'), tgl_lahir: val('pt'), telp: val('ptl'), alergi: val('pa'), alamat: val('pal') }), 'Pasien tersimpan'); await regModal(); pickPasien(p); }
async function regSave() {
  if (!PICK) return toast('Pilih pasien terlebih dahulu', 'warning');
  const r = await guard(call('antrianBuat', { id_pasien: PICK.id, jenis: val('cj'), dokter: val('cj') === 'Konsultasi' ? val('cd') : '' }));
  closeM(); toast('Nomor antrian: ' + r.nomor + (r.jenis === 'Beli Obat' ? ' — lanjut ke Kasir untuk memilih obat' : ''), 'success'); VIEWS.antrian();
}

// riwayat rekam medik
async function riwayat(idPasien) { rekamModal(await guard(call('riwayatPasien', { id_pasien: idPasien }))); }
async function lihatKunjungan(id) { rekamModal(await guard(call('kunjunganDetail', { id }))); }
async function pdfKunjungan(id) { RW = await guard(call('kunjunganDetail', { id })); pdfRw(); }
function rekamModal(d) {
  RW = d; const p = d.pasien;
  const f = (l, v) => v ? `<div class="mb-1"><span class="text-muted small">${l}</span><div>${esc(v).replace(/\n/g, '<br>')}</div></div>` : '';
  modal((d.kunjungan.length === 1 ? 'Rekam Medik — ' : 'Riwayat Rekam Medik — ') + p.nama, `<div class="small mb-3">${p.id} · ${p.jk === 'L' ? 'Laki-laki' : 'Perempuan'} · lahir ${tgl(p.tgl_lahir)}<br><b class="text-danger">Alergi: ${esc(p.alergi || 'tidak ada tercatat')}</b></div>` +
    (d.kunjungan.map(k => `<div class="border rounded p-3 mb-3"><div class="d-flex justify-content-between mb-2"><b><i class="bi bi-calendar-event"></i> ${tgl(k.tanggal)}</b><span class="small text-muted">${esc(k.dokter)}</span></div>${f('Keluhan', k.keluhan)}${f('Anamnesis', k.anamnesis)}${f('Pemeriksaan', k.pemeriksaan)}${f('Diagnosis', k.diagnosis)}${f('Tindakan', k.tindakan)}${f('Catatan', k.catatan)}${k.resep.length ? `<div class="small text-muted">Resep</div><ul class="mb-0">${k.resep.map(i => `<li>${esc(i.nama)} ×${i.jumlah} <span class="text-muted">${esc(i.aturan)}</span></li>`).join('')}</ul>` : ''}</div>`).join('') ||
    '<div class="text-muted text-center py-4">Belum ada riwayat kunjungan sebelumnya</div>'),
    `<button class="btn btn-danger" onclick="pdfRw()"><i class="bi bi-file-earmark-pdf"></i> Simpan PDF</button><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>`, 'modal-lg modal-dialog-scrollable');
}
function pdfRw() {
  if (!RW) return; const p = RW.pasien, one = RW.kunjungan.length === 1;
  pdfRekam([{ pasien: p, kunjungan: RW.kunjungan }], 'RekamMedik_' + String(p.nama).replace(/[^A-Za-z0-9]+/g, '_') + '_' + (one ? RW.kunjungan[0].tanggal : 'lengkap') + '.pdf');
}
/** PDF rekam medik: satu halaman-seri per pasien, berisi seluruh kunjungan yang diberikan. */
async function pdfRekam(items, fn) {
  try { await lib('pdf'); } catch (e) { return toast(e.message, 'danger'); }
  const doc = new jspdf.jsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 15, maxW = W - 2 * M; let y = 0;
  const head = () => { doc.setFillColor(11, 134, 214); doc.rect(0, 0, W, 14, 'F'); doc.setTextColor(255); doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text(CFG.nama_praktik || '', M, 9);
    doc.setFont(undefined, 'normal'); doc.setFontSize(8); doc.text('REKAM MEDIK - RAHASIA', W - M, 9, { align: 'right' }); doc.setTextColor(0); y = 22; };
  const need = h => { if (y + h > 280) { doc.addPage(); head(); } };
  const line = (label, text) => { if (!text) return; doc.setFontSize(8); doc.setTextColor(110); need(10); doc.text(label, M, y); y += 4; doc.setTextColor(0); doc.setFontSize(10);
    doc.splitTextToSize(String(text), maxW).forEach(r => { need(6); doc.text(r, M, y); y += 4.6; }); y += 1.5; };
  head();
  items.forEach((it, n) => {
    if (n) { doc.addPage(); head(); }
    const p = it.pasien; doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text(String(p.nama), M, y); doc.setFont(undefined, 'normal'); y += 6; doc.setFontSize(9);
    doc.text(`No. RM ${p.id}  |  ${p.jk === 'L' ? 'Laki-laki' : 'Perempuan'}  |  Lahir ${tgl(p.tgl_lahir)}  |  Telp ${p.telp || '-'}`, M, y); y += 5;
    if (p.alergi) { doc.setTextColor(200, 30, 30); doc.text('Alergi: ' + p.alergi, M, y); doc.setTextColor(0); y += 5; }
    doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 6;
    it.kunjungan.forEach(k => {
      need(34); doc.setFillColor(232, 243, 252); doc.rect(M, y - 4.5, maxW, 7, 'F'); doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.text(`${tgl(k.tanggal)}  -  ${k.dokter || ''}`, M + 2, y); doc.setFont(undefined, 'normal'); y += 8;
      line('Keluhan', k.keluhan); line('Anamnesis', k.anamnesis); line('Pemeriksaan', k.pemeriksaan); line('Diagnosis', k.diagnosis); line('Tindakan', k.tindakan); line('Catatan', k.catatan);
      if (k.resep && k.resep.length) line('Resep', k.resep.map(r => `- ${r.nama} x${r.jumlah}${r.aturan ? ' (' + r.aturan + ')' : ''}`).join('\n'));
      y += 3;
    });
  });
  const pg = doc.getNumberOfPages(); for (let i = 1; i <= pg; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Dicetak ${new Date().toLocaleString('id-ID')} oleh ${U.nama}  |  Halaman ${i}/${pg}`, W / 2, 290, { align: 'center' }); }
  doc.save(fn); toast('PDF tersimpan');
}

// ═══ HISTORY PEMERIKSAAN & BACKUP ═══
const ptabs = () => `<ul class="nav nav-tabs mb-3"><li class="nav-item"><a class="nav-link ${PTAB === 'antrian' ? 'active' : ''}" role="button" onclick="setPTab('antrian')"><i class="bi bi-people"></i> Antrian Saya</a></li><li class="nav-item"><a class="nav-link ${PTAB === 'riwayat' ? 'active' : ''}" role="button" onclick="setPTab('riwayat')"><i class="bi bi-clock-history"></i> Riwayat Pemeriksaan</a></li></ul>`;
function setPTab(t) { PTAB = t; VIEWS.periksa().catch(e => toast(e.message, 'danger')); }
async function vRiwayat() {
  if ($('#rh_dr')) RH = { dr: val('rh_dr'), sp: val('rh_sp'), q: val('rh_q'), dh: !!($('#rh_dh') && $('#rh_dh').checked) };
  if (!RH) RH = { dr: new Date(Date.now() - 30 * 864e5).toLocaleDateString('en-CA'), sp: CFG.today, q: '', dh: false };
  const l = await call('riwayatList', { dari: RH.dr, sampai: RH.sp, q: RH.q, dihapus: RH.dh }); RHL = l;
  const cb = U.peran === 'Pemilik' ? `<div class="form-check"><input class="form-check-input" type="checkbox" id="rh_dh" ${RH.dh ? 'checked' : ''} onchange="vRiwayat()"><label class="form-check-label small" for="rh_dh">Tampilkan data terhapus</label></div>` : '';
  $('#view').innerHTML = head('Pemeriksaan') + ptabs() + `<div class="card p-3 mb-3"><div class="row g-2 align-items-end"><div class="col-6 col-md-2"><label class="small">Dari</label><input type="date" id="rh_dr" class="form-control" value="${RH.dr}"></div><div class="col-6 col-md-2"><label class="small">Sampai</label><input type="date" id="rh_sp" class="form-control" value="${RH.sp}"></div><div class="col-md-4"><label class="small">Cari pasien / No. RM / diagnosis</label><input id="rh_q" class="form-control" value="${esc(RH.q)}" onkeydown="if(event.key==='Enter')vRiwayat()"></div><div class="col-6 col-md-2"><button class="btn btn-brand w-100" onclick="vRiwayat()"><i class="bi bi-search"></i> Tampilkan</button></div><div class="col-6 col-md-2"><button class="btn btn-success w-100" onclick="backupModal()"><i class="bi bi-cloud-arrow-down"></i> Backup Data</button></div></div><div class="small text-muted mt-2 d-flex justify-content-between flex-wrap gap-2"><span>${l.length} pemeriksaan ${RH.dh ? 'terhapus' : 'selesai'}${U.peran === 'Dokter' ? ' (pasien Anda)' : ''}</span>${cb}</div></div>
  <div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Riwayat_Pemeriksaan" class="table table-hover mb-0"><thead><tr><th>Tanggal</th><th>No. RM</th><th>Pasien</th><th>Dokter</th><th>Diagnosis</th><th>Tindakan</th>${RH.dh ? '<th>Alasan Dihapus</th>' : ''}<th class="noexp"></th></tr></thead><tbody>${
    l.map(r => `<tr><td>${tgl(r.tanggal)}</td><td>${r.id_pasien}</td><td>${esc(r.nama)}</td><td>${esc(r.dokter)}</td><td>${esc(r.diagnosis)}</td><td>${esc(r.tindakan)}</td>${RH.dh ? `<td>${esc(r.dihapus_alasan)} <span class="small text-muted">(${esc(r.dihapus_oleh)})</span></td>` : ''}<td class="text-nowrap text-end">${RH.dh ? `<button class="ib" style="color:#28a745" title="Pulihkan" onclick="pulihkanKunjungan('${r.id}')"><i class="bi bi-arrow-counterclockwise"></i></button>` : `<button class="ib ed" title="Lihat detail" onclick="lihatKunjungan('${r.id}')"><i class="bi bi-eye-fill"></i></button><button class="ib dl" title="Simpan PDF" onclick="pdfKunjungan('${r.id}')"><i class="bi bi-file-earmark-pdf-fill"></i></button><button class="ib" style="color:#6c757d" title="Seluruh riwayat pasien" onclick="riwayat('${r.id_pasien}')"><i class="bi bi-clock-history"></i></button><button class="ib dl" title="Hapus data" onclick="hapusKunjungan('${r.id}')"><i class="bi bi-trash3-fill"></i></button>`}</td></tr>`).join('') || empty(RH.dh ? 8 : 7, 'Belum ada pemeriksaan pada rentang ini')}</tbody></table></div></div>`;
}
function hapusKunjungan(id) {
  const r = RHL.find(x => x.id === id); if (!r) return;
  modal('Hapus Data Pemeriksaan', `<div class="alert alert-warning small">Data pemeriksaan <b>${esc(r.nama)}</b> (${r.id_pasien}) tanggal <b>${tgl(r.tanggal)}</b> akan dihapus dari riwayat dan backup dokter. Karena rekam medis wajib disimpan, data tidak dihapus permanen: disimpan sebagai arsip dan hanya Pemilik yang dapat memulihkannya. Resep dan transaksi terkait tidak berubah.</div><label class="small">Alasan penghapusan *</label><textarea id="hk_alasan" class="form-control" rows="2"></textarea>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-danger" onclick="hapusKunjunganDo('${id}')"><i class="bi bi-trash3-fill"></i> Ya, Hapus</button>`);
}
async function hapusKunjunganDo(id) { await guard(call('kunjunganHapus', { id, alasan: val('hk_alasan') }), 'Data pemeriksaan dihapus'); closeM(); vRiwayat(); }
async function pulihkanKunjungan(id) { await guard(call('kunjunganPulihkan', { id }), 'Data dipulihkan'); vRiwayat(); }

// ═══ APOTEK: RIWAYAT RESEP & PEMBELIAN OBAT ═══
const atabs = () => !['Pemilik', AK].includes(U.peran) ? '' : `<ul class="nav nav-tabs mb-3">${[['masuk', 'inbox', 'Resep Masuk'], ['riwayat', 'clipboard2-check', 'Riwayat Resep & Penyerahan'], ['jual', 'cash-stack', 'Penjualan Obat Umum']].map(t => `<li class="nav-item"><a class="nav-link ${ATAB === t[0] ? 'active' : ''}" role="button" onclick="setATab('${t[0]}')"><i class="bi bi-${t[1]}"></i> ${t[2]}</a></li>`).join('')}</ul>`;
function setATab(t) { ATAB = t; VIEWS.apotek().catch(e => toast(e.message, 'danger')); }
const d30 = () => new Date(Date.now() - 30 * 864e5).toLocaleDateString('en-CA');
async function vResepRiwayat() {
  if ($('#rr_dr')) RR = { dr: val('rr_dr'), sp: val('rr_sp'), q: val('rr_q'), st: val('rr_st') };
  if (!RR) RR = { dr: d30(), sp: CFG.today, q: '', st: 'Diserahkan' };
  const l = await call('resepRiwayat', { dari: RR.dr, sampai: RR.sp, q: RR.q, status: RR.st }); RRL = l;
  const wk = s => s ? tgl(String(s).slice(0, 10)) + ' ' + String(s).slice(11) : '-';
  $('#view').innerHTML = head('Resep & Apotek') + atabs() + `<div class="card p-3 mb-3"><div class="row g-2 align-items-end"><div class="col-6 col-md-2"><label class="small">Dari</label><input type="date" id="rr_dr" class="form-control" value="${RR.dr}"></div><div class="col-6 col-md-2"><label class="small">Sampai</label><input type="date" id="rr_sp" class="form-control" value="${RR.sp}"></div><div class="col-6 col-md-2"><label class="small">Status</label><select id="rr_st" class="form-select">${['Diserahkan', 'Dibatalkan', 'Dihapus', 'Semua'].map(s => `<option ${s === RR.st ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="col-6 col-md-4"><label class="small">Cari pasien / dokter / obat / apoteker</label><input id="rr_q" class="form-control" value="${esc(RR.q)}" onkeydown="if(event.key==='Enter')vResepRiwayat()"></div><div class="col-md-2"><button class="btn btn-brand w-100" onclick="vResepRiwayat()"><i class="bi bi-search"></i> Tampilkan</button></div></div><div class="small text-muted mt-2">${l.length} resep · ${l.reduce((s, r) => s + r.items.length, 0)} item obat</div></div>
  <div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Riwayat_Resep" class="table table-hover mb-0"><thead><tr><th>Tgl Resep</th><th>Waktu Penyerahan</th><th>Pasien</th><th>Dokter</th><th>Obat</th><th>Status</th><th>Diserahkan Oleh</th><th>Pemberitahuan Dokter</th><th class="noexp"></th></tr></thead><tbody>${
    l.map(r => `<tr><td>${tgl(r.tanggal)}</td><td>${wk(r.waktu_serah)}</td><td>${esc(r.nama_pasien)}</td><td>${esc(r.dokter)}</td><td>${r.items.map(i => esc(i.nama) + ' ×' + i.jumlah + (i.nama_asli && i.nama_asli !== i.nama ? ' (pengganti ' + esc(i.nama_asli) + ')' : '')).join('<br>')}</td><td>${badge(r.status)}</td><td>${esc(r.diserahkan_oleh || '-')}</td><td>${konfCell(r)}</td><td class="text-end text-nowrap"><button class="ib ed" title="Detail" onclick="resepDetail('${r.id}')"><i class="bi bi-eye-fill"></i></button>${r.status === 'Diserahkan' ? `<button class="ib" style="color:#f59f00" title="Beritahu dokter lewat dashboard (resep diserahkan / diubah)" onclick="konfDokterForm('${r.id}')"><i class="bi bi-bell-fill"></i></button>${r.hapus_minta === 'Ya' ? `<button class="ib" title="Batalkan permintaan hapus (menunggu persetujuan dokter)" onclick="hapusBatalMinta('${r.id}')"><i class="bi bi-x-circle"></i></button>` : `<button class="ib dl" title="Hapus resep (butuh persetujuan dokter)" onclick="hapusResepForm('${r.id}')"><i class="bi bi-trash3-fill"></i></button>`}` : ''}</td></tr>`).join('') || empty(9, 'Belum ada riwayat resep pada rentang ini')}</tbody></table></div></div>`;
}
function resepDetail(id) {
  const r = RRL.find(x => x.id === id); if (!r) return;
  modal('Detail Resep — ' + r.nama_pasien, `<div class="small mb-2">Dokter: <b>${esc(r.dokter)}</b> · Tgl resep: ${tgl(r.tanggal)} · ${badge(r.status)}<br>Diserahkan oleh: <b>${esc(r.diserahkan_oleh || '-')}</b>${r.waktu_serah ? ' · ' + tgl(String(r.waktu_serah).slice(0, 10)) + ' ' + String(r.waktu_serah).slice(11) : ''}</div><ul>${r.items.map(i => `<li>${esc(i.nama)} <b>×${i.jumlah}</b> <span class="text-muted">${esc(i.aturan)}</span>${i.nama_asli && i.nama_asli !== i.nama ? `<div class="small text-muted">pengganti dari: ${esc(i.nama_asli)}</div>` : ''}</li>`).join('')}</ul>${r.revisi ? `<div class="small"><i class="bi bi-pencil-square"></i> Revisi: ${esc(r.revisi)}</div>` : ''}${r.status === 'Dibatalkan' && r.catatan ? `<div class="small text-danger">Alasan batal: ${esc(r.catatan)}</div>` : ''}${r.status === 'Dihapus' ? `<div class="small text-danger">Dihapus oleh ${esc(r.dihapus_oleh)} · ${esc(r.dihapus_alasan)}</div>` : ''}`);
}
function hapusResepForm(id) {
  const r = RRL.find(x => x.id === id); if (!r) return; const pem = U.peran === 'Pemilik';
  modal('Hapus Resep', `<div class="alert alert-warning small mb-3"><b>${esc(r.nama_pasien)}</b> · ${tgl(r.tanggal)} · ${esc(r.dokter)}<br>${r.items.map(i => esc(i.nama) + ' ×' + i.jumlah).join(', ')}<hr class="my-2">Stok obat dikembalikan otomatis. Data resep disimpan sebagai arsip (tidak hilang permanen), dan tercatat di log audit.${pem ? '' : `<br><b>Penghapusan memerlukan persetujuan ${esc(r.dokter)}</b>; permintaan akan muncul di dashboard dokter.`}</div><label class="small">Alasan penghapusan *</label><textarea id="hr_alasan" class="form-control" rows="2" placeholder="mis. salah memberikan obat / tidak sesuai resep"></textarea>`,
    pem ? `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-danger" onclick="hapusResepLangsung('${id}')"><i class="bi bi-trash3-fill"></i> Hapus Resep</button>`
        : `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-warning" onclick="hapusResepMinta('${id}')"><i class="bi bi-bell-fill"></i> Kirim Permintaan ke Dokter</button>`);
}
async function hapusResepMinta(id) {
  const alasan = val('hr_alasan').trim(); if (alasan.length < 5) return toast('Alasan minimal 5 karakter', 'warning');
  const r = await guard(call('resepHapusMinta', { id, alasan }));
  modal('Permintaan Terkirim', `<div class="alert alert-success small mb-0"><i class="bi bi-bell-fill"></i> Permintaan hapus resep sudah muncul di dashboard <b>${esc(r.dokter)}</b>. Resep baru dihapus (stok dikembalikan) setelah dokter menyetujui. Pantau statusnya di kolom <b>Pemberitahuan Dokter</b>.</div>`, '<button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>');
  VIEWS.apotek();
}
async function hapusBatalMinta(id) { await guard(call('resepHapusBatalMinta', { id }), 'Permintaan hapus dibatalkan'); VIEWS.apotek(); }
async function hapusSetuju(id) { if (!confirm('Setujui penghapusan resep ini? Stok obat akan dikembalikan.')) return; await guard(call('resepHapusSetuju', { id }), 'Resep dihapus, stok dikembalikan'); cekResep(); VIEWS.apotek(); }
function hapusTolakForm(id) { modal('Tolak Permintaan Hapus', '<label class="small">Alasan penolakan (opsional)</label><input id="ht_alasan" class="form-control">', `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-danger" onclick="hapusTolak('${id}')">Tolak</button>`); }
async function hapusTolak(id) { await guard(call('resepHapusTolak', { id, alasan: val('ht_alasan') }), 'Permintaan hapus ditolak'); closeM(); cekResep(); VIEWS.apotek(); }
async function hapusResepLangsung(id) { await guard(call('resepHapusLangsung', { id, alasan: val('hr_alasan').trim() }), 'Resep dihapus, stok dikembalikan'); closeM(); VIEWS.apotek(); }
async function diagnosa() {
  const r = await guard(call('perbaikiStruktur'));
  modal('Hasil Pemeriksaan Struktur Data', `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Sheet</th><th>Baris data</th><th>Hasil</th></tr></thead><tbody>${r.map(x => `<tr><td>${x.sheet}</td><td>${x.baris}</td><td>${x.baru ? '<span class="text-success">Sheet dibuat</span>' : x.ditambah.length ? '<span class="text-success">Kolom ditambah: ' + x.ditambah.join(', ') + '</span>' : '<span class="text-muted">Sesuai</span>'}</td></tr>`).join('')}</tbody></table></div><div class="small text-muted">Data yang sudah ada tidak diubah.</div>`, null, 'modal-lg modal-dialog-scrollable');
}
// ═══ KERJA SAMA PBF & WHATSAPP ═══
const waNo = n => { let x = String(n || '').replace(/\D/g, ''); if (x.startsWith('00')) x = x.slice(2); if (x.startsWith('620')) x = '62' + x.slice(3); else if (x.startsWith('62')) { } else if (x.startsWith('0')) x = '62' + x.slice(1); else if (x.startsWith('8')) x = '62' + x; return /^62\d{8,13}$/.test(x) ? x : ''; };
function pbfForm(id) {
  const p = PBFL.find(x => x.id === id) || {}, f = (k, l, t = 'text', w = 6, ph = '') => `<div class="col-md-${w}"><label class="small">${l}</label><input type="${t}" id="pf_${k}" class="form-control" placeholder="${ph}" value="${esc(p[k])}"></div>`;
  const sel = (k, l, opts) => `<div class="col-md-4"><label class="small">${l}</label><select id="pf_${k}" class="form-select">${opts.map(o => `<option ${o === p[k] ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
  modal(id ? 'Ubah Rekanan PBF' : 'Rekanan PBF Baru', `<div class="row g-2">${f('nama', 'Nama PBF *', 'text', 8)}${f('no_izin', 'No. Izin PBF', 'text', 4)}${f('pic', 'PIC / Salesman')}${f('produk', 'Produk / kategori utama', 'text', 6, 'mis. obat topikal, antibiotik')}${f('telp', 'Telepon', 'tel', 4)}${f('wa', 'No. WhatsApp', 'tel', 4, '0812xxxxxxxx')}${f('email', 'Email', 'email', 4)}<div class="col-12"><label class="small">Alamat</label><input id="pf_alamat" class="form-control" value="${esc(p.alamat)}"></div>${sel('termin', 'Termin pembayaran', ['COD', 'TOP 7 hari', 'TOP 14 hari', 'TOP 30 hari', 'TOP 45 hari', 'Lainnya'])}${f('diskon', 'Diskon / ketentuan harga', 'text', 4, 'mis. 5% + 2%')}${sel('status', 'Status', ['Aktif', 'Prospek', 'Nonaktif'])}${f('mulai', 'Kerja sama mulai', 'date', 4)}${f('berakhir', 'Kerja sama berakhir', 'date', 4)}<div class="col-md-4"></div><div class="col-12"><label class="small">Catatan</label><textarea id="pf_catatan" class="form-control" rows="2">${esc(p.catatan)}</textarea></div></div>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-brand" onclick="pbfSave('${id || ''}')">Simpan</button>`, 'modal-lg');
}
async function pbfSave(id) {
  const p = { id: id || undefined }; ['nama', 'no_izin', 'pic', 'produk', 'telp', 'wa', 'email', 'alamat', 'termin', 'diskon', 'status', 'mulai', 'berakhir', 'catatan'].forEach(k => p[k] = val('pf_' + k).trim());
  await guard(call('pbfSimpan', p), 'Rekanan PBF tersimpan'); closeM(); VIEWS.pbf();
}
async function pbfDetail(id) {
  const p = await guard(call('pbfDetail', { id })), row = (l, v) => v ? `<div class="col-md-6"><span class="text-muted small">${l}</span><div>${esc(v)}</div></div>` : '';
  modal('Rekanan PBF — ' + p.nama, `<div class="row g-2">${row('PIC / Salesman', p.pic)}${row('No. Izin PBF', p.no_izin)}${row('Telepon', p.telp)}${row('WhatsApp', p.wa)}${row('Email', p.email)}${row('Alamat', p.alamat)}${row('Produk utama', p.produk)}${row('Termin', p.termin)}${row('Diskon / ketentuan', p.diskon)}${row('Masa kerja sama', (p.mulai ? tgl(p.mulai) : '-') + ' – ' + (p.berakhir ? tgl(p.berakhir) : 'tanpa batas'))}${row('Catatan', p.catatan)}</div>
    <hr><div class="d-flex justify-content-between"><b>Riwayat pembelian</b><span class="small text-muted">${p.jml_faktur} faktur · ${rp(p.total_beli)}</span></div>
    <div class="table-responsive"><table class="table table-sm"><thead><tr><th>Tanggal</th><th>Faktur</th><th>Obat</th><th>Jumlah</th><th class="text-end">Total</th></tr></thead><tbody>${p.pembelian.map(x => `<tr><td>${tgl(x.tanggal)}</td><td>${esc(x.no_faktur)}</td><td>${esc(x.nama)}</td><td>${x.jumlah}</td><td class="text-end">${rp(x.total)}</td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">Belum ada pembelian dari rekanan ini</td></tr>'}</tbody></table></div>`,
    `<button class="btn btn-success" onclick="closeM();pbfPesan('${id}')"><i class="bi bi-whatsapp"></i> Kirim Permintaan Pesanan</button><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>`, 'modal-lg modal-dialog-scrollable');
}
async function pbfPesan(id) {
  const p = PBFL.find(x => x.id === id); if (!p) return; OBAT = await call('obatList');
  const low = OBAT.filter(o => o.aktif !== 'Tidak' && o.stok <= o.stok_min).map(o => `- ${o.nama}: ${Math.max(o.stok_min * 2 - o.stok, o.stok_min)} ${o.satuan}`);
  const pesan = `Yth. ${p.pic || 'Bapak/Ibu'} (${p.nama}),\nMohon penawaran dan ketersediaan untuk ${CFG.nama_praktik || 'praktik kami'}:\n${low.join('\n') || '- (isi daftar obat)'}\n\nMohon info harga, diskon, dan estimasi pengiriman. Terima kasih.`;
  modal('Permintaan Pesanan — ' + p.nama, `<div class="small text-muted mb-2">${low.length ? `Terisi otomatis dari <b>${low.length} obat</b> yang stoknya menipis (jumlah = 2× stok minimum − stok saat ini). ` : 'Tidak ada obat menipis; isi daftar secara manual. '}Pesan dapat diubah.</div><textarea id="pp_msg" class="form-control" rows="9">${esc(pesan)}</textarea><div class="small text-muted mt-2">Tujuan: ${esc(p.wa || p.telp || '(nomor belum diisi)')}</div>`,
    `<button class="btn btn-light" onclick="copyText($('#pp_msg').value)"><i class="bi bi-clipboard"></i> Salin</button><button class="btn btn-outline-success" onclick="pbfWaBuka('${id}')"><i class="bi bi-box-arrow-up-right"></i> Buka WhatsApp</button>`, 'modal-lg');
}
function pbfWaBuka(id) { const p = PBFL.find(x => x.id === id), no = waNo(p.wa || p.telp); if (!no) return toast('Nomor WhatsApp rekanan belum diisi atau tidak valid', 'warning'); window.open('https://wa.me/' + no + '?text=' + encodeURIComponent(val('pp_msg')), '_blank'); }
function pbfHapusKonfirm(id) {
  const p = PBFL.find(x => x.id === id); if (!p) return;
  modal('Hapus Rekanan PBF', `<p>Hapus <b>${esc(p.nama)}</b> dari daftar rekanan?</p><div class="small text-muted">Riwayat Pembelian Obat tidak terhapus. Untuk menghentikan kerja sama sementara, lebih aman mengubah status menjadi Nonaktif.</div>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-danger" onclick="pbfHapusDo('${id}')"><i class="bi bi-trash3-fill"></i> Ya, Hapus</button>`);
}
async function pbfHapusDo(id) { await guard(call('pbfHapus', { id }), 'Rekanan dihapus'); closeM(); VIEWS.pbf(); }
const konfCell = r => {
  const f = s => { s = String(s || ''); return s ? tgl(s.slice(0, 10)) + ' ' + s.slice(11) : ''; };
  if (r.hapus_minta === 'Ya') return `<span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split"></i> Menunggu persetujuan dokter</span><div class="small text-muted">diminta ${f(r.hapus_minta_waktu)}</div>`;
  if (r.hapus_minta === 'Ditolak') return `<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Hapus ditolak dokter</span><div class="small text-muted">${esc(r.hapus_jawab && r.hapus_jawab !== '-' ? r.hapus_jawab : 'tanpa alasan')}</div>`;
  if (r.status === 'Dihapus' && String(r.dihapus_oleh).includes('disetujui')) return '<span class="badge bg-success"><i class="bi bi-shield-check"></i> Disetujui dokter</span>';
  const base = r.status === 'Dihapus' ? '<span class="badge bg-secondary">Dihapus oleh Pemilik</span>' : '';
  if (r.notif_dokter === 'Ya') return base + `<div><span class="badge bg-warning text-dark"><i class="bi bi-bell-fill"></i> Belum dibaca dokter</span></div><div class="small text-muted">${f(r.konf_waktu || r.revisi_waktu || r.dihapus_waktu)}</div>`;
  if (r.notif_baca) return base + `<div><span class="badge bg-success"><i class="bi bi-check2-all"></i> Dibaca dokter</span></div><div class="small text-muted">${f(r.notif_baca)}</div>`;
  return base || '-';
};
function konfDokterForm(id) {
  const r = RRL.find(x => x.id === id); if (!r) return;
  modal('Beritahu Dokter', `<div class="small mb-2"><b>${esc(r.nama_pasien)}</b> · ${tgl(r.tanggal)} · ${esc(r.dokter)}<ul class="mb-1">${r.items.map(i => `<li>${esc(i.nama)} ×${i.jumlah} <span class="text-muted">${esc(i.aturan)}</span>${i.nama_asli && i.nama_asli !== i.nama ? `<div class="text-muted">pengganti dari: ${esc(i.nama_asli)}</div>` : ''}</li>`).join('')}</ul>${r.revisi ? `<div><i class="bi bi-pencil-square"></i> Revisi: ${esc(r.revisi)}</div>` : ''}</div>
    <div class="alert alert-info small mb-0"><i class="bi bi-bell-fill"></i> Pemberitahuan akan muncul di dashboard <b>${esc(r.dokter)}</b> (lencana menu, notifikasi, dan banner di Resep &amp; Apotek) sampai ditandai sudah dibaca. Diagnosis tidak ditampilkan.</div>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-warning" onclick="konfDokterKirim('${id}')"><i class="bi bi-bell-fill"></i> Kirim Pemberitahuan</button>`);
}
async function konfDokterKirim(id) { await guard(call('resepKonfirmDokter', { id }), 'Pemberitahuan terkirim ke dashboard dokter'); closeM(); VIEWS.apotek(); }
let BTAB = 'rekanan';
const btabs = () => `<ul class="nav nav-tabs mb-3">${[['rekanan', 'truck', 'Rekanan PBF'], ['beli', 'cart-plus', 'Pembelian dari PBF']].map(t => `<li class="nav-item"><a class="nav-link ${BTAB === t[0] ? 'active' : ''}" role="button" onclick="setBTab('${t[0]}')"><i class="bi bi-${t[1]}"></i> ${t[2]}</a></li>`).join('')}</ul>`;
function setBTab(t) { BTAB = t; VIEWS.pbf().catch(e => toast(e.message, 'danger')); }
// ═══ APOTEK: PENJUALAN OBAT UMUM ═══
let PJX = null, PJL = [], PJI = [];
async function vPenjualan() {
  if ($('#pj_dr')) PJX = { dr: val('pj_dr'), sp: val('pj_sp'), q: val('pj_q') };
  if (!PJX) PJX = { dr: d30(), sp: CFG.today, q: '' };
  const l = await call('penjualanList', { dari: PJX.dr, sampai: PJX.sp, q: PJX.q }); PJL = l;
  $('#view').innerHTML = head('Resep & Apotek', '<button class="btn btn-brand" onclick="penjualanForm()"><i class="bi bi-plus-lg"></i> Penjualan Baru</button>') + atabs() + `<div class="card p-3 mb-3"><div class="row g-2 align-items-end"><div class="col-6 col-md-2"><label class="small">Dari</label><input type="date" id="pj_dr" class="form-control" value="${PJX.dr}"></div><div class="col-6 col-md-2"><label class="small">Sampai</label><input type="date" id="pj_sp" class="form-control" value="${PJX.sp}"></div><div class="col-md-4"><label class="small">Cari pembeli / obat</label><input id="pj_q" class="form-control" value="${esc(PJX.q)}" onkeydown="if(event.key==='Enter')vPenjualan()"></div><div class="col-md-2"><button class="btn btn-brand w-100" onclick="vPenjualan()"><i class="bi bi-search"></i> Tampilkan</button></div><div class="col-md-2 text-md-end"><div class="small text-muted">Total penjualan</div><b>${rp(l.reduce((s, p) => s + Number(p.total), 0))}</b></div></div></div>
  <div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Penjualan_Obat_Umum" class="table table-hover mb-0"><thead><tr><th>Tanggal</th><th>Pembeli</th><th>Obat</th><th>Metode</th><th>Dicatat oleh</th><th class="text-end">Total</th></tr></thead><tbody>${
    l.map(p => `<tr><td>${tgl(p.tanggal)}</td><td>${esc(p.nama)}</td><td>${p.items.map(i => esc(i.n) + ' ×' + i.q).join('<br>')}</td><td>${esc(p.metode)}</td><td>${esc(p.kasir)}</td><td class="text-end">${rp(p.total)}</td></tr>`).join('') || empty(6, 'Belum ada penjualan obat umum pada rentang ini')}</tbody></table></div></div>`;
}
async function penjualanForm() {
  OBAT = await call('obatList'); PJI = [{ id_obat: '', jumlah: 1 }];
  modal('Penjualan Obat Umum Baru', `<div class="row g-2 mb-3"><div class="col-md-7"><label class="small">Nama pembeli (opsional)</label><input id="pj_nm" class="form-control" placeholder="kosong = Pembeli Umum"></div><div class="col-md-5"><label class="small">Metode bayar</label><select id="pj_mt" class="form-select">${(CFG.metode_bayar || 'Tunai').split(',').map(m => `<option>${esc(m.trim())}</option>`).join('')}</select></div></div><div id="pj_items"></div><button class="btn btn-sm btn-outline-secondary" onclick="pjAdd()">+ Tambah obat</button><div class="text-end mt-2">Total: <b id="pj_tot">Rp 0</b></div><div class="small text-muted mt-2">Stok obat berkurang otomatis dan penjualan tercatat sebagai kas masuk kategori Penjualan Umum.</div>`,
    '<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-success" onclick="pjSave()"><i class="bi bi-check2-circle"></i> Simpan & Cetak Struk</button>', 'modal-lg');
  pjDraw();
}
function pjRead() { PJI = PJI.map((r, n) => ({ id_obat: val('pjo' + n), jumlah: val('pjj' + n) })); }
function pjDraw() {
  $('#pj_items').innerHTML = PJI.map((r, n) => `<div class="row g-2 mb-2 align-items-end"><div class="col-md-8"><label class="small">Obat *</label><select id="pjo${n}" class="form-select form-select-sm" onchange="pjRead();pjTot()"><option value="">— pilih obat —</option>${OBAT.filter(o => o.aktif !== 'Tidak' && (o.stok > 0 || o.id === r.id_obat)).map(o => `<option value="${o.id}" ${o.id === r.id_obat ? 'selected' : ''}>${esc(o.nama)} — ${rp(o.harga_jual)} (stok ${o.stok} ${esc(o.satuan)})</option>`).join('')}</select></div><div class="col-8 col-md-3"><label class="small">Jumlah</label><input type="number" min="1" id="pjj${n}" class="form-control form-control-sm" value="${r.jumlah}" oninput="pjTot()"></div><div class="col-4 col-md-1"><button class="ib dl" title="Hapus baris" onclick="pjDel(${n})"><i class="bi bi-x-lg"></i></button></div></div>`).join(''); pjTot();
}
function pjAdd() { pjRead(); PJI.push({ id_obat: '', jumlah: 1 }); pjDraw(); }
function pjDel(n) { pjRead(); PJI.splice(n, 1); if (!PJI.length) PJI.push({ id_obat: '', jumlah: 1 }); pjDraw(); }
function pjTot() { $('#pj_tot').textContent = rp(PJI.reduce((s, r, n) => { const o = OBAT.find(x => x.id === val('pjo' + n)); return s + (o ? (Number(val('pjj' + n)) || 0) * Number(o.harga_jual || 0) : 0); }, 0)); }
async function pjSave() {
  pjRead(); const items = PJI.filter(r => r.id_obat); if (!items.length) return toast('Pilih minimal satu obat', 'warning');
  for (const r of items) { const o = OBAT.find(x => x.id === r.id_obat); if (o && Number(r.jumlah) > o.stok) return toast('Stok ' + o.nama + ' tidak cukup (sisa ' + o.stok + ')', 'warning'); }
  const r = await guard(call('penjualanSimpan', { nama: val('pj_nm'), metode: val('pj_mt'), items })), it = JSON.parse(r.rincian);
  modal('Struk', `<div class="struk"><div class="text-center"><b>${esc(CFG.nama_praktik)}</b><br>${esc(CFG.alamat)}<hr></div>Tgl: ${tgl(r.tanggal)}<br>Pembeli: ${esc(r.nama)}<hr>${it.map(i => `${esc(i.n)} ×${i.q}<span class="float-end">${rp(i.q * i.h)}</span><br>`).join('')}<hr><b>TOTAL<span class="float-end">${rp(r.total)}</span></b><br>Bayar: ${esc(r.metode)}<br>Petugas: ${esc(r.kasir)}<hr><div class="text-center">Terima kasih</div></div>`,
    '<button class="btn btn-brand" onclick="window.print()"><i class="bi bi-printer"></i> Cetak</button><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>');
  if (V === 'apotek') VIEWS.apotek();
}
async function vPembelian() {
  if ($('#pb_dr')) PB = { dr: val('pb_dr'), sp: val('pb_sp2'), q: val('pb_q') };
  if (!PB) PB = { dr: d30(), sp: CFG.today, q: '' };
  const l = await call('pembelianList', { dari: PB.dr, sampai: PB.sp, q: PB.q }); PBL = l;
  const per = {}; l.forEach(p => { const k = String(p.supplier || '-').trim(); per[k] = per[k] || { t: 0, f: new Set() }; per[k].t += Number(p.total); per[k].f.add(p.no_faktur); });
  const rk = Object.entries(per).sort((a, b) => b[1].t - a[1].t);
  $('#view').innerHTML = head('Kerja Sama PBF', '<button class="btn btn-brand" onclick="pembelianForm()"><i class="bi bi-plus-lg"></i> Pembelian Baru</button>') + btabs() + `<div class="alert alert-success small py-2"><i class="bi bi-check2-circle"></i> Saat pembelian disimpan, <b>stok obat bertambah otomatis</b> dan <b>total pembelian rekanan terhitung otomatis</b>. Pemilik dan Apotek membaca data yang sama.</div><div class="card p-3 mb-3"><div class="row g-2 align-items-end"><div class="col-6 col-md-2"><label class="small">Dari</label><input type="date" id="pb_dr" class="form-control" value="${PB.dr}"></div><div class="col-6 col-md-2"><label class="small">Sampai</label><input type="date" id="pb_sp2" class="form-control" value="${PB.sp}"></div><div class="col-md-4"><label class="small">Cari obat / supplier / No. faktur</label><input id="pb_q" class="form-control" value="${esc(PB.q)}" onkeydown="if(event.key==='Enter')vPembelian()"></div><div class="col-md-2"><button class="btn btn-brand w-100" onclick="vPembelian()"><i class="bi bi-search"></i> Tampilkan</button></div><div class="col-md-2 text-md-end"><div class="small text-muted">Total pembelian</div><b>${rp(l.reduce((s, p) => s + Number(p.total), 0))}</b></div></div></div>
  <div class="card p-3 mb-3"><h6 class="mb-2"><i class="bi bi-truck"></i> Total pembelian per rekanan (periode ini)</h6>${rk.map(([k, v]) => `<span class="badge bg-secondary me-1 mb-1 fs-6 fw-normal">${esc(k)}: ${rp(v.t)} · ${v.f.size} faktur</span>`).join('') || '<div class="small text-muted">Belum ada pembelian pada rentang ini</div>'}</div>
  <div class="card">${tbBar()}<div class="table-responsive"><table id="tb" data-tb="Pembelian_Obat" class="table table-hover mb-0"><thead><tr><th>Tanggal</th><th>No. Faktur</th><th>Supplier</th><th>Obat</th><th>Jumlah</th><th>Harga Beli</th><th>Total</th><th>Petugas</th></tr></thead><tbody>${
    l.map(p => `<tr><td>${tgl(p.tanggal)}</td><td>${esc(p.no_faktur)}</td><td>${esc(p.supplier)}</td><td>${esc(p.nama)}</td><td>${p.jumlah} ${esc(p.satuan || '')}${Number(p.isi) > 1 ? `<div class="small text-muted">isi ${p.isi} → ${p.jumlah * p.isi} di stok</div>` : ''}</td><td>${rp(p.harga_beli)}</td><td>${rp(p.total)}</td><td>${esc(p.petugas)}</td></tr>`).join('') || empty(8, 'Belum ada pembelian obat pada rentang ini')}</tbody></table></div></div>`;
}
async function pembelianForm() {
  const [ob, pbn] = await Promise.all([call('obatList'), call('pbfNama').catch(() => [])]); OBAT = ob; PI = [{ id_obat: '', jumlah: 1, harga: 0, satuan: '', isi: 1 }];
  modal('Pembelian Obat Baru', `<div class="row g-2 mb-3"><div class="col-md-4"><label class="small">Tanggal</label><input type="date" id="pb_tg" class="form-control" value="${CFG.today}"></div><div class="col-md-4"><label class="small">No. Faktur</label><input id="pb_nf" class="form-control" placeholder="kosong = otomatis"></div><div class="col-md-4"><label class="small">Supplier *</label><input id="pb_su" class="form-control" list="pb_pbf" placeholder="pilih rekanan PBF / ketik"><datalist id="pb_pbf">${pbn.map(p => `<option value="${esc(p.nama)}">${esc([p.termin, p.diskon].filter(Boolean).join(' · '))}</option>`).join('')}</datalist></div></div><div id="pb_items"></div><button class="btn btn-sm btn-outline-secondary" onclick="pbAdd()">+ Tambah obat</button><div class="text-end mt-2">Total: <b id="pb_tot">Rp 0</b></div><label class="small mt-2">Catatan</label><input id="pb_ct" class="form-control"><div class="small text-muted mt-2">Stok obat bertambah otomatis dan harga beli terbaru tersimpan di master obat. Beli dalam duz/strip? Isi kolom "Isi per satuan" (mis. 1 duz = 10 strip → 10) agar stok bertambah sesuai satuan stok.</div>`,
    '<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-brand" onclick="pembelianSave()">Simpan Pembelian</button>', 'modal-lg');
  pbDraw();
}
const SAT_BELI = ['Pcs', 'Strip', 'Duz', 'Box', 'Botol', 'Tube', 'Sachet', 'Pot', 'Ampul', 'Vial', 'Tablet', 'Kapsul'];
function pbRead() { PI = PI.map((r, n) => ({ id_obat: val('pbo' + n), jumlah: val('pbj' + n), harga: val('pbh' + n), satuan: val('pbs' + n).trim(), isi: val('pbi' + n) || 1 })); }
function pbDraw() {
  $('#pb_items').innerHTML = `<datalist id="pb_sat">${SAT_BELI.map(s => `<option value="${s}">`).join('')}</datalist>` + PI.map((r, n) => `<div class="border rounded p-2 mb-2"><div class="row g-2 align-items-end"><div class="col-md-4"><label class="small">Obat *</label><select id="pbo${n}" class="form-select form-select-sm" onchange="pbPick(${n})"><option value="">— pilih obat —</option>${OBAT.filter(o => o.aktif !== 'Tidak').map(o => `<option value="${o.id}" ${o.id === r.id_obat ? 'selected' : ''}>${esc(o.nama)} (stok ${o.stok} ${esc(o.satuan)})</option>`).join('')}</select></div><div class="col-4 col-md-2"><label class="small">Jumlah</label><input type="number" min="1" id="pbj${n}" class="form-control form-control-sm" value="${r.jumlah}" oninput="pbTot()"></div><div class="col-4 col-md-2"><label class="small">Satuan</label><input id="pbs${n}" list="pb_sat" class="form-control form-control-sm" placeholder="pcs / strip / duz…" value="${esc(r.satuan)}"></div><div class="col-4 col-md-3"><label class="small">Harga beli / satuan</label><input type="number" min="0" id="pbh${n}" class="form-control form-control-sm" value="${r.harga}" oninput="pbTot()"></div><div class="col-12 col-md-1 text-end"><button class="ib dl" title="Hapus baris" onclick="pbDel(${n})"><i class="bi bi-x-lg"></i></button></div></div><div class="row g-2 mt-0 align-items-center"><div class="col-5 col-md-3"><label class="small">Isi per satuan</label><input type="number" min="1" step="any" id="pbi${n}" class="form-control form-control-sm" value="${r.isi || 1}" oninput="pbTot()"></div><div class="col-7 col-md-9 small text-muted" id="pbp${n}"></div></div></div>`).join(''); pbTot();
}
function pbPick(n) { pbRead(); const o = OBAT.find(x => x.id === PI[n].id_obat); if (o && !(Number(PI[n].harga) > 0)) PI[n].harga = o.harga_beli; if (o && !PI[n].satuan) PI[n].satuan = o.satuan; pbDraw(); }
function pbAdd() { pbRead(); PI.push({ id_obat: '', jumlah: 1, harga: 0, satuan: '', isi: 1 }); pbDraw(); }
function pbDel(n) { pbRead(); PI.splice(n, 1); if (!PI.length) PI.push({ id_obat: '', jumlah: 1, harga: 0, satuan: '', isi: 1 }); pbDraw(); }
function pbTot() {
  let t = 0; PI.forEach((r, n) => { const q = Number(val('pbj' + n)) || 0, h = Number(val('pbh' + n)) || 0, k = Number(val('pbi' + n)) || 1, o = OBAT.find(x => x.id === val('pbo' + n)); t += q * h;
    const e = $('#pbp' + n); if (e) e.textContent = o ? 'Isi per satuan = jumlah dalam satuan stok (' + o.satuan + '). Masuk stok: ' + (q * k) + ' ' + o.satuan + (k > 1 && h > 0 ? ' · harga per ' + o.satuan + ': ' + rp(h / k) : '') : ''; });
  $('#pb_tot').textContent = rp(t);
}
async function pembelianSave() {
  pbRead(); const rb = await guard(call('pembelianSimpan', { tanggal: val('pb_tg'), no_faktur: val('pb_nf'), supplier: val('pb_su'), catatan: val('pb_ct'), items: PI.filter(r => r.id_obat) }), 'Pembelian tersimpan, stok bertambah');
  closeM(); if (rb && rb.terdaftar === false) toast('Nama supplier tidak sama dengan rekanan PBF mana pun, sehingga total tidak masuk ke rekanan. Samakan dengan nama di daftar rekanan.', 'warning'); if (V === 'stok') VIEWS.stok(); else VIEWS.pbf();
}
function backupModal() {
  modal('Backup Data Rekam Medik', `<p class="small text-muted">Cakupan: <b>${U.peran === 'Pemilik' ? 'seluruh dokter' : 'pasien dan pemeriksaan Anda'}</b> (pasien, kunjungan, resep). Simpan file di tempat aman karena berisi data rahasia pasien.</p><div class="d-grid gap-2"><button class="btn btn-success" onclick="backupDo('xlsx')"><i class="bi bi-file-earmark-excel"></i> Backup Excel (.xlsx)</button><button class="btn btn-primary" onclick="backupDo('json')"><i class="bi bi-filetype-json"></i> Backup JSON (.json)</button><button class="btn btn-danger" onclick="backupDo('pdf')"><i class="bi bi-file-earmark-pdf"></i> Simpan PDF Rekam Medik Lengkap</button>${U.peran === 'Pemilik' ? '<button class="btn btn-dark" onclick="backupNow()"><i class="bi bi-google"></i> Backup ke Google Drive sekarang</button>' : ''}</div>`);
}
async function backupDo(kind) {
  const d = await guard(call('backupData')), fn = 'Backup_RekamMedik_' + (U.peran === 'Pemilik' ? 'Semua' : U.username) + '_' + CFG.today;
  try {
    if (kind === 'json') tbSave(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), fn + '.json');
    else if (kind === 'xlsx') {
      await lib('xlsx');
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([d.info]), 'Info');
      ['Pasien', 'Kunjungan', 'Resep', 'ResepItem'].forEach(n => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d[n]), n)); XLSX.writeFile(wb, fn + '.xlsx');
    } else {
      const its = {}; d.ResepItem.forEach(i => (its[i.id_resep] = its[i.id_resep] || []).push(i));
      const rs = {}; d.Resep.filter(r => r.status !== 'Dibatalkan').forEach(r => rs[r.id_kunjungan] = its[r.id] || []);
      const items = d.Pasien.map(p => ({ pasien: p, kunjungan: d.Kunjungan.filter(x => x.id_pasien === p.id && x.status === 'Selesai').sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal))).map(x => Object.assign({}, x, { resep: rs[x.id] || [] })) })).filter(x => x.kunjungan.length);
      if (!items.length) throw new Error('Belum ada rekam medik untuk dibackup');
      pdfRekam(items, fn + '.pdf'); return;
    }
    toast('Backup berhasil dibuat');
  } catch (e) { toast(e.message, 'danger'); }
}
async function backupNow() {
  const r = await guard(call('backupDrive'));
  modal('Backup ke Google Drive', `<p class="mb-1">Salinan seluruh database sudah dibuat:</p><b>${esc(r.nama)}</b><div class="small text-muted mt-2">Folder: Backup Praktek Dokter (maksimal 30 salinan terakhir).</div>`,
    `<a class="btn btn-brand" href="${esc(r.url)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Buka</a><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>`);
  if (V === 'pengaturan') VIEWS.pengaturan();
}
async function backupToggle(aktif) { await guard(call('backupJadwal', { aktif }), aktif ? 'Backup harian diaktifkan (23.00)' : 'Backup harian dimatikan'); VIEWS.pengaturan(); }

// pemeriksaan
async function formPeriksa(idAn) {
  clearInterval(timer); const [d, ob] = await Promise.all([call('periksaBuka', { id_antrian: idAn }), call('obatList')]); OBAT = ob; ITEMS = [];
  const k = d.kunjungan || {}, ro = d.antrian.status === 'Selesai' && U.peran !== 'Pemilik' && d.antrian.dokter !== U.nama;
  try { ITEMS = k.draf_resep && k.status !== 'Selesai' ? JSON.parse(k.draf_resep) : []; } catch (e) { ITEMS = []; }
  FORM_ID = idAn; FORM_RO = ro || d.antrian.status === 'Selesai'; DIRTY = false;
  const ta = (id, l, r = 2) => `<label class="small mt-2">${l}</label><textarea id="${id}" class="form-control" rows="${r}">${esc(k[id.slice(2)])}</textarea>`;
  $('#view').innerHTML = head(`Pemeriksaan — ${esc(d.pasien.nama)} (${d.pasien.id})`, `<button class="btn btn-outline-secondary me-1" onclick="riwayat('${d.pasien.id}')"><i class="bi bi-clock-history"></i> Riwayat Rekam Medik</button><button class="btn btn-light" onclick="leaveForm()">← Kembali</button>`) +
    `<div class="row g-3"><div class="col-lg-8"><div class="card p-3">${ta('k_keluhan', 'Keluhan *')}${ta('k_anamnesis', 'Anamnesis', 3)}${ta('k_pemeriksaan', 'Pemeriksaan fisik / status dermatologis', 4)}
      <label class="small mt-2">Diagnosis * (teks / ICD-10)</label><input id="k_diagnosis" class="form-control" value="${esc(k.diagnosis)}">${ta('k_tindakan', 'Tindakan')}${ta('k_catatan', 'Catatan')}</div>
      <div class="card p-3 mt-3"><h6>Resep</h6><div class="input-group mb-2"><input id="oq" list="ol" class="form-control" onkeydown="if(event.key==='Enter'){event.preventDefault();addItem()}" placeholder="Cari obat (atau ketik teks bebas / racikan)"><datalist id="ol">${OBAT.filter(o => o.aktif !== 'Tidak').map(o => `<option value="${esc(o.nama)} [stok ${o.stok}]">`).join('')}</datalist><button class="btn btn-outline-secondary" onclick="addItem()">Tambah</button></div><div id="ri"></div>
        <div class="row g-2 mt-2 align-items-end border-top pt-2"><div class="col-md-5"><label class="small fw-semibold"><i class="bi bi-cash-coin"></i> Biaya konsul dokter (Rp)</label><input id="k_biaya" type="number" min="0" step="1000" class="form-control" value="${(k.biaya_konsul === undefined || k.biaya_konsul === null || k.biaya_konsul === '') ? (CFG.tarif_konsul || 0) : k.biaya_konsul}" ${ro ? 'disabled' : ''}></div><div class="col-md-7 small text-muted">Dapat diubah sesuai pasien. Otomatis menjadi tagihan konsul di kasir (kosongkan untuk memakai tarif bawaan).</div></div></div>
      <div class="mt-3 d-flex gap-2"><button class="btn btn-secondary" ${ro ? 'disabled' : ''} onclick="simpanPeriksa('${idAn}',false)">Simpan Draf</button><button class="btn btn-brand" ${ro ? 'disabled' : ''} onclick="simpanPeriksa('${idAn}',true)">Selesaikan Pemeriksaan</button><span id="asv" class="small text-muted align-self-center"></span></div></div>
    <div class="col-lg-4"><div class="card p-3 mb-3 ${d.pasien.alergi ? 'border-danger' : ''}"><h6>Data Pasien</h6><div class="small">${d.pasien.jk === 'L' ? 'Laki-laki' : 'Perempuan'}, lahir ${tgl(d.pasien.tgl_lahir)}<br>Telp: ${esc(d.pasien.telp)}<br><b class="text-danger">Alergi: ${esc(d.pasien.alergi || 'tidak ada tercatat')}</b></div></div>
      <div class="card p-3"><h6>Riwayat Kunjungan</h6>${d.riwayat.map(r => `<div class="small border-bottom pb-2 mb-2"><b>${tgl(r.tanggal)}</b> — ${esc(r.diagnosis)}<br><span class="text-muted">${esc(r.keluhan)}</span></div>`).join('') || '<div class="text-muted small">Belum ada riwayat</div>'}</div></div></div>`;
  drawItems(); $('#view').oninput = markDirty;
}
function addItem() {
  const t = val('oq').trim(); if (!t) return; const o = OBAT.find(x => t === x.nama + ' [stok ' + x.stok + ']' || t.toLowerCase() === x.nama.toLowerCase());
  if (o && o.stok <= 0) toast('Peringatan: stok ' + o.nama + ' habis (resep tetap bisa dibuat)', 'warning');
  ITEMS.push({ id_obat: o ? o.id : '', nama: o ? o.nama : t, jumlah: 1, aturan: '', stok: o ? o.stok : null }); $('#oq').value = ''; drawItems(); markDirty();
}
function drawItems() {
  $('#ri').innerHTML = ITEMS.map((i, n) => `<div class="row g-2 mb-2 align-items-center"><div class="col-md-4">${esc(i.nama)} ${i.id_obat ? (i.stok < i.jumlah ? '<span class="badge bg-danger">stok kurang</span>' : '') : '<span class="badge bg-secondary">non-stok</span>'}</div><div class="col-4 col-md-2"><input type="number" min="1" class="form-control form-control-sm" value="${i.jumlah}" onchange="ITEMS[${n}].jumlah=+this.value;drawItems()"></div><div class="col-6 col-md-5"><input class="form-control form-control-sm" placeholder="Aturan pakai" value="${esc(i.aturan)}" onchange="ITEMS[${n}].aturan=this.value"></div><div class="col-2 col-md-1"><button class="btn btn-sm text-danger" onclick="ITEMS.splice(${n},1);drawItems();markDirty()"><i class="bi bi-x-lg"></i></button></div></div>`).join('') || '<div class="text-muted small">Belum ada item resep</div>';
}
async function simpanPeriksa(id, selesai) {
  if (val('oq').trim()) addItem(); // teks obat yang sudah diketik tapi belum ditekan Tambah ikut dimasukkan
  clearTimeout(AS);
  const k = {}; ['keluhan', 'anamnesis', 'pemeriksaan', 'diagnosis', 'tindakan', 'catatan'].forEach(f => k[f] = val('k_' + f));
  if (selesai && (!k.keluhan.trim() || !k.diagnosis.trim())) return toast('Keluhan dan diagnosis wajib diisi', 'warning');
  if (selesai && val('k_biaya') !== '' && !(Number(val('k_biaya')) >= 0)) return toast('Biaya konsul tidak valid', 'warning');
  if (selesai && !ITEMS.length && !confirm('Belum ada obat pada resep. Selesaikan pemeriksaan tanpa resep?')) return;
  const rs = await guard(call('periksaSimpan', { id_antrian: id, k, items: ITEMS, selesai, biaya: val('k_biaya') })), ir = rs && rs.resep;
  if (!selesai) toast('Draf tersimpan');
  else if (ir === 'diserahkan') toast('Pemeriksaan disimpan. Resep sudah diserahkan apotek, perubahan obat tidak diteruskan.', 'warning');
  else if (ir === 'dipertahankan') toast('Pemeriksaan disimpan. Resep sudah direvisi apoteker, revisi tidak ditimpa.', 'warning');
  else toast({ dibuat: 'Pemeriksaan selesai. Resep terkirim ke apotek.', diperbarui: 'Pemeriksaan selesai. Resep di apotek diperbarui sesuai perubahan Anda.', dibatalkan: 'Pemeriksaan selesai. Resep di apotek dibatalkan karena obat dikosongkan.', tetap: 'Pemeriksaan selesai. Resep di apotek sudah sesuai.' }[ir] || 'Pemeriksaan selesai (tanpa resep).');
  DIRTY = false; if (selesai) nav('periksa');
}
function markDirty() {
  if (!FORM_ID || FORM_RO) return; DIRTY = true; clearTimeout(AS); AS = setTimeout(autoSave, 3000);
  const e = $('#asv'); if (e) e.textContent = 'Menyimpan otomatis…';
}
async function autoSave() {
  if (!FORM_ID || FORM_RO || !DIRTY) return;
  const id = FORM_ID, k = {}; ['keluhan', 'anamnesis', 'pemeriksaan', 'diagnosis', 'tindakan', 'catatan'].forEach(f => k[f] = val('k_' + f));
  const items = JSON.parse(JSON.stringify(ITEMS));
  if (!Object.values(k).some(v => v.trim()) && !items.length) return;
  DIRTY = false;
  try {
    await call('periksaSimpan', { id_antrian: id, k, items, selesai: false, auto: true, biaya: val('k_biaya') }, true);
    const e = $('#asv'); if (e && FORM_ID === id) e.textContent = 'Tersimpan otomatis ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch (err) { DIRTY = true; const e = $('#asv'); if (e) e.textContent = 'Gagal simpan otomatis: ' + err.message; }
}
async function leaveForm() { clearTimeout(AS); if (DIRTY && !FORM_RO) await autoSave(); nav('periksa'); }

// apotek
function pending(ev) { // tombol langsung berputar saat diklik; dipulihkan bila server menolak
  const b = ev && ev.target && ev.target.closest ? ev.target.closest('button') : null; if (!b) return () => {};
  const h = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'; return () => { b.disabled = false; b.innerHTML = h; };
}
async function resepAksi(id, status) {
  const r0 = RS.find(x => x.id === id), undo = pending(window.event);
  try { await guard(call('resepStatus', { id, status }), 'Resep ' + status); } catch (e) { undo(); return; }
  if (status === 'Diserahkan' && r0 && r0.id_antrian && ['Pemilik', AK].includes(U.peran)) { // alur terpadu: apotek → kasir
    modal('Obat diserahkan', `<div><b>${esc(r0.nama_pasien)}</b> — obat sudah diserahkan dan stok berkurang otomatis.</div><div class="small text-muted mt-1">Tagihan (konsul + obat) sudah siap. Lanjut ke pembayaran?</div>`,
      `<button class="btn btn-light" data-bs-dismiss="modal">Nanti</button><button class="btn btn-success" onclick="closeM();setTimeout(()=>{nav('kasir');bayarForm('${r0.id_antrian}')},350)"><i class="bi bi-cash"></i> Bayar Sekarang</button>`);
  }
  VIEWS.apotek();
}
async function revisiForm(id) {
  const r = RS.find(x => x.id === id); if (!r) return;
  OBAT = await call('obatList');
  const opts = OBAT.filter(o => o.aktif !== 'Tidak' && o.stok > 0).map(o => `<option value="${o.id}">${esc(o.nama)} — stok ${o.stok} ${esc(o.satuan)}</option>`).join('');
  modal('Revisi Resep — ' + r.nama_pasien, `<div class="small text-muted mb-2">Ganti obat yang kosong/kurang dengan obat lain yang stoknya tersedia. Nama obat asli dari dokter tetap tercatat.</div>${r.items.map((i, n) => {
    const kurang = i.id_obat && Number(i.stok) < Number(i.jumlah);
    return `<div class="border rounded p-2 mb-2 ${kurang ? 'border-danger' : ''}"><div class="d-flex justify-content-between"><b>${esc(i.nama)}</b>${kurang ? '<span class="badge bg-danger">stok ' + (Number(i.stok) <= 0 ? 'habis' : 'kurang, sisa ' + i.stok) + '</span>' : '<span class="badge bg-success">tersedia</span>'}</div>
    <div class="row g-2 mt-1"><div class="col-md-6"><label class="small">Ganti dengan</label><select id="rv_o${n}" class="form-select form-select-sm"><option value="">— Tidak diganti —</option>${opts}</select></div><div class="col-4 col-md-2"><label class="small">Jumlah</label><input id="rv_j${n}" type="number" min="1" class="form-control form-control-sm" value="${i.jumlah}"></div><div class="col-8 col-md-4"><label class="small">Aturan pakai</label><input id="rv_a${n}" class="form-control form-control-sm" value="${esc(i.aturan)}"></div></div></div>`;
  }).join('')}<label class="small">Alasan revisi *</label><input id="rv_alasan" class="form-control" placeholder="mis. Stok habis, diganti obat sejenis"><div class="alert alert-info small mt-2 mb-0"><i class="bi bi-bell-fill"></i> Dokter pembuat resep otomatis menerima pemberitahuan di dashboard-nya setelah revisi disimpan.</div>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-brand" onclick="revisiSave('${id}')">Simpan Revisi</button>`, 'modal-lg modal-dialog-scrollable');
}
async function revisiSave(id) {
  const r = RS.find(x => x.id === id), items = r.items.map((i, n) => ({ id: i.id, id_obat: val('rv_o' + n), jumlah: val('rv_j' + n), aturan: val('rv_a' + n) }));
  await guard(call('resepRevisi', { id, items, alasan: val('rv_alasan') }), 'Resep direvisi, dokter diberi tahu di dashboard'); closeM(); VIEWS.apotek();
}
function resepBatal(id) { modal('Batalkan resep', '<label>Alasan</label><input id="alasan" class="form-control"><div class="small text-muted mt-2">Jika sudah diserahkan, stok dikembalikan otomatis.</div>', `<button class="btn btn-danger" onclick="doResepBatal('${id}')">Batalkan Resep</button>`); }
async function doResepBatal(id) { await guard(call('resepBatal', { id, alasan: val('alasan') }), 'Resep dibatalkan'); closeM(); VIEWS.apotek(); }
const KATEGORI = ['Antibiotik', 'Antijamur', 'Antihistamin', 'Antivirus', 'Kortikosteroid', 'Pelembap / emolien', 'Antiseptik', 'Analgesik', 'Vitamin / suplemen', 'Lain-lain'];
const SATUAN = ['Tablet', 'Kapsul', 'Tube', 'Botol', 'Sachet', 'Strip', 'Pot', 'Ampul', 'Vial', 'Lain-lain'];
function selLain(id, label, opts, v, req) { // pilihan + kotak isian bila memilih "Lain-lain" (nilai lama di luar daftar otomatis masuk Lain-lain)
  v = v || ''; const ada = opts.slice(0, -1).includes(v), lain = !!v && !ada;
  return `<div class="col-md-6"><label class="small">${label}${req ? ' *' : ''}</label><select id="${id}" class="form-select" onchange="$('#${id}_x').classList.toggle('d-none', this.value !== 'Lain-lain'); if (this.value === 'Lain-lain') $('#${id}_x').focus()"><option value="">— pilih —</option>${opts.map(o => `<option ${(ada && o === v) || (lain && o === 'Lain-lain') ? 'selected' : ''}>${o}</option>`).join('')}</select><input id="${id}_x" class="form-control mt-1 ${lain ? '' : 'd-none'}" placeholder="Tulis ${label.toLowerCase()} lainnya" value="${lain ? esc(v) : ''}"></div>`;
}
const selVal = id => { const s = val(id); return s === 'Lain-lain' ? val(id + '_x').trim() : s; };
function obatForm(id) {
  const o = OBAT.find(x => x.id === id) || {}, f = (i, l, t = 'text', w = 6) => `<div class="col-md-${w}"><label class="small">${l}</label><input type="${t}" id="${i}" class="form-control" value="${esc(o[i.slice(2)] || '')}"></div>`;
  modal(id ? 'Ubah Obat' : 'Obat Baru', `<div class="row g-2">${f('o_nama', 'Nama obat *')}${selLain('o_kategori', 'Kategori', KATEGORI, o.kategori)}${selLain('o_satuan', 'Satuan', SATUAN, o.satuan, true)}${f('o_stok_min', 'Stok minimum *', 'number')}${f('o_harga_beli', 'Harga beli', 'number')}${f('o_harga_jual', 'Harga jual', 'number')}${id ? `<div class="col-md-6"><label class="small">Status</label><select id="o_aktif" class="form-select"><option>Ya</option><option ${o.aktif === 'Tidak' ? 'selected' : ''}>Tidak</option></select></div>` : f('o_stok_awal', 'Stok awal', 'number')}</div>`,
    `<button class="btn btn-brand" onclick="obatSave('${id || ''}')">Simpan</button>`);
}
async function obatSave(id) {
  const o = { id: id || undefined }; ['nama', 'stok_min', 'harga_beli', 'harga_jual', 'stok_awal', 'aktif'].forEach(k => { if ($('#o_' + k)) o[k] = val('o_' + k); });
  o.kategori = selVal('o_kategori'); o.satuan = selVal('o_satuan');
  if (val('o_kategori') === 'Lain-lain' && !o.kategori) return toast('Tulis kategori lainnya', 'warning');
  if (!o.satuan) return toast(val('o_satuan') === 'Lain-lain' ? 'Tulis satuan lainnya' : 'Satuan wajib dipilih', 'warning');
  await guard(call('obatSimpan', o), 'Obat tersimpan'); closeM(); VIEWS.stok();
}

// opname / koreksi stok
function opnameForm(id) {
  const o = OBAT.find(x => x.id === id); if (!o) return;
  modal('Koreksi Stok — ' + o.nama, `<div class="small mb-2">Stok sistem saat ini: <b>${o.stok} ${esc(o.satuan)}</b></div><label class="small">Stok fisik (hasil hitung) *</label><input id="op_f" type="number" min="0" class="form-control" value="${o.stok}"><label class="small mt-2">Alasan selisih *</label><input id="op_a" class="form-control" placeholder="mis. rusak, kedaluwarsa, salah catat"><div class="small text-muted mt-2">Selisih dicatat sebagai mutasi stok jenis Opname dan masuk log audit.</div>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-brand" onclick="opnameSave('${id}')">Simpan Koreksi</button>`);
}
async function opnameSave(id) { await guard(call('stokKoreksi', { id_obat: id, fisik: val('op_f'), alasan: val('op_a') }), 'Stok dikoreksi'); closeM(); VIEWS.stok(); }

// kasir (tagihan kunjungan + penjualan obat langsung)
let JUAL = [];
async function bayarForm(idAn) {
  const t = await guard(call('tagihan', { id_antrian: idAn })); OBAT = await call('obatList'); window._t = t; JUAL = [];
  modal('Pembayaran — ' + t.an.nama_pasien, `<div id="bx_rinci"></div>
    <div class="border rounded p-2 mb-3"><div class="small fw-semibold mb-1"><i class="bi bi-capsule"></i> Tambah penjualan obat (opsional)</div><div class="row g-2"><div class="col-12 col-md-7"><select id="bj_o" class="form-select form-select-sm"><option value="">— pilih obat —</option>${OBAT.filter(o => o.aktif !== 'Tidak' && o.stok > 0).map(o => `<option value="${o.id}">${esc(o.nama)} — ${rp(o.harga_jual)} (stok ${o.stok})</option>`).join('')}</select></div><div class="col-5 col-md-2"><input id="bj_q" type="number" min="1" value="1" class="form-control form-control-sm"></div><div class="col-7 col-md-3"><button class="btn btn-sm btn-outline-secondary w-100" onclick="jualAdd()">+ Tambah</button></div></div></div>
    <div class="row g-2"><div class="col-6"><label class="small">Diskon</label><input type="number" id="bd" class="form-control" value="0" min="0" oninput="bayarTot()"></div><div class="col-6"><label class="small">Metode</label><select id="bm" class="form-select">${(CFG.metode_bayar || 'Tunai').split(',').map(m => `<option>${esc(m.trim())}</option>`).join('')}</select></div><div class="col-12"><label class="small">Catatan diskon</label><input id="bc" class="form-control"></div></div><h4 class="text-end mt-3">Total: <span id="bt"></span></h4>`,
    `<button class="btn btn-success" onclick="bayarSave('${idAn}')"><i class="bi bi-check2-circle"></i> Bayar & Cetak Struk</button>`, 'modal-lg');
  bayarDraw();
}
function bayarDraw() {
  const t = window._t, ob = id => OBAT.find(o => o.id === id) || {};
  const sub = t.subtotal + JUAL.reduce((s, j) => s + (Number(j.jumlah) || 0) * Number(ob(j.id_obat).harga_jual || 0), 0); window._sub = sub;
  $('#bx_rinci').innerHTML = `<table class="table table-sm mb-2">${t.items.map(i => `<tr><td>${esc(i.n)} ×${i.q}</td><td class="text-end">${rp(i.q * i.h)}</td></tr>`).join('')}${
    JUAL.map((j, n) => { const o = ob(j.id_obat); return `<tr><td>${esc(o.nama)} <span class="badge bg-secondary">penjualan</span> × <input type="number" min="1" max="${o.stok}" value="${j.jumlah}" style="width:76px" class="form-control form-control-sm d-inline-block" onchange="JUAL[${n}].jumlah=Math.min(Math.max(1,+this.value||1),${o.stok});bayarDraw()"> <button class="ib dl" title="Hapus" onclick="JUAL.splice(${n},1);bayarDraw()"><i class="bi bi-x-lg"></i></button></td><td class="text-end">${rp((Number(j.jumlah) || 0) * Number(o.harga_jual || 0))}</td></tr>`; }).join('')}${
    !t.items.length && !JUAL.length ? '<tr><td colspan="2" class="text-center text-muted">Belum ada item. Tambahkan obat yang dijual di bawah.</td></tr>' : ''}<tr><th>Subtotal</th><th class="text-end">${rp(sub)}</th></tr></table>`;
  bayarTot();
}
function bayarTot() { const e = $('#bt'); if (e) e.textContent = rp(Math.max(0, (window._sub || 0) - (Number(val('bd')) || 0))); }
function jualAdd() {
  const id = val('bj_o'), q = Number(val('bj_q')) || 0; if (!id) return toast('Pilih obat terlebih dahulu', 'warning'); if (q < 1) return toast('Jumlah minimal 1', 'warning');
  const o = OBAT.find(x => x.id === id), ada = JUAL.find(j => j.id_obat === id), tot = (ada ? Number(ada.jumlah) : 0) + q;
  if (tot > o.stok) return toast('Stok ' + o.nama + ' tidak cukup (sisa ' + o.stok + ')', 'warning');
  if (ada) ada.jumlah = tot; else JUAL.push({ id_obat: id, jumlah: q }); $('#bj_o').value = ''; $('#bj_q').value = 1; bayarDraw();
}
async function bayarSave(idAn) {
  if (!window._t.items.length && !JUAL.length) return toast('Belum ada item untuk ditagih', 'warning');
  const r = await guard(call('bayar', { id_antrian: idAn, diskon: val('bd'), metode: val('bm'), catatan: val('bc'), jual: JUAL })); const it = JSON.parse(r.rincian);
  modal('Struk', `<div class="struk"><div class="text-center"><b>${esc(CFG.nama_praktik)}</b><br>${esc(CFG.alamat)}<hr></div>Tgl: ${tgl(r.tanggal)}<br>Pasien: ${esc(r.nama)}<hr>${it.map(i => `${esc(i.n)} ×${i.q}<span class="float-end">${rp(i.q * i.h)}</span><br>`).join('')}<hr>Subtotal<span class="float-end">${rp(r.subtotal)}</span><br>Diskon<span class="float-end">${rp(r.diskon)}</span><br><b>TOTAL<span class="float-end">${rp(r.total)}</span></b><br>Bayar: ${esc(r.metode)}<br>Kasir: ${esc(r.kasir)}<hr><div class="text-center">Terima kasih</div></div>`,
    '<button class="btn btn-brand" onclick="window.print()"><i class="bi bi-printer"></i> Cetak</button><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>');
  VIEWS.kasir();
}

// pengaturan
/** Kolom Password: ikon mata menampilkan password yang tersimpan (diambil dari server saat diklik, tersembunyi lagi otomatis setelah 20 detik). */
function pwCell(p) {
  if (!p.pw) return '<span class="text-muted small" title="Dibuat sebelum fitur ini sehingga hanya tersimpan sebagai hash. Klik ikon kunci untuk membuat password sementara baru agar bisa dilihat.">belum tersimpan</span>';
  return `<span class="pwt text-nowrap" data-id="${p.id}"><code class="pwv">••••••••</code> <button class="ib" title="Lihat / sembunyikan password" onclick="pwLihat(this)"><i class="bi bi-eye"></i></button><button class="ib" title="Salin password" onclick="pwSalin(this)"><i class="bi bi-clipboard"></i></button><div class="small ${p.pw === 'sementara' ? 'text-warning' : 'text-muted'}">${p.pw === 'sementara' ? 'sementara, belum diganti' : 'diubah ' + esc(p.pwt || '')}</div></span>`;
}
function pwSembunyi(s) { const v = s.querySelector('.pwv'); v.textContent = '••••••••'; v.dataset.s = '0'; delete s.dataset.pw; }
async function pwLihat(b) {
  const s = b.closest('.pwt'), v = s.querySelector('.pwv'); if (v.dataset.s === '1') return pwSembunyi(s);
  const r = await guard(call('penggunaLihatPassword', { id: s.dataset.id })); s.dataset.pw = r.password; v.textContent = r.password; v.dataset.s = '1';
  setTimeout(() => { if (v.dataset.s === '1') pwSembunyi(s); }, 20000);
}
async function pwSalin(b) { const s = b.closest('.pwt'); let pw = s.dataset.pw; if (!pw) { const r = await guard(call('penggunaLihatPassword', { id: s.dataset.id })); pw = r.password; } copyText(pw); }
function penggunaForm(p) {
  p = p || {}; modal(p.id ? 'Ubah Pengguna' : 'Pengguna Baru', `<label class="small">Nama *</label><input id="un" class="form-control" value="${esc(p.nama)}"><label class="small mt-2">Username *</label><input id="ue" class="form-control" autocapitalize="none" value="${esc(p.username)}"><div class="form-text">Huruf kecil, angka, titik, strip (3-30 karakter)</div>${pwField('upw', 'Password ' + (p.id ? '(kosongkan jika tidak diubah)' : '*'))}<label class="small mt-2">Peran *</label><select id="up" class="form-select">${['Pemilik', 'Pendaftaran', 'Dokter', AK].map(r => `<option ${r === p.peran ? 'selected' : ''}>${r}</option>`).join('')}</select><label class="small mt-2">No. SIP (dokter)</label><input id="us" class="form-control" value="${esc(p.sip)}"><label class="small mt-2">Aktif</label><select id="ua" class="form-select"><option>Ya</option><option ${p.aktif === 'Tidak' ? 'selected' : ''}>Tidak</option></select>`,
    `<button class="btn btn-brand" onclick="penggunaSave('${p.id || ''}')">Simpan</button>`);
}
async function penggunaSave(id) { await guard(call('penggunaSimpan', { id: id || undefined, nama: val('un'), username: val('ue').trim(), password: val('upw'), peran: val('up'), sip: val('us'), aktif: val('ua') }), 'Pengguna tersimpan'); DOK = await call('dokterList', {}, true); closeM(); VIEWS.pengaturan(); }
function dokterForm(d) {
  d = d || {}; modal(d.id ? 'Ubah Dokter' : 'Dokter Baru', `<label class="small">Nama lengkap + gelar *</label><input id="dn" class="form-control" value="${esc(d.nama)}"><label class="small mt-2">No. SIP</label><input id="ds" class="form-control" value="${esc(d.sip)}">${d.id ? `<label class="small mt-2">Status</label><select id="da" class="form-select"><option>Ya</option><option ${d.aktif === 'Tidak' ? 'selected' : ''}>Tidak</option></select>` : ''}`,
    `<button class="btn btn-brand" onclick="dokterSave('${d.id || ''}')">Simpan</button>`);
}
async function dokterSave(id) {
  await guard(call('dokterSimpan', { id: id || undefined, nama: val('dn'), sip: val('ds'), aktif: id ? val('da') : undefined }), 'Dokter tersimpan');
  DOK = await call('dokterList'); closeM(); VIEWS.pengaturan();
}
// ═══ TOOLBAR TABEL: CSV / Excel / Cetak / Visibilitas / PDF ═══
const HIDDEN = {};
const tbBar = () => `<div class="tb-bar"><button class="btn btn-sm tb-csv" onclick="tbDo('csv')"><i class="bi bi-filetype-csv"></i> Ekspor ke CSV</button><button class="btn btn-sm tb-xls" onclick="tbDo('xls')"><i class="bi bi-file-earmark-excel"></i> Ekspor ke Excel</button><button class="btn btn-sm tb-prt" onclick="tbDo('print')"><i class="bi bi-printer"></i> Cetak</button><button class="btn btn-sm tb-vis" onclick="tbDo('vis')"><i class="bi bi-layout-three-columns"></i> Visibilitas</button><button class="btn btn-sm tb-pdf" onclick="tbDo('pdf')"><i class="bi bi-file-earmark-pdf"></i> Ekspor ke PDF</button></div>`;
function tbApply() {
  document.querySelectorAll('table[data-tb]').forEach(t => { const h = HIDDEN[t.dataset.tb] || [];
    t.querySelectorAll('tr').forEach(tr => { if (tr.cells.length < 2) return; [...tr.cells].forEach((c, i) => c.style.display = h.includes(i) ? 'none' : ''); }); });
}
new MutationObserver(tbApply).observe($('#view'), { childList: true });
function tbData() {
  const t = $('#tb'); if (!t) return null;
  const ths = [...t.querySelectorAll('thead th')], h = HIDDEN[t.dataset.tb] || [];
  const idx = ths.map((th, i) => i).filter(i => !ths[i].classList.contains('noexp') && !h.includes(i));
  return { name: t.dataset.tb, head: idx.map(i => ths[i].textContent.trim()),
    rows: [...t.querySelectorAll('tbody tr')].filter(tr => tr.cells.length > 1).map(tr => idx.map(i => (tr.cells[i].innerText || '').replace(/\s*\n\s*/g, ' | ').trim())), ths };
}
function tbSave(blob, fn) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
async function tbDo(kind) {
  const d = tbData(); if (!d) return;
  const fn = d.name + '_' + (CFG.today || '');
  if (kind === 'vis') {
    return modal('Visibilitas Kolom', d.ths.map((th, i) => th.classList.contains('noexp') ? '' :
      `<div class="form-check"><input class="form-check-input" type="checkbox" id="vc${i}" ${(HIDDEN[d.name] || []).includes(i) ? '' : 'checked'} onchange="tbVis('${d.name}',${i},this.checked)"><label class="form-check-label" for="vc${i}">${esc(th.textContent.trim())}</label></div>`).join(''),
      `<button class="btn btn-light" onclick="HIDDEN['${d.name}']=[];tbApply();closeM()">Tampilkan semua</button><button class="btn btn-brand" data-bs-dismiss="modal">Selesai</button>`, 'modal-sm');
  }
  if (!d.rows.length) return toast('Tidak ada data untuk diekspor', 'warning');
  try {
    if (kind === 'csv') tbSave(new Blob(['\ufeff' + [d.head, ...d.rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), fn + '.csv');
    else if (kind === 'xls') { await lib('xlsx'); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([d.head, ...d.rows]), d.name.slice(0, 31)); XLSX.writeFile(wb, fn + '.xlsx'); }
    else if (kind === 'pdf') { await lib('pdf'); const doc = new jspdf.jsPDF({ orientation: d.head.length > 5 ? 'landscape' : 'portrait' });
      doc.setFontSize(12); doc.text((CFG.nama_praktik || '') + ' — ' + d.name.replace(/_/g, ' '), 14, 14); doc.setFontSize(9); doc.text('Dicetak: ' + new Date().toLocaleString('id-ID'), 14, 20);
      doc.autoTable({ head: [d.head], body: d.rows, startY: 25, styles: { fontSize: 8 }, headStyles: { fillColor: [11, 134, 214] } }); doc.save(fn + '.pdf'); }
    else if (kind === 'print') { const c = $('#tb').closest('.card'); c.classList.add('pt-target'); window.print(); setTimeout(() => c.classList.remove('pt-target'), 800); }
  } catch (e) { toast(e.message, 'danger'); }
}
function tbVis(name, i, on) { const h = HIDDEN[name] = (HIDDEN[name] || []).filter(x => x !== i); if (!on) h.push(i); tbApply(); }

function resetKonfirm(id) {
  const o = PG.find(x => x.id === id); if (!o) return;
  modal('Reset Password', `<p>Buat password sementara untuk <b>${esc(o.nama)}</b> (${esc(o.username)})?</p><div class="small text-muted">Password lama tidak berlaku lagi, dan pengguna wajib menggantinya saat masuk berikutnya.</div>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-warning" onclick="resetDo('${id}')"><i class="bi bi-key-fill"></i> Buat Password Sementara</button>`);
}
async function resetDo(id) {
  const r = await guard(call('penggunaReset', { id }));
  modal('Password Sementara', `<p class="mb-2">Berikan kepada <b>${esc(r.nama)}</b>:</p><div class="p-3 text-center rounded" style="background:var(--soft)"><div class="small text-muted">Username: <b>${esc(r.username)}</b></div><div class="fs-3 fw-bold" style="letter-spacing:2px">${esc(r.password)}</div></div><div class="small text-danger mt-2">Password ini hanya ditampilkan sekali.</div>`,
    `<button class="btn btn-brand" onclick="copyText('${esc(r.password)}')"><i class="bi bi-clipboard"></i> Salin</button><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>`);
}
async function kodeBuat(awal) {
  const r = await guard(call('kodePemulihanBuat'));
  modal(awal ? 'Simpan Kode Pemulihan Anda' : 'Kode Pemulihan', `<p class="mb-2">${awal ? '<b>Kode pemulihan Pemilik diperbarui otomatis</b> agar bisa dilihat kembali kapan saja di Pengaturan → Keamanan Akun. Kode lama (bila ada) tidak berlaku lagi. ' : ''}Simpan di tempat aman (catat, foto, atau unduh). Dipakai di halaman masuk → <b>Lupa password?</b> bila Pemilik lupa password.</p><div class="p-3 text-center rounded fs-3 fw-bold" style="background:var(--soft);letter-spacing:2px;user-select:all">${esc(r.kode)}</div><div class="small text-muted mt-2">Kode lama tidak berlaku lagi. Kode ini bisa dilihat lagi lewat tombol “Lihat Kode Saat Ini”. Setelah dipakai untuk reset password, sistem otomatis membuat kode baru.</div>`,
    `<button class="btn btn-brand" onclick="copyText('${esc(r.kode)}')"><i class="bi bi-clipboard"></i> Salin</button><button class="btn btn-outline-secondary" onclick="unduhKode('${esc(r.kode)}')"><i class="bi bi-download"></i> Unduh</button><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>`);
  if (V === 'pengaturan') setTimeout(() => { if (V === 'pengaturan') VIEWS.pengaturan().catch(() => {}); }, 300);
}
async function kodeLihat() {
  const r = await guard(call('kodePemulihanLihat'));
  modal('Kode Pemulihan Saat Ini', r.kode ? `<div class="p-3 text-center rounded fs-3 fw-bold" style="background:var(--soft);letter-spacing:2px;user-select:all">${esc(r.kode)}</div><div class="small text-muted mt-2">Dibuat ${r.dibuat ? tgl(r.dibuat) : '-'}. Hanya Pemilik yang dapat melihatnya (tercatat di log audit). Gunakan di halaman masuk → Lupa password?</div>`
    : '<div class="alert alert-warning mb-0">Kode yang berlaku dibuat dengan format lama dan tidak dapat ditampilkan. Klik <b>Buat Kode Baru</b> untuk membuat kode yang bisa dilihat kapan saja.</div>',
    r.kode ? `<button class="btn btn-brand" onclick="copyText('${esc(r.kode)}')"><i class="bi bi-clipboard"></i> Salin</button><button class="btn btn-outline-secondary" onclick="unduhKode('${esc(r.kode)}')"><i class="bi bi-download"></i> Unduh</button><button class="btn btn-light" data-bs-dismiss="modal">Tutup</button>` : '');
}
function hapusKonfirm(jenis, id) {
  const o = (jenis === 'pengguna' ? PG : DKL).find(x => x.id === id); if (!o) return;
  modal('Hapus ' + (jenis === 'pengguna' ? 'Pengguna' : 'Dokter'), `<p>Hapus <b>${esc(o.nama)}</b> secara permanen?</p><div class="small text-muted">Rekam medis, antrian, dan transaksi yang sudah ada tetap tersimpan. Jika hanya ingin menghentikan akses, gunakan <b>Ubah → Aktif: Tidak</b>.</div>`,
    `<button class="btn btn-light" data-bs-dismiss="modal">Batal</button><button class="btn btn-danger" onclick="hapusDo('${jenis}','${id}')"><i class="bi bi-trash"></i> Ya, Hapus</button>`);
}
async function hapusDo(jenis, id) {
  await guard(call(jenis === 'pengguna' ? 'penggunaHapus' : 'dokterHapus', { id }), 'Data dihapus');
  DOK = await call('dokterList'); closeM(); VIEWS.pengaturan();
}
async function cfgSave() { const a = {}; ['nama_praktik', 'alamat', 'metode_bayar'].forEach(k => a[k] = val('cfg_' + k)); await guard(call('pengaturanSimpan', a), 'Pengaturan tersimpan'); Object.assign(CFG, a); $('#brandName').textContent = CFG.nama_praktik; }
async function tarifSave(id) { await guard(call('tarifSimpan', { id, nama: val('tn_' + id), harga: val('th_' + id) }), 'Tarif tersimpan'); }
