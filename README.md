# Aplikasi Apotek & Praktik Mandiri Dokter Spesialis Kulit dan Kelamin — Frontend

Frontend statis (HTML/CSS/JS murni) yang berjalan di **GitHub Pages** dan berbicara dengan backend **Google Apps Script** lewat `fetch()` (REST API JSON). Data pasien tidak disimpan di repository ini; semuanya ada di Google Sheets milik Anda.

## Struktur

```
index.html        ← kerangka halaman (harus berada di root repository)
css/style.css     ← seluruh gaya tampilan
js/config.js      ← ✏️ satu-satunya berkas yang WAJIB diedit: isi GAS_URL
js/api.js         ← lapisan fetch ke Apps Script (pengganti google.script.run)
js/app.js         ← logika aplikasi & semua halaman
PANDUAN-INSTALASI.md
```

## Mulai cepat

1. Pasang backend (`Kode.gs`) di Apps Script dan deploy sebagai Web App (**Execute as: Me**, **Who has access: Anyone**).
2. Salin URL berakhiran `/exec` ke `js/config.js` → `const GAS_URL = '…';`
3. Dari folder ini (yang langsung berisi `index.html`): `git init` → `git add .` → `git commit` → `git push`, lalu aktifkan **Settings → Pages → main / (root)**.

Langkah lengkap, troubleshooting, dan panduan Git untuk pemula: lihat **PANDUAN-INSTALASI.md**.

## Catatan teknis

- Semua permintaan memakai `POST` dengan `Content-Type: text/plain;charset=utf-8` agar tidak memicu preflight CORS (Apps Script tidak menjawab `OPTIONS`).
- Token sesi disimpan di `sessionStorage` / `localStorage` dengan awalan kunci `apk_`.
- Pustaka (Bootstrap, Bootstrap Icons, Chart.js, SheetJS, jsPDF) dimuat dari CDN jsDelivr.
- `css/style.css` direkonstruksi dari kelas yang dipakai aplikasi; bila Anda punya `Stylesheet.html` asli, tempelkan isi di antara `<style>…</style>` ke berkas ini.
