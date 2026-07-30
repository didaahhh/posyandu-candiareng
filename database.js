const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/posyandu_db';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Terhubung ke MongoDB'))
  .catch((err) => console.error('❌ Gagal terhubung ke MongoDB:', err));

const KaderSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  nama: String,
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const OrangTuaSchema = new mongoose.Schema({
  nik: { type: String, unique: true },
  nama: String,
  password: { type: String, required: true },
  no_hp: String,
  alamat: String,
  created_at: { type: Date, default: Date.now }
});

const BalitaSchema = new mongoose.Schema({
  orang_tua_id: { type: mongoose.Schema.Types.ObjectId, ref: 'OrangTua' },
  nama: String,
  tanggal_lahir: String,
  jenis_kelamin: String,
  nik_balita: String,
  created_at: { type: Date, default: Date.now }
});

const KunjunganSchema = new mongoose.Schema({
  balita_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Balita' },
  tanggal: String,
  berat_badan: Number,
  tinggi_badan: Number,
  lingkar_kepala: Number,
  catatan: String,
  created_at: { type: Date, default: Date.now }
});

const ImunisasiSchema = new mongoose.Schema({
  balita_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Balita' },
  nama_vaksin: String,
  tanggal: String,
  catatan: String
});

const VitaminSchema = new mongoose.Schema({
  balita_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Balita' },
  jenis: String,
  tanggal: String,
  catatan: String
});

const models = {
  Kader: mongoose.models.Kader || mongoose.model('Kader', KaderSchema),
  OrangTua: mongoose.models.OrangTua || mongoose.model('OrangTua', OrangTuaSchema),
  Balita: mongoose.models.Balita || mongoose.model('Balita', BalitaSchema),
  Kunjungan: mongoose.models.Kunjungan || mongoose.model('Kunjungan', KunjunganSchema),
  Imunisasi: mongoose.models.Imunisasi || mongoose.model('Imunisasi', ImunisasiSchema),
  Vitamin: mongoose.models.Vitamin || mongoose.model('Vitamin', VitaminSchema),
};

async function initDatabase() {
  try {
    const kaderCount = await models.Kader.countDocuments();
    if (kaderCount === 0) {
      await models.Kader.create({
        username: 'kader',
        nama: 'Kader Posyandu Candiareng',
        password: bcrypt.hashSync('kader123', 10)
      });
      console.log('✅ Akun Kader default dibuat.');
    }
  } catch (err) {
    console.error('Init Database Error:', err);
  }
}

module.exports = { ...models, initDatabase };
