# Web Pendataan Riwayat Posyandu Balita

Aplikasi web untuk pendataan riwayat pemeriksaan balita di **Posyandu Desa Candiareng**.

## Fitur

### Untuk Ibu/Orang Tua
- Login dengan **NIK + Password**
- Login alternatif dengan **Nama Anak + Tanggal Lahir**
- Melihat data pertumbuhan: berat badan (BB), tinggi badan (TB), lingkar kepala
- Status stunting berdasarkan standar WHO (TB/U)
- Grafik pertumbuhan BB dan TB
- Riwayat imunisasi dan pemberian vitamin
- Riwayat kunjungan Posyandu

### Untuk Kader Posyandu
- Login kader terpisah
- Daftar seluruh balita terdaftar
- Tambah data balita dan ibu baru
- Input kunjungan (BB, TB, LK)
- Input imunisasi dan vitamin

## Cara Menjalankan

```bash
cd posyandu-web
npm install
npm start
```

Buka browser: **http://localhost:3000**

## Akun Demo

| Role | Cara Login | Kredensial |
|------|-----------|------------|
| Ibu (NIK) | Tab NIK & Password | NIK: `3273011506890001` / Password: `ibu123` |
| Ibu (Anak) | Tab Nama & Tgl Lahir | Nama: `Ahmad Fadli` / Tgl Lahir: `2023-03-15` |
| Kader | Login Kader | Username: `kader` / Password: `kader123` |

## Teknologi

- Node.js + Express
- SQLite (database lokal)
- EJS (template)
- Chart.js (grafik pertumbuhan)

## Struktur Folder

```
posyandu-web/
├── server.js          # Server utama & routing
├── database.js        # Schema & data awal
├── utils.js           # Perhitungan stunting & umur
├── views/             # Halaman web
├── public/css/        # Styling
└── public/js/         # JavaScript frontend
```

## Catatan

Status stunting menggunakan perkiraan Z-score berdasarkan median WHO. Untuk keperluan klinis resmi, gunakan tabel WHO lengkap atau aplikasi e-PPGBM Kemenkes.
