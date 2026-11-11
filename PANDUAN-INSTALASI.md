# 📋 PANDUAN INSTALASI — Aplikasi Apotek & Praktik Mandiri Dokter Spesialis Kulit dan Kelamin

**Versi 2.0 — Backend Google Apps Script (REST API) + Frontend GitHub Pages**

Dokumen ini memandu Anda memasang aplikasi dari nol, langkah demi langkah, tanpa perlu pengalaman pemrograman. Baca urut dari atas. Setiap bagian diakhiri dengan cara memastikan langkahnya berhasil.

---

## 0. Gambaran Singkat

Sebelumnya aplikasi berjalan **seluruhnya di Google Apps Script** (halaman dan data di satu tempat). Sekarang dipisah menjadi dua bagian:

```
┌──────────────────────────────────────────────┐
│  FRONTEND — GitHub Pages                     │
│  https://USERNAME.github.io/apotek-praktik-dokter/
│  index.html + css/style.css + js/*.js        │
│  (tampilan saja; tidak menyimpan data pasien)│
└───────────────────┬──────────────────────────┘
                    │  fetch() — JSON lewat HTTPS
                    ▼
┌──────────────────────────────────────────────┐
│  BACKEND — Google Apps Script (Kode.gs)      │
│  URL Web App berakhiran  /exec               │
│  Login, cek peran, logika apotek & kasir     │
└───────────────────┬──────────────────────────┘
                    ▼
┌──────────────────────────────────────────────┐
│  Google Sheets (database) + Google Drive     │
│  (backup harian)  → milik akun Google Anda  │
└──────────────────────────────────────────────┘
```

**Semua data pasien tetap berada di Google Sheets/Drive Anda.** GitHub hanya menyimpan file tampilan (HTML/CSS/JS) yang tidak berisi data apa pun.

### Berkas yang Anda terima

| Berkas | Untuk apa | Cara memakainya |
|---|---|---|
| `Kode.gs` | Backend (REST API) | **Disalin-tempel** ke editor Apps Script (Bagian A) |
| `appsscript.json` | Pengaturan proyek (zona waktu, akses) | *Opsional tapi disarankan* — disalin-tempel (Bagian A) |
| `apotek-praktik-dokter-frontend.zip` | Frontend | **Diekstrak**, lalu diunggah ke GitHub lewat terminal (Bagian B) |
| `PANDUAN-INSTALASI.md` | Dokumen ini | Dibaca (satu salinan juga ada di dalam ZIP) |

> ⚠️ **Berkas backend (`Kode.gs`, `appsscript.json`) sengaja TIDAK ada di dalam ZIP.** Berkas itu hanya untuk Apps Script, bukan untuk GitHub.

### Yang berubah dibanding versi lama

| Hal | Sekarang |
|---|---|
| Alamat aplikasi | Alamat **GitHub Pages** (`https://USERNAME.github.io/...`). Alamat Apps Script lama tidak lagi menampilkan aplikasi — hanya menjawab data JSON. **Beri tahu seluruh staf alamat barunya.** |
| Tombol "Saya pemilik skrip: atur ulang tanpa kode" | **Dihapus** (identitas akun Google tidak terbaca lagi lewat REST). Gantinya: **Kode Pemulihan**, atau jalankan fungsi `resetPasswordPemilik` di editor Apps Script (lihat Bagian F). |
| Pengaturan WhatsApp/Fonnte | Sudah dihapus (versi 1.2). Pemberitahuan ke dokter lewat dashboard dokter. |
| Folder Drive | `setupAppEnvironment()` kini membuat folder **📁 Praktek Mandiri Dokter Spesialis** (berisi subfolder 📂 Backup) dan sheet **AppConfig** yang mencatat semua ID. |
| Keamanan endpoint | Daftar fungsi yang boleh dipanggil kini dicek ketat (`constructor`, `toString`, dll. ditolak). |
| Pembaruan otomatis | Berhenti sendiri saat tab browser tidak terlihat (hemat kuota Apps Script). |

---

## 1. Persiapan Akun

Anda membutuhkan:

1. **Akun Google** (yang akan memiliki database & backup). Disarankan akun khusus praktik, bukan akun pribadi.
2. **Akun GitHub** gratis — daftar di <https://github.com>. ⚠️ *Username yang Anda pilih menjadi bagian alamat aplikasi* (`username.github.io`), jadi pilih dengan sadar.
3. Komputer Windows / Mac / Linux dengan koneksi internet.

---

# BAGIAN A — BACKEND (Google Apps Script)

Pilih **satu** jalur:

| Jalur | Pilih bila… |
|---|---|
| **A1 — Instalasi baru** | Belum punya data, atau ingin mulai bersih. |
| **A2 — Pertahankan data lama** | Aplikasi versi sebelumnya sudah dipakai dan datanya harus dilanjutkan. |

## A1. Instalasi baru

### A1.1 — Buat proyek
1. Buka <https://script.google.com> dan login dengan akun Google tadi.
2. Klik **Proyek baru** (*New project*).
3. Klik nama proyek "Untitled project" di kiri atas → ganti menjadi `Praktek Dokter API` → **Rename**.

### A1.2 — Tempel kode backend
1. Di panel kiri, klik berkas `Code.gs` → ganti namanya menjadi `Kode` (klik ⋮ di samping → **Rename**).
2. Hapus seluruh isi editor (Ctrl+A lalu Delete).
3. Buka `Kode.gs` yang Anda terima dengan Notepad, **salin semua isinya** (Ctrl+A, Ctrl+C), lalu **tempel** ke editor (Ctrl+V).
4. Klik ikon 💾 **Save** (atau Ctrl+S).

### A1.3 — Pengaturan proyek (zona waktu & akses) — *disarankan*
Zona waktu penting agar backup harian berjalan pukul **23.00 WITA**.

1. Klik ⚙ **Project Settings** (roda gigi, kiri bawah).
2. Centang **Show "appsscript.json" manifest file in editor**.
3. Kembali ke **Editor** (ikon `< >`). Di panel kiri muncul berkas `appsscript.json` — klik berkas itu.
4. Hapus isinya, lalu tempel seluruh isi `appsscript.json` yang Anda terima. **Save**.

### A1.4 — Jalankan setup (SEKALI)
Langkah ini membuat database (Google Sheets), folder di Drive, semua sheet, dan akun awal.

1. Di bagian atas editor, pada kotak pilihan fungsi, pilih **`setupAppEnvironment`**.
2. Klik **▶ Run**.
3. Muncul **Authorization required** → klik **Review permissions** → pilih akun Anda.
4. Muncul peringatan **"Google hasn't verified this app"** — ini **normal** untuk skrip buatan sendiri. Klik **Advanced** → **Go to Praktek Dokter API (unsafe)** → **Allow**.
5. Tunggu hingga **Execution log** (panel bawah) menampilkan baris `✅ Setup selesai.`
6. **Catat dua hal dari log ini** (hanya tampil sekarang):

   ```
   🔑 LOGIN AWAL → username: admin | password: xxxxxxxx
   🛟 KODE PEMULIHAN (simpan, hanya tampil sekali): XXXX-XXXX-XXXX
   ```
   Simpan di tempat aman (catatan, foto, atau pengelola kata sandi). Setelah login, kode pemulihan juga dapat dilihat Pemilik di **Pengaturan → Keamanan Akun**.

✅ **Cek hasilnya:**
- Buka <https://drive.google.com>: ada folder **📁 Praktek Mandiri Dokter Spesialis** berisi spreadsheet **🗃️ Database — …** dan folder **📂 Backup**.
- Buka spreadsheet itu: ada sheet `AppConfig` (daftar ID), `Pengguna`, `Pasien`, `Resep`, `Obat`, dst.

> ℹ️ Fungsi ini **aman bila terjalankan lagi** (tidak menggandakan folder/database, tidak menghapus data). Tetap, cukup sekali.

→ Lanjut ke **A3 — Deploy**.

## A2. Pertahankan data lama

> 🛟 **Buat cadangan dulu.** Buka spreadsheet database lama → **File → Make a copy**. Salinan itu (beserta skripnya) adalah jaring pengaman Anda.

1. Buka spreadsheet database lama → menu **Ekstensi → Apps Script** (*Extensions → Apps Script*). Ini membuka proyek lama Anda.
2. Klik berkas `Kode.gs`, **hapus seluruh isinya**, tempel `Kode.gs` baru, **Save**.
3. **Hapus** tiga berkas tampilan yang tidak dipakai lagi: `Index`, `JavaScript`, `Stylesheet` (klik ⋮ di sampingnya → **Delete**).
4. *(Disarankan)* Lakukan langkah **A1.3** (pengaturan proyek) di proyek ini.
5. Pilih fungsi **`setupAppEnvironment`** → **▶ Run**. Ini menambah kolom baru yang dibutuhkan (mis. pemberitahuan dokter), membuat sheet `AppConfig`, dan mencatat ID — **tanpa menghapus data**. Bila Google meminta izin lagi, izinkan seperti A1.4 poin 3–4.
   - Bila log menampilkan "LOGIN AWAL", berarti sheet `Pengguna` kosong. Pada pemasangan lama, ini **tidak** muncul karena akun sudah ada.
   - Folder backup lama (**Backup Praktek Dokter**) tetap dipakai.

→ Lanjut ke **A3 — Deploy** (di sini Anda **memperbarui deployment lama**, bukan membuat baru — alamat `/exec` tetap sama).

### A2-alt. Proyek baru, tetapi memakai spreadsheet lama
Bila Anda ingin proyek Apps Script baru yang terpisah namun database lama dipakai:
1. Lakukan A1.1 – A1.3.
2. **Project Settings (⚙) → Script Properties → Add script property**: nama `SPREADSHEET_ID`, nilai = ID spreadsheet lama (potongan acak panjang di URL spreadsheet: `docs.google.com/spreadsheets/d/`**`INI_ID_NYA`**`/edit`). **Save**.
3. Jalankan `setupAppEnvironment` (A1.4).
4. ⚠️ Yang **tidak** terbawa: password yang dapat dilihat Pemilik di Pengaturan, dan status "Tetap masuk" perangkat. Password pengguna **tetap berlaku**; semua orang cukup login ulang.

## A3. Deploy sebagai Web App

1. Klik tombol biru **Deploy** (kanan atas) →
   - Jalur A1: **New deployment**
   - Jalur A2: **Manage deployments** → klik ✏️ (edit) pada deployment yang ada → pada **Version** pilih **New version**.
2. Klik ⚙ di samping "Select type" → pilih **Web app**.
3. Isi:

   | Kolom | Nilai |
   |---|---|
   | Description | `Aplikasi Apotek v2.0` |
   | **Execute as** | **Me** (akun Anda) |
   | **Who has access** | **Anyone** ← *bukan* "Anyone with Google account" |

   > ❗ **Harus "Anyone".** Bila dipilih "Anyone with Google account", browser dari GitHub Pages akan gagal dengan error CORS. "Anyone" **tidak** berarti data terbuka untuk umum — setiap operasi tetap wajib login dengan username & password.
4. Klik **Deploy** → (izinkan akses bila diminta) → **Salin "Web app URL"**. Bentuknya:
   ```
   https://script.google.com/macros/s/AKfycbx…(panjang)…/exec
   ```
   Tempel dulu di Notepad; Anda akan memakainya di Bagian B.

### A4. Uji backend
Tempel URL tadi di browser, tambahkan `?action=ping` di ujungnya, lalu Enter:

```
https://script.google.com/macros/s/AKfycbx…/exec?action=ping
```

✅ Berhasil bila muncul teks seperti:
```json
{"success":true,"data":{"app":"Praktek Mandiri Dokter Spesialis","api":"2.0","waktu":"…","database_siap":true}}
```
❌ Bila muncul halaman login Google atau "Sorry, unable to open the file" → lihat Bagian G (Troubleshooting).

---

# BAGIAN B — FRONTEND (GitHub Pages)

> 🗂️ **Aturan emas Bagian ini:** GitHub Pages hanya melihat `index.html` yang berada **tepat di akar (root)** repository. Jika `git init` dijalankan di folder yang salah, situs akan **404 tanpa pesan error apa pun**. Karena itu ada **gerbang verifikasi** di langkah B5.

## B1. Ekstrak ZIP

1. Simpan `apotek-praktik-dokter-frontend.zip` (mis. ke folder **Documents**).
2. Klik kanan → **Extract All… / Ekstrak semua** → **Extract**.
3. Hasilnya folder **`apotek-praktik-dokter-frontend`**. Buka folder itu — Anda harus **langsung** melihat `index.html` di dalamnya, bukan folder lain:

   ```
   apotek-praktik-dokter-frontend\          ← INI folder kerja Anda
   ├── index.html
   ├── README.md
   ├── PANDUAN-INSTALASI.md
   ├── css\
   │   └── style.css
   └── js\
       ├── config.js
       ├── api.js
       └── app.js
   ```

   > Kalau Anda membuka folder itu dan yang tampak justru **satu folder lagi** di dalamnya (mis. `apotek-praktik-dokter-frontend\apotek-praktik-dokter-frontend\`), masuklah ke folder dalam itu. **Folder kerja adalah folder yang langsung berisi `index.html`.**

Dalam panduan ini kita sebut jalurnya contohnya:
```
C:\Users\NAMA\Documents\apotek-praktik-dokter-frontend
```
(Ganti `NAMA` dengan nama pengguna Windows Anda. Itu **satu-satunya folder** tempat perintah `git init` nanti dijalankan.)

## B2. Isi alamat backend di `js/config.js` ⚠️ WAJIB SEBELUM PUSH

1. Buka `js\config.js` dengan **Notepad** (klik kanan → Open with → Notepad).
2. Cari baris:
   ```js
   const GAS_URL = 'PASTE_URL_EXEC_DI_SINI';
   ```
3. Ganti `PASTE_URL_EXEC_DI_SINI` dengan **Web app URL** dari A3 — pertahankan tanda kutip `'…'` di kiri-kanannya dan titik koma di akhir:
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/AKfycbx…/exec';
   ```
4. **File → Save** (Ctrl+S). Pastikan namanya tetap `config.js` (bukan `config.js.txt`).

> 💡 URL ini bukan rahasia dan aman berada di repository publik: tanpa login, orang tidak bisa membaca atau mengubah data apa pun.

## B3. Pasang Git (sekali per komputer)

- **Windows:** unduh dari <https://git-scm.com/download/win>, jalankan installer, klik **Next** terus (pengaturan bawaan sudah benar).
- **Mac:** buka **Terminal**, ketik `git --version`; bila belum ada, macOS menawarkan pemasangan otomatis.
- **Linux (Debian/Ubuntu):** `sudo apt install git`.

Buka **PowerShell** (Windows: Start → ketik "PowerShell") atau Terminal, lalu cek:
```bash
git --version
```
✅ Harus muncul sesuatu seperti `git version 2.4x.x`.

Lalu atur identitas Anda (sekali saja):
```bash
git config --global user.name "Nama Lengkap Anda"
git config --global user.email "email@sama-dengan-akun-github.com"
```
`user.name` bebas (hanya label di riwayat perubahan; bukan username GitHub). `user.email` sebaiknya sama dengan email akun GitHub.

## B4. Buat repository di GitHub

1. Login ke <https://github.com> → klik **+** (kanan atas) → **New repository**.
2. Isi:
   - **Repository name:** `apotek-praktik-dokter`
   - **Public** ✅ (wajib agar GitHub Pages gratis)
   - **JANGAN** centang *Add a README*, *.gitignore*, atau *license*.
3. Klik **Create repository**. Biarkan halaman petunjuk berikutnya terbuka — Anda akan membutuhkan alamat repo-nya:
   ```
   https://github.com/USERNAME/apotek-praktik-dokter.git
   ```

> **Kenapa Public?** GitHub Pages gratis hanya untuk repository publik. Ini aman karena repository hanya berisi file tampilan tanpa data pasien dan tanpa kata sandi.

## B5. Buka terminal DI FOLDER KERJA + verifikasi (gerbang penting)

**Cara tercepat di Windows:** buka folder `apotek-praktik-dokter-frontend` di File Explorer → klik **address bar** (kotak alamat di atas) → ketik `powershell` → **Enter**. PowerShell langsung terbuka di folder yang benar.

Atau manual:
```powershell
cd "C:\Users\NAMA\Documents\apotek-praktik-dokter-frontend"
```
(Mac/Linux: `cd ~/Documents/apotek-praktik-dokter-frontend`)

Sekarang lihat isinya:
```powershell
dir
```
(Mac/Linux: `ls -la`)

**Wajib terlihat:** `index.html`, folder `css`, folder `js`.

| Yang Anda lihat | Artinya | Tindakan |
|---|---|---|
| `index.html`, `css`, `js`, `README.md` | ✅ Benar | Lanjut B6 |
| Hanya satu folder (mis. `apotek-praktik-dokter-frontend`) | Terlalu tinggi satu tingkat | `cd` ke folder itu, ulangi `dir` |
| Ada file `.gs` (`Kode.gs`) | Backend ikut terbawa | Pindahkan/hapus file `.gs` dari folder ini |
| `style.css`, `app.js` bertebaran tanpa folder `css`/`js` | Struktur rusak | Ekstrak ulang ZIP asli |

> ⛔ **Jangan lanjut sebelum `index.html` terlihat di hasil `dir`.** Git menerima folder yang salah tanpa protes.

## B6. Unggah pertama (push) — jalankan satu per satu

**6a. Inisialisasi:**
```bash
git init
```
→ `Initialized empty Git repository in …`

**6b. Masukkan semua berkas** (perhatikan **titik** di akhir):
```bash
git add .
```
→ tidak ada keluaran = berhasil. Peringatan `LF will be replaced by CRLF` boleh **diabaikan**.

**6c. Simpan (commit):**
```bash
git commit -m "Upload pertama"
```
→ muncul daftar `create mode 100644 index.html`, dst.

**6d. Beri nama cabang `main`:**
```bash
git branch -M main
```

**6e. Sambungkan ke GitHub** (ganti `USERNAME`):
```bash
git remote add origin https://github.com/USERNAME/apotek-praktik-dokter.git
```
(Bila muncul `remote origin already exists`: `git remote set-url origin https://github.com/USERNAME/apotek-praktik-dokter.git`)

**6f. Kirim:**
```bash
git push -u origin main
```
Anda akan diminta:
- **Username:** username GitHub Anda
- **Password:** tempel **Personal Access Token** (bukan password akun) — cara membuatnya di bawah.

> 💡 Saat menempel token, **layar tampak kosong** — tidak ada huruf atau bintang. Ini **normal**. Windows PowerShell: klik kanan untuk paste; Git Bash: Shift+Insert. Lalu **Enter**.

✅ Berhasil bila muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### Membuat Personal Access Token (bila diminta)
GitHub menolak password akun biasa untuk `git push` (`Password authentication is not supported`). Itu bukan kerusakan.
1. Buka <https://github.com/settings/tokens> → **Generate new token** → **Generate new token (classic)**.
2. **Note:** `git-push`; **Expiration:** 90 days; centang ✅ **repo**.
3. **Generate token** → **salin** token (`ghp_…`) — hanya tampil sekali; simpan di Notepad.
4. Ulangi `git push -u origin main`, tempel token sebagai password.

*Alternatif visual:* **GitHub Desktop** (<https://desktop.github.com>) → login → **Add Local Repository** → pilih folder kerja → **Publish repository**.

## B7. Aktifkan GitHub Pages

1. Buka `https://github.com/USERNAME/apotek-praktik-dokter`. **Pastikan** `index.html` terlihat di daftar paling atas, bersama folder `css` dan `js` (dan **tidak** ada `Kode.gs`).
2. Tab **Settings** → di sidebar kiri pilih **Pages**.
3. **Source:** *Deploy from a branch* · **Branch:** `main` · folder `/ (root)` → **Save**.
4. Tunggu 1–2 menit, muat ulang halaman. Muncul: *"Your site is live at `https://USERNAME.github.io/apotek-praktik-dokter/`"*. Centang **Enforce HTTPS** bila tersedia.

🎉 **Itulah alamat aplikasi Anda.** Bagikan kepada dokter dan staf, dan simpan sebagai *bookmark* / "Add to Home Screen" di ponsel.

---

# BAGIAN C — Uji Menyeluruh

Buka alamat aplikasi, lalu:

| # | Uji | Hasil yang benar |
|---|---|---|
| 1 | Halaman terbuka | Tampil halaman **Masuk Aplikasi** berlatar biru. Bila muncul "URL backend belum diisi" → ulangi B2. |
| 2 | Login `admin` + password awal (A1.4) | Masuk ke Beranda. Segera ganti password lewat ikon 🔑 di kanan atas. |
| 3 | Buka semua menu | Beranda, Pendaftaran & Antrian, Pemeriksaan, Resep & Apotek, Stok Obat, Kerja Sama PBF, Kasir, Laporan Kas, Pengaturan — tanpa pesan "Halaman tidak dapat dimuat". |
| 4 | Pengaturan → Pengguna → **+ Tambah** | Buat akun Dokter, Pendaftaran, dan "Apotek dan Kasir". Nama akun Dokter harus **sama persis** dengan nama di Daftar Dokter. |
| 5 | Daftarkan pasien uji → periksa → resep → serahkan → bayar | Data muncul juga di Google Sheets (`Pasien`, `Kunjungan`, `Resep`, `Transaksi`). |
| 6 | Revisi resep oleh apotek | Dokter menerima notifikasi di dashboard-nya. |
| 7 | Keluar, lalu login ulang | Berhasil. Centang **Tetap masuk** hanya di perangkat pribadi. |
| 8 | Tekan **F12 → Console** | Tidak ada tulisan merah soal *CORS*. |

> 🧪 Hapus data uji setelahnya, atau mulai dengan instalasi baru (A1) untuk produksi.

---

# BAGIAN D — Memperbarui Aplikasi Nanti

### Mengubah tampilan / frontend (HTML, CSS, JS)
Edit berkas, lalu dari **folder kerja** (B5) jalankan:
```bash
git add .
git commit -m "Deskripsi singkat perubahan"
git push
```
GitHub Pages memperbarui otomatis dalam 1–2 menit. Bila masih tampil versi lama: **Ctrl+Shift+R** (hard refresh) atau buka jendela Incognito.

### Mengubah backend (`Kode.gs`)
1. Tempel `Kode.gs` baru di editor Apps Script, **Save**.
2. ⚠️ **Wajib deploy versi baru:** **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.** Menyimpan saja **tidak** mengubah aplikasi yang sedang berjalan.
3. Alamat `/exec` **tetap sama** — tidak perlu mengubah `config.js`.

---

# BAGIAN E — Keamanan & Hal yang Perlu Diketahui

- **Login tetap di server.** Frontend hanya "wajah". Peran (Pemilik, Pendaftaran, Dokter, Apotek dan Kasir) diperiksa **di backend** pada setiap permintaan, jadi mengubah kode di browser tidak memberi akses tambahan.
- **Ganti password awal `admin`** segera. Batas 5 percobaan salah per username (terkunci 10 menit) sudah aktif.
- **Repository publik ≠ data publik.** Yang publik hanya file tampilan. Data pasien tidak pernah masuk GitHub.
- **Pantau akses:** sheet `LogAudit` mencatat login, perubahan, dan penghapusan.
- **Backup:** Pengaturan → Backup Data menyalin seluruh database ke folder **📂 Backup** di Drive (otomatis harian pukul 23.00 bila diaktifkan; menyimpan 30 salinan terakhir).
- **Kuota Apps Script.** Akun Google gratis punya batas harian eksekusi yang lebih ketat daripada Google Workspace. Untuk klinik kecil umumnya cukup; bila sering menemui pesan kuota, pertimbangkan akun Workspace.
- **Kecepatan.** Tiap aksi melewati internet ke Apps Script (~0,5–2 detik). Ini wajar; gunakan koneksi stabil.
- **Satu akun Google = satu pemilik data.** Siapa pun yang memegang akun Google tersebut dapat membuka spreadsheet langsung. Aktifkan verifikasi 2 langkah di akun itu.

---

# BAGIAN F — Lupa Password

| Siapa | Cara |
|---|---|
| **Dokter / staf** | Minta Pemilik: **Pengaturan → Pengguna → ikon kunci (reset)**. Password sementara dibuat; pengguna diminta menggantinya saat masuk. |
| **Pemilik** (punya Kode Pemulihan) | Halaman masuk → **Lupa password?** → isi Kode Pemulihan (`XXXX-XXXX-XXXX`) + password baru. Setelah dipakai, **kode baru** dibuat — simpan lagi. |
| **Pemilik** (kode hilang) | Buka editor Apps Script → pilih fungsi **`resetPasswordPemilik`** → ▶ Run → password sementara muncul di **Execution log**. Lalu **`buatKodePemulihan`** → ▶ Run untuk kode baru. |

---

# BAGIAN G — Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Layar "**URL backend belum diisi**" | `js/config.js` belum diisi / salah | Lakukan B2, lalu `git add .` → `git commit -m "config"` → `git push` |
| "**Jawaban server tidak dikenali…**" | URL bukan `/exec`, atau deployment bukan "Anyone", atau belum deploy versi baru | Cek A3: **Execute as: Me**, **Who has access: Anyone**; pakai URL berakhiran `/exec` |
| Console: *blocked by CORS policy* | Akses deployment bukan "Anyone", atau URL `/dev` | Edit deployment → **Anyone** → **New version** → Deploy. Uji `…/exec?action=ping` di **jendela Incognito**: harus muncul JSON, bukan halaman login Google |
| "**Database belum disiapkan…**" | `setupAppEnvironment` belum dijalankan | Jalankan di editor (A1.4) |
| "**Fungsi tidak dikenal**" | Frontend lebih baru dari backend (atau sebaliknya) | Deploy **New version** (Bagian D) lalu Ctrl+Shift+R |
| Perubahan `Kode.gs` tak berpengaruh | Hanya di-Save, belum deploy versi baru | Bagian D |
| "**Authorization required**" / izin Drive/Sheets | Izin belum diberikan | Jalankan `setupAppEnvironment` dari editor dan izinkan (A1.4 poin 3–4) |
| "**Sesi berakhir, silakan login kembali**" | Sesi biasa habis (6 jam tanpa aktivitas) | Login lagi. Centang *Tetap masuk* di perangkat pribadi untuk 30 hari |
| Halaman polos (tanpa warna/ikon) | `css/style.css` 404, atau CDN jsdelivr terblokir | Cek struktur repo (B7 poin 1); cek koneksi internet |
| 404 di `github.io`; di repo terlihat folder `frontend/` atau `backend/` | `git init` di folder induk | Lihat **Perbaikan salah folder** di bawah |
| `fatal: not a git repository` | Belum `git init` / folder salah | `dir` dulu; pastikan di folder kerja |
| `Password authentication is not supported` | GitHub menolak password akun | Buat token (B6) |
| `Invalid username or token` | Token salah/kedaluwarsa, scope `repo` belum dicentang | Buat token baru |
| `src refspec main does not match any` | Belum ada commit | `git add .` lalu `git commit -m "Upload pertama"` |
| `Updates were rejected because the remote contains work` | Repo GitHub berisi berkas yang tidak ada di lokal | `git pull --rebase origin main` lalu `git push` |
| Backup harian tak jalan | Pemicu belum aktif / zona waktu salah | Pengaturan → Backup Data → aktifkan; pastikan `appsscript.json` (A1.3) |
| Dokter tidak menerima pemberitahuan | Nama akun Dokter ≠ nama di Daftar Dokter | Samakan **persis** (termasuk gelar) |

### Perbaikan: salah folder yang di-push (404)
Jangan hapus repository. Push ulang dari folder yang benar:
```powershell
cd "C:\Users\NAMA\Documents\apotek-praktik-dokter-frontend"
dir
```
Pastikan `index.html`, `css`, `js` terlihat. Lalu:
```powershell
git init
git add .
git commit -m "Fix: push dari folder yang benar"
git branch -M main
git remote add origin https://github.com/USERNAME/apotek-praktik-dokter.git
git push -u origin main --force
```
`--force` menimpa isi repository dengan versi lokal Anda. Aman di sini karena isi lama memang struktur yang salah. Tunggu 1–2 menit, lalu **Ctrl+Shift+R**.

---

# Glosarium

- **REST API / endpoint** — "pintu" di internet yang menerima permintaan dan menjawab dengan data JSON. Di sini: URL `/exec` Apps Script.
- **Web App (Apps Script)** — skrip yang bisa dipanggil lewat alamat URL.
- **Deployment** — "versi terbit" dari skrip. Perubahan kode baru berlaku setelah deploy **versi baru**.
- **Token sesi** — kode sementara bukti Anda sudah login; dikirim di setiap permintaan.
- **CORS** — aturan browser tentang situs mana boleh memanggil situs lain. Aplikasi ini sudah memenuhinya asal deployment diatur "Anyone".
- **Repository (repo)** — folder proyek di GitHub, seperti Google Drive-nya programmer.
- **Commit** — menyimpan perubahan dengan catatan singkat. **Push** — mengirim commit ke GitHub (seperti *upload*).
- **Branch** — cabang proyek; yang dipakai di sini hanya `main`.
- **Personal Access Token** — "password khusus" dari GitHub untuk terminal.
- **GitHub Pages** — layanan gratis GitHub untuk menayangkan situs statis.
- **PowerShell / Git Bash** — terminal tempat mengetik perintah Git di Windows.

---

*Aplikasi Apotek & Praktik Mandiri Dokter Spesialis Kulit dan Kelamin — versi 2.0 (REST API + GitHub Pages).*
