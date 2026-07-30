// Median tinggi badan anak laki-laki (cm) WHO - perkiraan sederhana
const MEDIAN_TB_L = {
  0: 49.9, 1: 54.7, 2: 58.4, 3: 61.4, 4: 63.9, 5: 65.9, 6: 67.6,
  7: 69.2, 8: 70.6, 9: 72.0, 10: 73.3, 11: 74.5, 12: 75.7, 13: 76.9,
  14: 78.0, 15: 79.1, 16: 80.2, 17: 81.2, 18: 82.3, 19: 83.2, 20: 84.2,
  21: 85.1, 22: 86.0, 23: 86.9, 24: 87.8, 30: 91.9, 36: 96.1, 42: 99.9,
  48: 103.3, 54: 106.7, 60: 110.0,
};

const MEDIAN_TB_P = {
  0: 49.1, 1: 53.7, 2: 57.1, 3: 59.8, 4: 62.1, 5: 64.0, 6: 65.7,
  7: 67.3, 8: 68.7, 9: 70.1, 10: 71.5, 11: 72.8, 12: 74.0, 13: 75.2,
  14: 76.4, 15: 77.5, 16: 78.6, 17: 79.7, 18: 80.7, 19: 81.7, 20: 82.7,
  21: 83.7, 22: 84.6, 23: 85.5, 24: 86.4, 30: 90.7, 36: 95.1, 42: 99.0,
  48: 102.7, 54: 106.1, 60: 109.4,
};

function hitungUmurBulan(tanggalLahir, tanggalUkur = new Date()) {
  const lahir = new Date(tanggalLahir);
  const ukur = new Date(tanggalUkur);
  let bulan = (ukur.getFullYear() - lahir.getFullYear()) * 12 + (ukur.getMonth() - lahir.getMonth());
  if (ukur.getDate() < lahir.getDate()) bulan--;
  return Math.max(0, bulan);
}

function formatUmur(bulan) {
  if (bulan < 12) return `${bulan} bulan`;
  const tahun = Math.floor(bulan / 12);
  const sisa = bulan % 12;
  return sisa > 0 ? `${tahun} tahun ${sisa} bulan` : `${tahun} tahun`;
}

function interpolasiMedian(table, bulan) {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (bulan <= keys[0]) return table[keys[0]];
  if (bulan >= keys[keys.length - 1]) return table[keys[keys.length - 1]];

  let lower = keys[0];
  for (const k of keys) {
    if (k <= bulan) lower = k;
    if (k >= bulan) {
      const upper = k;
      if (lower === upper) return table[lower];
      const ratio = (bulan - lower) / (upper - lower);
      return table[lower] + ratio * (table[upper] - table[lower]);
    }
  }
  return table[keys[keys.length - 1]];
}

function hitungStatusStunting(tinggiBadan, umurBulan, jenisKelamin) {
  const table = jenisKelamin === 'P' ? MEDIAN_TB_P : MEDIAN_TB_L;
  const median = interpolasiMedian(table, umurBulan);
  const sd = median * 0.04;
  const zScore = (tinggiBadan - median) / sd;

  let status, warna, keterangan;
  if (zScore < -3) {
    status = 'Stunting Berat';
    warna = 'danger';
    keterangan = 'Tinggi badan sangat di bawah standar. Segera konsultasi ke Puskesmas/Bidan Desa.';
  } else if (zScore < -2) {
    status = 'Stunting';
    warna = 'warning';
    keterangan = 'Tinggi badan di bawah standar. Perlu intervensi gizi dan monitoring rutin.';
  } else if (zScore < -1) {
    status = 'Risiko Stunting';
    warna = 'caution';
    keterangan = 'Mendekati batas bawah. Jaga asupan gizi dan kunjungan Posyandu rutin.';
  } else {
    status = 'Normal';
    warna = 'success';
    keterangan = 'Pertumbuhan tinggi badan dalam batas normal.';
  }

  return {
    status,
    warna,
    keterangan,
    zScore: Math.round(zScore * 100) / 100,
    median: Math.round(median * 10) / 10,
  };
}

function hitungStatusBB(beratBadan, umurBulan, jenisKelamin) {
  const medianBB_L = { 6: 7.9, 12: 9.6, 18: 10.9, 24: 12.2, 36: 14.3, 48: 16.3, 60: 18.3 };
  const medianBB_P = { 6: 7.3, 12: 8.9, 18: 10.2, 24: 11.5, 36: 13.9, 48: 15.8, 60: 17.7 };
  const table = jenisKelamin === 'P' ? medianBB_P : medianBB_L;
  const median = interpolasiMedian(table, umurBulan);
  const persen = Math.round((beratBadan / median) * 100);

  let status;
  if (persen < 80) status = 'Kurang';
  else if (persen > 120) status = 'Lebih';
  else status = 'Normal';

  return { status, persen, median: Math.round(median * 10) / 10 };
}

function formatTanggal(tgl) {
  if (!tgl) return '-';
  const d = new Date(tgl + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

module.exports = {
  hitungUmurBulan,
  formatUmur,
  hitungStatusStunting,
  hitungStatusBB,
  formatTanggal,
};
