require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');
const {
  hitungUmurBulan,
  formatUmur,
  hitungStatusStunting,
  hitungStatusBB,
  formatTanggal,
} = require('./utils');

db.initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: 'posyandu-candiareng-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.role = req.session.role || null;
  next();
});

function requireIbu(req, res, next) {
  if (req.session.role === 'ibu' && req.session.balitaId) return next();
  res.redirect('/login');
}

function requireKader(req, res, next) {
  if (req.session.role === 'kader') return next();
  res.redirect('/kader/login');
}

async function getBalitaDetail(balitaId) {
  const balitaDoc = await db.Balita.findById(balitaId).populate('orang_tua_id');
  if (!balitaDoc) return null;
  
  const balita = balitaDoc.toObject();
  if (balita.orang_tua_id) {
    balita.nama_ibu = balita.orang_tua_id.nama;
    balita.nik_ibu = balita.orang_tua_id.nik;
    balita.no_hp = balita.orang_tua_id.no_hp;
    balita.alamat = balita.orang_tua_id.alamat;
  }
  
  const kunjungan = await db.Kunjungan.find({ balita_id: balitaId }).sort({ tanggal: 1 }).lean();
  const imunisasi = await db.Imunisasi.find({ balita_id: balitaId }).sort({ tanggal: -1 }).lean();
  const vitamin = await db.Vitamin.find({ balita_id: balitaId }).sort({ tanggal: -1 }).lean();

  const umurBulan = hitungUmurBulan(balita.tanggal_lahir);
  const terakhir = kunjungan[kunjungan.length - 1];

  let stunting = null;
  let bbStatus = null;
  if (terakhir) {
    stunting = hitungStatusStunting(terakhir.tinggi_badan, hitungUmurBulan(balita.tanggal_lahir, terakhir.tanggal), balita.jenis_kelamin);
    bbStatus = hitungStatusBB(terakhir.berat_badan, hitungUmurBulan(balita.tanggal_lahir, terakhir.tanggal), balita.jenis_kelamin);
  }

  const kunjunganEnriched = kunjungan.map((k) => {
    const umur = hitungUmurBulan(balita.tanggal_lahir, k.tanggal);
    const st = hitungStatusStunting(k.tinggi_badan, umur, balita.jenis_kelamin);
    const bb = hitungStatusBB(k.berat_badan, umur, balita.jenis_kelamin);
    return { ...k, umurBulan: umur, stunting: st, bbStatus: bb };
  });

  return {
    balita,
    kunjungan: kunjunganEnriched,
    imunisasi,
    vitamin,
    umurBulan,
    umurText: formatUmur(umurBulan),
    stunting,
    bbStatus,
    terakhir,
  };
}

// ─── Routes: Umum ───────────────────────────────────────────

app.get('/', (req, res) => {
  if (req.session.role === 'ibu') return res.redirect('/dashboard');
  if (req.session.role === 'kader') return res.redirect('/kader/dashboard');
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.role === 'ibu') return res.redirect('/dashboard');
  res.render('login', { error: null });
});

app.post('/login/nik', async (req, res) => {
  const { nik, password } = req.body;
  const ortu = await db.OrangTua.findOne({ nik: nik?.trim() });
  if (!ortu || !bcrypt.compareSync(password, ortu.password)) {
    return res.render('login', { error: 'NIK atau password salah.', tab: 'nik' });
  }
  const anak = await db.Balita.findOne({ orang_tua_id: ortu._id });
  if (!anak) {
    return res.render('login', { error: 'Belum ada data balita terdaftar.', tab: 'nik' });
  }
  req.session.user = { id: ortu._id.toString(), nama: ortu.nama, nik: ortu.nik };
  req.session.role = 'ibu';
  req.session.balitaId = anak._id.toString();
  req.session.ortuId = ortu._id.toString();
  res.redirect('/dashboard');
});

app.post('/login/anak', async (req, res) => {
  const { nama_anak, tanggal_lahir } = req.body;
  const balita = await db.Balita.findOne({ 
    nama: new RegExp('^' + (nama_anak || '').trim() + '$', 'i'), 
    tanggal_lahir 
  });
  if (!balita) {
    return res.render('login', { error: 'Nama anak atau tanggal lahir tidak ditemukan.', tab: 'anak' });
  }
  const ortu = await db.OrangTua.findById(balita.orang_tua_id);
  req.session.user = { id: ortu._id.toString(), nama: ortu.nama, nik: ortu.nik };
  req.session.role = 'ibu';
  req.session.balitaId = balita._id.toString();
  req.session.ortuId = ortu._id.toString();
  res.redirect('/dashboard');
});

app.get('/daftar', (req, res) => {
  if (req.session.role === 'ibu') return res.redirect('/dashboard');
  res.render('daftar', { error: null, form: {} });
});

app.post('/daftar', async (req, res) => {
  const {
    nik, nama_ibu, password, password_confirm,
    no_hp, alamat, nama_anak, tanggal_lahir, jenis_kelamin, nik_balita,
  } = req.body;

  const form = { nik, nama_ibu, no_hp, alamat, nama_anak, tanggal_lahir, jenis_kelamin, nik_balita };

  if (!nik || nik.trim().length !== 16 || !/^\d+$/.test(nik.trim())) {
    return res.render('daftar', { error: 'NIK harus 16 digit angka.', form });
  }
  if (!password || password.length < 6) {
    return res.render('daftar', { error: 'Password minimal 6 karakter.', form });
  }
  if (password !== password_confirm) {
    return res.render('daftar', { error: 'Konfirmasi password tidak cocok.', form });
  }
  if (!nama_ibu?.trim() || !nama_anak?.trim() || !tanggal_lahir || !jenis_kelamin) {
    return res.render('daftar', { error: 'Lengkapi semua data yang wajib diisi.', form });
  }

  const existing = await db.OrangTua.findOne({ nik: nik.trim() });
  if (existing) {
    return res.render('daftar', {
      error: 'NIK sudah terdaftar. Silakan login atau hubungi kader Posyandu.',
      form,
    });
  }

  try {
    const ortu = await db.OrangTua.create({
      nik: nik.trim(),
      nama: nama_ibu.trim(),
      password: bcrypt.hashSync(password, 10),
      no_hp: no_hp?.trim() || '',
      alamat: alamat?.trim() || ''
    });

    const balita = await db.Balita.create({
      orang_tua_id: ortu._id,
      nama: nama_anak.trim(),
      tanggal_lahir,
      jenis_kelamin,
      nik_balita: nik_balita?.trim() || null
    });

    req.session.user = { id: ortu._id.toString(), nama: ortu.nama, nik: ortu.nik };
    req.session.role = 'ibu';
    req.session.balitaId = balita._id.toString();
    req.session.ortuId = ortu._id.toString();
    res.redirect('/dashboard');
  } catch (err) {
    res.render('daftar', { error: 'Gagal mendaftar. Silakan coba lagi.', form });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ─── Routes: Dashboard Ibu ───────────────────────────────────

app.get('/dashboard', requireIbu, async (req, res) => {
  const data = await getBalitaDetail(req.session.balitaId);
  if (!data) return res.redirect('/login');

  const semuaAnak = await db.Balita.find({ orang_tua_id: req.session.ortuId }).select('_id nama tanggal_lahir jenis_kelamin').lean();

  res.render('dashboard-ibu', {
    ...data,
    semuaAnak: semuaAnak.map(a => ({...a, id: a._id.toString()})),
    formatTanggal,
    activeBalitaId: req.session.balitaId,
  });
});

app.post('/dashboard/pilih-anak', requireIbu, async (req, res) => {
  const { balita_id } = req.body;
  const balita = await db.Balita.findOne({ _id: balita_id, orang_tua_id: req.session.ortuId });
  if (balita) req.session.balitaId = balita._id.toString();
  res.redirect('/dashboard');
});

// ─── Routes: Kader ───────────────────────────────────────────

app.get('/kader/login', (req, res) => {
  if (req.session.role === 'kader') return res.redirect('/kader/dashboard');
  res.render('kader-login', { error: null });
});

app.post('/kader/login', async (req, res) => {
  const { username, password } = req.body;
  const kader = await db.Kader.findOne({ username: username?.trim() });
  if (!kader || !bcrypt.compareSync(password, kader.password)) {
    return res.render('kader-login', { error: 'Username atau password salah.' });
  }
  req.session.user = { id: kader._id.toString(), nama: kader.nama, username: kader.username };
  req.session.role = 'kader';
  res.redirect('/kader/dashboard');
});

app.get('/kader/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/kader/login');
});

app.get('/kader/dashboard', requireKader, async (req, res) => {
  const balitaDocs = await db.Balita.find().populate('orang_tua_id').sort({ nama: 1 }).lean();
  
  const balitaList = await Promise.all(balitaDocs.map(async (b) => {
    const kunjungan = await db.Kunjungan.find({ balita_id: b._id }).sort({ tanggal: 1 }).lean();
    return {
      ...b,
      id: b._id.toString(),
      nama_ibu: b.orang_tua_id?.nama || '-',
      nik_ibu: b.orang_tua_id?.nik || '-',
      jumlah_kunjungan: kunjungan.length,
      kunjungan_terakhir: kunjungan.length > 0 ? kunjungan[kunjungan.length - 1].tanggal : null
    };
  }));

  res.render('kader-dashboard', { balitaList, formatTanggal, hitungUmurBulan, formatUmur });
});

app.get('/kader/balita/:id', requireKader, async (req, res) => {
  const data = await getBalitaDetail(req.params.id);
  if (!data) return res.redirect('/kader/dashboard');
  data.balita.id = data.balita._id.toString(); // For compatibility with EJS template
  res.render('kader-detail', { ...data, formatTanggal });
});

app.get('/kader/tambah-balita', requireKader, (req, res) => {
  res.render('kader-tambah-balita', { error: null, success: null });
});

app.post('/kader/tambah-balita', requireKader, async (req, res) => {
  const { nik_ibu, nama_ibu, password, no_hp, alamat, nama_anak, tanggal_lahir, jenis_kelamin, nik_balita } = req.body;
  try {
    let ortu = await db.OrangTua.findOne({ nik: nik_ibu?.trim() });
    if (!ortu) {
      ortu = await db.OrangTua.create({
        nik: nik_ibu.trim(),
        nama: nama_ibu,
        password: bcrypt.hashSync(password || 'ibu123', 10),
        no_hp,
        alamat
      });
    }
    await db.Balita.create({
      orang_tua_id: ortu._id,
      nama: nama_anak,
      tanggal_lahir,
      jenis_kelamin,
      nik_balita: nik_balita || null
    });
    res.redirect('/kader/dashboard');
  } catch (err) {
    res.render('kader-tambah-balita', { error: 'Gagal menyimpan data. Pastikan NIK unik dan data lengkap.', success: null });
  }
});

app.get('/kader/kunjungan/:balitaId', requireKader, async (req, res) => {
  const balita = await db.Balita.findById(req.params.balitaId).lean();
  if (!balita) return res.redirect('/kader/dashboard');
  balita.id = balita._id.toString();
  res.render('kader-tambah-kunjungan', { balita, error: null, formatTanggal });
});

app.post('/kader/kunjungan/:balitaId', requireKader, async (req, res) => {
  const { tanggal, berat_badan, tinggi_badan, lingkar_kepala, catatan } = req.body;
  try {
    const balita = await db.Balita.findById(req.params.balitaId);
    if (!balita) return res.redirect('/kader/dashboard');
    
    await db.Kunjungan.create({
      balita_id: balita._id,
      tanggal,
      berat_badan: parseFloat(berat_badan),
      tinggi_badan: parseFloat(tinggi_badan),
      lingkar_kepala: lingkar_kepala ? parseFloat(lingkar_kepala) : null,
      catatan
    });
    res.redirect(`/kader/balita/${req.params.balitaId}`);
  } catch (err) {
    const balita = await db.Balita.findById(req.params.balitaId).lean();
    if(balita) balita.id = balita._id.toString();
    res.render('kader-tambah-kunjungan', { balita, error: 'Gagal menyimpan kunjungan.', formatTanggal });
  }
});

app.get('/kader/imunisasi/:balitaId', requireKader, async (req, res) => {
  const balita = await db.Balita.findById(req.params.balitaId).lean();
  if (!balita) return res.redirect('/kader/dashboard');
  balita.id = balita._id.toString();
  res.render('kader-tambah-imunisasi', { balita, error: null });
});

app.post('/kader/imunisasi/:balitaId', requireKader, async (req, res) => {
  const { nama_vaksin, tanggal, catatan } = req.body;
  await db.Imunisasi.create({
    balita_id: req.params.balitaId,
    nama_vaksin,
    tanggal,
    catatan
  });
  res.redirect(`/kader/balita/${req.params.balitaId}`);
});

app.get('/kader/vitamin/:balitaId', requireKader, async (req, res) => {
  const balita = await db.Balita.findById(req.params.balitaId).lean();
  if (!balita) return res.redirect('/kader/dashboard');
  balita.id = balita._id.toString();
  res.render('kader-tambah-vitamin', { balita, error: null });
});

app.post('/kader/vitamin/:balitaId', requireKader, async (req, res) => {
  const { jenis, tanggal, catatan } = req.body;
  await db.Vitamin.create({
    balita_id: req.params.balitaId,
    jenis,
    tanggal,
    catatan
  });
  res.redirect(`/kader/balita/${req.params.balitaId}`);
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`\n🏥 Posyandu Web berjalan di http://localhost:${PORT}`);
    console.log('   (Versi Database MongoDB - Mode Lokal)');
    console.log('   Login Kader → Username: kader / Password: kader123\n');
  });
}
