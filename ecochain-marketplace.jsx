import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// ECOCHAIN AI MARKETPLACE — Production Prototype
// Real Drop Points: Pondok Aren, Tangerang Selatan
// Cascading Price Model with RAG-Driven AI Agents
// Free Tier Architecture (Groq + Gemini + n8n + Supabase)
// ═══════════════════════════════════════════════════════════════

// ─── GEMINI VISION AI CONFIG ───
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY || "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── GROQ CHAT AI CONFIG ───
const GROQ_API_KEY = import.meta.env.VITE_GROQ_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ─── PRICE DATABASE (Digitized from Bank Sampah Document 02 Jan 2026) ───
const WASTE_DB = {
  kertas: {
    label: "Kertas", icon: "📄", accent: "#D4A574",
    items: [
      { code: "1.1", name: "Buku Tulis / Pelajaran", price: 1500 },
      { code: "1.2", name: "HVS / Putihan", price: 1700 },
      { code: "1.3", name: "Kardus / Box", price: 1500 },
      { code: "1.4", name: "Koran (Bagus)", price: 3000 },
      { code: "1.5", name: "Majalah / Buku LKS", price: 500 },
      { code: "1.6", name: "Boncos", price: 500 },
    ]
  },
  plastik: {
    label: "Plastik", icon: "🧴", accent: "#5B9BD5",
    items: [
      { code: "2.1", name: "Botol Bersih", price: 3100 },
      { code: "2.2", name: "Botol / Gelas Mineral Kotor", price: 1500 },
      { code: "2.3", name: "Botol Warna", price: 500 },
      { code: "2.4", name: "Thinwall PP No.5 (Bening)", price: 3300 },
      { code: "2.5", name: "Thinwall PP No.5 (Warna)", price: 2000 },
      { code: "2.6", name: "Ember Campur / Emberan", price: 1300 },
      { code: "2.7", name: "Ember Hitam / Pot Bunga", price: 600 },
      { code: "2.8", name: "Gelas Bersih", price: 3500 },
      { code: "2.9", name: "Plastik / Asoy", price: 300 },
      { code: "2.10", name: "PE", price: 500 },
      { code: "2.11", name: "Selang Air / Pralon", price: 1000 },
      { code: "2.12", name: "Tutup Botol", price: 2200 },
      { code: "2.13", name: "Tutup Galon / LD", price: 4000 },
      { code: "2.14", name: "Botol Galon", price: 3000 },
    ]
  },
  logam: {
    label: "Logam", icon: "🔩", accent: "#7EBD7E",
    items: [
      { code: "3.1", name: "Alumunium", price: 11000 },
      { code: "3.2", name: "Besi", price: 3600 },
      { code: "3.3", name: "Kabin / Paku / Baja Ringan", price: 1700 },
      { code: "3.4", name: "Kaleng", price: 1600 },
      { code: "3.5", name: "Kuningan", price: 40000 },
      { code: "3.6", name: "Seng / Kawat", price: 700 },
      { code: "3.7", name: "Tembaga", price: 80000 },
    ]
  },
  impact: {
    label: "Impact", icon: "♻️", accent: "#C97EBD",
    items: [
      { code: "4.1", name: "R. Nyamuk, K. Air, Helm, Tape", price: 300 },
      { code: "4.2", name: "Yakult", price: 500 },
    ]
  },
  beling: {
    label: "Beling", icon: "🫙", accent: "#BD7E9E",
    items: [
      { code: "5.1", name: "Beling", price: 300 },
    ]
  },
  elektronik: {
    label: "Elektronik", icon: "💻", accent: "#7EB5BD",
    items: [
      { code: "6.1", name: "AC 1 set", price: 200000, unit: "set" },
      { code: "6.2", name: "Komputer 1 set", price: 75000, unit: "set" },
      { code: "6.3", name: "CPU Komplit", price: 40000, unit: "set" },
      { code: "6.4", name: "Kulkas", price: 50000, unit: "set" },
      { code: "6.5", name: "Laptop", price: 50000, unit: "set" },
      { code: "6.6", name: "Notebook", price: 25000, unit: "set" },
      { code: "6.7", name: "Mesin Cuci Komplit", price: 50000, unit: "set" },
      { code: "6.8", name: "TV Tabung 14\" / Monitor", price: 10000, unit: "set" },
      { code: "6.9", name: "TV Tabung 21\"", price: 20000, unit: "set" },
      { code: "6.10", name: "TV Tabung 29\"", price: 30000, unit: "set" },
      { code: "6.11", name: "TV LCD/LED < 32\"", price: 25000, unit: "set" },
      { code: "6.12", name: "TV LCD > 32\"", price: 50000, unit: "set" },
      { code: "6.13", name: "TV LED > 32\"", price: 100000, unit: "set" },
      { code: "6.14", name: "TV LCD/LED Retak/Flek", price: 25000, unit: "set" },
    ]
  },
  lainnya: {
    label: "Lain-lain", icon: "📦", accent: "#BDBD7E",
    items: [
      { code: "7.1", name: "Aki", price: 9000 },
      { code: "8.1", name: "Karpet / Talang / Kabel", price: 500 },
      { code: "9.1", name: "Keping CD / Acrylic", price: 3500 },
      { code: "10.1", name: "Minyak Jelantah", price: 5700 },
      { code: "11.1", name: "Styrofoam", price: 1000 },
      { code: "11.2", name: "Tetrapak", price: 100 },
      { code: "11.3", name: "Multilayer / MLP", price: 300 },
      { code: "11.4", name: "Mika", price: 100 },
      { code: "11.5", name: "Kabel", price: 1000 },
    ]
  }
};

// ─── REAL NETWORK DATA (Pondok Aren, Tangerang Selatan) ───
const NETWORK = {
  dropPoints: [
    {
      id: "dp1", name: "Drop Point Jl. H. Saan Tumpang",
      address: "Jl. H. Saan Tumpang, Parigi Baru, Kec. Pd. Aren",
      lat: -6.273064, lng: 106.6900881,
      type: "Warung / Rumahan", status: "active",
      stock: 67, capacity: 100, todayTx: 8,
      todayRevenue: 124500, weekRevenue: 892000,
      operator: "Pak Ahmad",
      phone: "-",
      topItems: ["Kardus", "Botol Bersih", "Ember"],
    },
    {
      id: "dp2", name: "Drop Point Pondok Kacang Barat",
      address: "Pondok Kacang Barat, Kec. Pd. Aren",
      lat: -6.261838, lng: 106.688826,
      type: "Tambal Ban", status: "active",
      stock: 43, capacity: 80, todayTx: 5,
      todayRevenue: 87300, weekRevenue: 643000,
      operator: "Bang Roni",
      phone: "-",
      topItems: ["Besi", "Alumunium", "Kaleng"],
    },
    {
      id: "dp3", name: "Peduli Bersih Hijau (PBH)",
      address: "Blk. C5 No.16, Pd. Aren, Kec. Pd. Aren, Kota Tangerang Selatan, Banten 15224",
      lat: -6.2660, lng: 106.7310,
      type: "Komunitas", status: "active",
      stock: 35, capacity: 70, todayTx: 3,
      todayRevenue: 62000, weekRevenue: 478000,
      operator: "-",
      phone: "-",
      topItems: ["Kardus", "Botol Bersih", "Plastik"],
    },
    {
      id: "dp4", name: "Drop Point Parigi Baru",
      address: "Gang Bari II, Parigi Baru, Kec. Pd. Aren",
      lat: -6.26022, lng: 106.68146,
      type: "Warung / Rumahan", status: "active",
      stock: 28, capacity: 60, todayTx: 4,
      todayRevenue: 53000, weekRevenue: 412000,
      operator: "-",
      phone: "-",
      topItems: ["Kardus", "Besi", "Botol Bersih"],
    },
  ],
  bankSampah: [
    {
      id: "bs1", name: "Kertabumi Recycling Center",
      address: "Gg. Beben No.84, Pd. Kacang Bar.",
      lat: -6.259284, lng: 106.688127,
      rating: 4.5, reviews: 26,
      phone: "+62 812-8847-7948",
      website: "kertabumi.org",
      hours: "Sen-Jum 09:00-17:00",
      distToDp1: "1.6 km", distToDp2: "0.3 km",
      specialty: "Daur ulang plastik, edukasi",
      monthlyCapacity: "2 ton",
    },
    {
      id: "bs2", name: "Bank Sampah Japos Raya",
      address: "Jl. Bougenville II, Jurang Mangu Barat",
      lat: -6.253394, lng: 106.712183,
      rating: 5.0, reviews: 9,
      phone: "+62 857-1544-1127",
      hours: "Sen-Jum 10:00-16:00",
      distToDp1: "3.2 km", distToDp2: "2.8 km",
      specialty: "Komunitas ibu RT & sekolah",
      monthlyCapacity: "1.5 ton",
    },
    {
      id: "bs3", name: "Bank Sampah Kasuari",
      address: "Jl. Kasuari VII, Pd. Pucung",
      lat: -6.279261, lng: 106.709636,
      rating: 2.8, reviews: 6,
      phone: "-",
      hours: "Tidak tetap",
      distToDp1: "2.1 km", distToDp2: "2.5 km",
      specialty: "Umum",
      monthlyCapacity: "0.8 ton",
    },
    {
      id: "bs4", name: "Bank Sampah Teratai",
      address: "Jl. Kutilang No.D. I/57, RT.5/RW.4, Pd. Pucung, Kec. Pd. Aren",
      lat: -6.2936, lng: 106.7084,
      rating: 4.0, reviews: 12,
      phone: "-",
      hours: "Sen-Sab 08:00-15:00",
      distToDp1: "2.7 km", distToDp2: "2.4 km",
      specialty: "Komunitas kelurahan",
      monthlyCapacity: "1.2 ton",
    },
  ],
  pelapak: [
    {
      id: "pl1", name: "Wastehub® Jakarta Area",
      address: "Mualim Murjeni, Pd. Kacang Tim.",
      lat: -6.265911, lng: 106.705235,
      phone: "+62 813-5322-4771",
      website: "wastehub.webflow.io",
      type: "Aggregator Platform",
      accepts: ["Plastik", "Kertas", "Logam", "Elektronik"],
    },
  ],
};

// ─── CASCADING PRICE ENGINE ───
const CASCADE = (pelapakPrice, m) => ({
  pelapak: pelapakPrice,
  bank: Math.round(pelapakPrice * (1 - m.pelapakToBank)),
  dropPoint: Math.round(pelapakPrice * (1 - m.pelapakToBank) * (1 - m.bankToDropPoint)),
  user: Math.round(pelapakPrice * (1 - m.pelapakToBank) * (1 - m.bankToDropPoint) * (1 - m.dropPointToUser)),
});

// ─── TRANSACTION HISTORY (Simulated with real context) ───
const TRANSACTIONS = [
  { id: "ECH-2602-001", date: "24 Feb 2026", time: "08:14", user: "Ibu Ani", dp: "dp1", items: [{ name: "Kardus", w: 9.5, code: "1.3" }, { name: "HVS", w: 6, code: "1.2" }], status: "done" },
  { id: "ECH-2602-002", date: "24 Feb 2026", time: "09:30", user: "Pak Dedi", dp: "dp2", items: [{ name: "Alumunium", w: 1.2, code: "3.1" }, { name: "Besi", w: 2.1, code: "3.2" }], status: "done" },
  { id: "ECH-2602-003", date: "24 Feb 2026", time: "10:45", user: "Dina", dp: "dp1", items: [{ name: "Botol Bersih", w: 7.2, code: "2.1" }, { name: "Gelas Bersih", w: 5.2, code: "2.8" }], status: "done" },
  { id: "ECH-2602-004", date: "24 Feb 2026", time: "11:20", user: "Bang Udin", dp: "dp1", items: [{ name: "Minyak Jelantah", w: 14, code: "10.1" }, { name: "Ember Campur", w: 7.4, code: "2.6" }], status: "pending" },
  { id: "ECH-2602-005", date: "24 Feb 2026", time: "13:00", user: "Rina", dp: "dp2", items: [{ name: "Beling", w: 6.2, code: "5.1" }, { name: "Kaleng", w: 4.1, code: "3.4" }], status: "done" },
  { id: "ECH-2602-006", date: "23 Feb 2026", time: "15:30", user: "Mas Joko", dp: "dp1", items: [{ name: "Botol Bersih", w: 9.2, code: "2.1" }, { name: "Tutup Galon", w: 1.9, code: "2.13" }], status: "done" },
  { id: "ECH-2602-007", date: "23 Feb 2026", time: "16:10", user: "Bu Sari", dp: "dp2", items: [{ name: "Tembaga", w: 0.5, code: "3.7" }], status: "done" },
];

// ─── SCAN SIMULATION DATA ───
const SCAN_SCENARIOS = [
  {
    label: "Tumpukan Botol & Kardus",
    results: [
      { item: "Galon Le Minerale (ada label)", cat: "plastik", code: "2.2", weight: 2.5, tip: "💡 Lepas label → masuk 'Botol Bersih' (Rp3.100/kg), bukan 'Mineral Kotor' (Rp1.500/kg). Selisih +Rp4.000!" },
      { item: "Kardus Bekas Paket", cat: "kertas", code: "1.3", weight: 8.3, tip: null },
      { item: "Botol Plastik Bersih (×12)", cat: "plastik", code: "2.1", weight: 1.8, tip: "💡 Pastikan bersih & kering untuk harga maksimal." },
      { item: "Gelas Plastik Bersih", cat: "plastik", code: "2.8", weight: 0.6, tip: null },
    ]
  },
  {
    label: "Logam & Elektronik",
    results: [
      { item: "Panci Alumunium Bekas", cat: "logam", code: "3.1", weight: 1.5, tip: null },
      { item: "Besi Konstruksi Sisa", cat: "logam", code: "3.2", weight: 4.2, tip: null },
      { item: "Kaleng Bekas (×20)", cat: "logam", code: "3.4", weight: 2.0, tip: "💡 Kaleng yang sudah di-press lebih mudah ditimbang." },
      { item: "Kabel Bekas", cat: "lainnya", code: "11.5", weight: 0.8, tip: "💡 Kabel tembaga terpisah bisa dapat Rp80.000/kg!" },
    ]
  },
  {
    label: "Minyak Jelantah & Campuran",
    results: [
      { item: "Minyak Jelantah (5 botol)", cat: "lainnya", code: "10.1", weight: 4.5, tip: "💡 Saring dulu, harga bisa lebih baik. Jangan campur air." },
      { item: "Ember Campur Warna", cat: "plastik", code: "2.6", weight: 3.2, tip: null },
      { item: "Styrofoam Box", cat: "lainnya", code: "11.1", weight: 1.5, tip: null },
    ]
  },
];

// ─── HELPERS ───
const rp = n => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const kg = w => `${w.toFixed(1)} kg`;

const findItem = (code) => {
  for (const [, cat] of Object.entries(WASTE_DB)) {
    const item = cat.items.find(i => i.code === code);
    if (item) return { ...item, catKey: Object.entries(WASTE_DB).find(([, c]) => c.items.includes(item))?.[0] };
  }
  return null;
};

const getTxTotal = (items, margins) => items.reduce((sum, it) => {
  const dbItem = findItem(it.code);
  if (!dbItem) return sum;
  const prices = CASCADE(dbItem.price, margins);
  return sum + prices.user * it.w;
}, 0);

// ─── GEMINI VISION HELPERS ───
const buildWastePrompt = () => {
  let codes = "";
  for (const [, cat] of Object.entries(WASTE_DB)) {
    codes += `${cat.label.toUpperCase()}: ${cat.items.map(i => `${i.code}=${i.name}`).join(", ")}\n`;
  }
  return `Kamu adalah AI waste sorting assistant untuk Bank Sampah di Indonesia.
Analisis foto ini dan identifikasi semua item sampah yang bisa dijual/didaur ulang.

Klasifikasikan setiap item ke SALAH SATU kode berikut:
${codes}
Untuk setiap item berikan:
- item: deskripsi singkat apa yang terlihat
- code: kode dari daftar di atas (HARUS tepat cocok)
- cat: kategori key (kertas/plastik/logam/impact/beling/elektronik/lainnya)
- weight: estimasi berat dalam kg (berdasarkan ukuran visual)
- tip: tips sorting untuk harga lebih tinggi dalam Bahasa Indonesia, atau null

Format JSON:
{"label":"deskripsi singkat tumpukan","results":[{"item":"...","code":"...","cat":"...","weight":0.0,"tip":"...atau null"}]}
Jika tidak ada sampah: {"label":"Tidak terdeteksi","results":[]}`;
};

const resizeAndEncode = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const MAX = 1024;
    let w = img.width, h = img.height;
    if (w > MAX || h > MAX) {
      const scale = Math.min(MAX / w, MAX / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", 0.7);
    URL.revokeObjectURL(img.src);
    resolve({ base64: dataUrl.split(",")[1], preview: dataUrl });
  };
  img.onerror = () => reject(new Error("Gagal memuat gambar"));
  img.src = URL.createObjectURL(file);
});

const callGeminiVision = async (base64) => {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: "image/jpeg", data: base64 } },
        { text: buildWastePrompt() },
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  return res.json();
};

const parseGeminiResponse = (apiRes) => {
  const text = apiRes?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const data = JSON.parse(text);
  const validResults = (data.results || [])
    .filter(r => r.code && r.cat && typeof r.weight === "number" && r.weight > 0)
    .map(r => {
      const cat = r.cat.toLowerCase();
      const dbItem = findItem(r.code);
      if (!dbItem) {
        const catItems = WASTE_DB[cat]?.items;
        if (catItems?.length) return { ...r, cat, code: catItems[0].code };
        return null;
      }
      return { ...r, cat, weight: Math.round(r.weight * 10) / 10 };
    })
    .filter(Boolean)
    .slice(0, 8);
  return validResults.length > 0
    ? { label: data.label || "Hasil Scan AI", results: validResults }
    : null;
};

// ─── GROQ CHAT SYSTEM PROMPT ───
const buildChatSystemPrompt = (currentMargins) => {
  let priceSummary = "";
  for (const [, cat] of Object.entries(WASTE_DB)) {
    const items = cat.items.map(i => `${i.name} Rp${i.price.toLocaleString("id-ID")}${i.unit ? `/${i.unit}` : "/kg"}`).join(", ");
    priceSummary += `${cat.icon} ${cat.label}: ${items}\n`;
  }

  const dpList = NETWORK.dropPoints.map(dp =>
    `- ${dp.name} (${dp.address}) — Operator: ${dp.operator}, Stok: ${dp.stock}/${dp.capacity}kg, Hari ini: ${dp.todayTx} tx`
  ).join("\n");

  const bsList = NETWORK.bankSampah.map(bs =>
    `- ${bs.name} (${bs.address}) — Rating: ${bs.rating}/5, Jam: ${bs.hours}, Kapasitas: ${bs.monthlyCapacity}/bulan`
  ).join("\n");

  const plList = NETWORK.pelapak.map(pl =>
    `- ${pl.name} (${pl.address}) — Terima: ${pl.accepts.join(", ")}`
  ).join("\n");

  const m = currentMargins;
  const cascadeInfo = `Model Harga Cascade (4 level):
- Pelapak (harga dasar/pasar)
- Bank Sampah: Pelapak × ${((1 - m.pelapakToBank) * 100).toFixed(0)}% (margin ${(m.pelapakToBank * 100).toFixed(0)}%)
- Drop Point: Bank × ${((1 - m.bankToDropPoint) * 100).toFixed(0)}% (margin ${(m.bankToDropPoint * 100).toFixed(0)}%)
- End User dapat: Drop Point × ${((1 - m.dropPointToUser) * 100).toFixed(0)}% (margin ${(m.dropPointToUser * 100).toFixed(0)}%)
Harga di database adalah harga PELAPAK. Untuk hitung harga user, kalikan cascade.`;

  return `Kamu adalah EcoChain Assistant, asisten AI untuk marketplace ekonomi sirkular sampah di area Pondok Aren, Tangerang Selatan, Indonesia.

PERAN:
- Kamu membantu masyarakat, pengelola drop point, bank sampah, dan pelapak.
- Kamu ahli dalam harga sampah daur ulang, lokasi pengumpulan, dan tips sorting.
- Jawab selalu dalam Bahasa Indonesia yang ramah dan informatif.
- Gunakan emoji secukupnya untuk keramahan.
- Jika ditanya hal di luar topik sampah/daur ulang, arahkan kembali dengan sopan.

HARGA SAMPAH TERKINI (harga level Pelapak per kg, kecuali tertulis lain):
${priceSummary}
${cascadeInfo}

Contoh: Kardus harga pelapak Rp1.500/kg → User dapat ~Rp${CASCADE(1500, m).user}/kg

DROP POINT AKTIF:
${dpList}

BANK SAMPAH:
${bsList}

PELAPAK / OFFTAKER:
${plList}

TIPS PENTING:
- Botol plastik bersih (lepas label) = Rp3.100/kg, kotor = Rp1.500/kg — selisih besar!
- Tembaga adalah item paling bernilai (Rp80.000/kg level pelapak)
- Minyak jelantah harus disaring, jangan campur air
- Pisahkan sampah per kategori untuk harga maksimal

Jawab pertanyaan user berdasarkan data di atas. Jika user tanya harga, selalu tampilkan harga level USER (setelah cascade), bukan harga pelapak, kecuali diminta spesifik.`;
};

// ─── ANIMATED NUMBER ───
function Anim({ value, dur = 700 }) {
  const [d, setD] = useState(0);
  const r = useRef(null);
  useEffect(() => {
    let s;
    const step = ts => {
      if (!r.current) r.current = ts;
      const p = Math.min((ts - r.current) / dur, 1);
      setD(Math.round(p * value));
      if (p < 1) s = requestAnimationFrame(step);
    };
    r.current = null;
    s = requestAnimationFrame(step);
    return () => cancelAnimationFrame(s);
  }, [value, dur]);
  return <>{rp(d)}</>;
}

// ─── TYPING EFFECT FOR AI RESPONSES ───
function TypeWriter({ text, speed = 18, onDone }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); onDone?.(); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <>{shown}<span style={{ animation: "blink 0.8s infinite", opacity: shown.length < text.length ? 1 : 0 }}>▊</span></>;
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function EcoChain() {
  const [role, setRole] = useState("user");
  const [tab, setTab] = useState("scan");
  const [margins, setMargins] = useState({ pelapakToBank: 0.15, bankToDropPoint: 0.20, dropPointToUser: 0.25 });
  const [scanning, setScanning] = useState(false);
  const [scanIdx, setScanIdx] = useState(0);
  const [scanResults, setScanResults] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanPhoto, setScanPhoto] = useState(null);
  const [catFilter, setCatFilter] = useState("kertas");
  const [notif, setNotif] = useState(null);
  const [priceUpdating, setPriceUpdating] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showCascadeFor, setShowCascadeFor] = useState(null);
  const [dpDetail, setDpDetail] = useState(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const roles = [
    { id: "user", label: "End User", icon: "👤", sub: "Masyarakat", c: "#22C55E" },
    { id: "dp", label: "Drop Point", icon: "📍", sub: "Retailer", c: "#F59E0B" },
    { id: "bank", label: "Bank Sampah", icon: "🏦", sub: "Pengelola", c: "#3B82F6" },
    { id: "pelapak", label: "Pelapak", icon: "🏭", sub: "Industri", c: "#A855F7" },
  ];
  const activeRole = roles.find(r => r.id === role);

  const flash = useCallback((msg, type = "ok") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  const doScan = () => { fileInputRef.current?.click(); };

  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanResults(null);
    setScanError(null);
    setScanPhoto(null);
    try {
      const { base64, preview } = await resizeAndEncode(file);
      setScanPhoto(preview);
      if (!GEMINI_API_KEY) {
        setTimeout(() => {
          setScanning(false);
          setScanResults(SCAN_SCENARIOS[scanIdx]);
          setScanIdx(i => (i + 1) % SCAN_SCENARIOS.length);
          flash("📷 Foto diambil! (Demo mode — API key belum dikonfigurasi)");
        }, 1000);
        e.target.value = "";
        return;
      }
      const apiRes = await callGeminiVision(base64);
      const parsed = parseGeminiResponse(apiRes);
      if (parsed) {
        setScanning(false);
        setScanResults(parsed);
        flash("🤖 Smart Waste Scout: Item terdeteksi!");
      } else {
        setScanning(false);
        setScanError("Tidak ada sampah terdeteksi. Coba foto lebih dekat.");
      }
    } catch (err) {
      console.error("Scan error:", err);
      setScanning(false);
      setScanResults(SCAN_SCENARIOS[scanIdx]);
      setScanIdx(i => (i + 1) % SCAN_SCENARIOS.length);
      flash("⚠️ AI unavailable — menampilkan demo");
    }
    e.target.value = "";
  };

  const doPriceUpdate = () => {
    setPriceUpdating(true);
    flash("📸 Pricing Agent sedang memproses dokumen...", "info");
    setTimeout(() => {
      setPriceUpdating(false);
      flash("✅ Harga cascade berhasil di-update ke semua level!");
    }, 3000);
  };

  // AI Chat — Groq Llama 3 with demo fallback
  const sendChat = async (directQuery) => {
    const q = (directQuery || chatInput).trim();
    if (!q || chatLoading) return;
    setChatInput("");
    setAiChat(prev => [...prev, { role: "user", text: q }]);

    // ─── FALLBACK: Demo mode when no API key ───
    if (!GROQ_API_KEY) {
      setChatLoading(true);
      setTimeout(() => {
        let response = "";
        const ql = q.toLowerCase();
        if (ql.includes("harga") && ql.includes("kardus")) {
          const p = CASCADE(1500, margins);
          response = `📦 Harga Kardus saat ini:\n• Pelapak: ${rp(p.pelapak)}/kg\n• Bank Sampah: ${rp(p.bank)}/kg\n• Drop Point beli: ${rp(p.dropPoint)}/kg\n• User dapat: ${rp(p.user)}/kg\n\nDi Drop Point terdekat (Jl. H. Saan Tumpang), stok kardus masih bisa ditampung.`;
        } else if (ql.includes("drop point") || ql.includes("terdekat")) {
          response = `📍 4 Drop Point aktif di area Pondok Aren:\n\n1. Jl. H. Saan Tumpang (Pak Ahmad)\n   Stok: 67/100 kg • Hari ini: 8 transaksi\n\n2. Pondok Kacang Barat (Bang Roni)\n   Stok: 43/80 kg • Hari ini: 5 transaksi\n\n3. Peduli Bersih Hijau (PBH)\n   Blk. C5 No.16, Pd. Aren • Stok: 35/70 kg\n\n4. Drop Point Parigi Baru\n   Gang Bari II, Parigi Baru • Stok: 28/60 kg\n\nSemua BUKA sekarang. Yang paling dekat dari Kertabumi adalah DP2 (300m).`;
        } else if (ql.includes("jelantah") || ql.includes("minyak")) {
          const p = CASCADE(5700, margins);
          response = `🫗 Minyak Jelantah — salah satu item paling menguntungkan!\n\nHarga user: ${rp(p.user)}/kg\nTips: Saring dulu & jangan campur air agar harga maksimal.\n\nDrop Point Jl. H. Saan Tumpang masih terima — sudah ada 14kg pending dari Bang Udin hari ini.`;
        } else if (ql.includes("tembaga") || ql.includes("mahal")) {
          const p = CASCADE(80000, margins);
          response = `🏆 Top 3 Item Paling Bernilai:\n\n1. Tembaga: ${rp(p.user)}/kg (WOW!)\n2. Kuningan: ${rp(CASCADE(40000, margins).user)}/kg\n3. Alumunium: ${rp(CASCADE(11000, margins).user)}/kg\n\nBahkan kabel bekas yang mengandung tembaga bisa sangat bernilai. Pisahkan dari plastik pembungkusnya!`;
        } else if (ql.includes("kertabumi")) {
          response = `🏦 Kertabumi Recycling Center\n📍 Gg. Beben No.84, Pondok Kacang Barat\n⭐ Rating 4.5 (26 reviews)\n📞 +62 812-8847-7948\n🌐 kertabumi.org\n⏰ Sen-Jum 09:00-17:00\n\nSpesialisasi daur ulang plastik + edukasi. Hanya 300m dari Drop Point 2!\nKapasitas bulanan: ~2 ton.`;
        } else if (ql.includes("teratai")) {
          response = `🏦 Bank Sampah Teratai\n📍 Jl. Kutilang No.D. I/57, RT.5/RW.4, Pd. Pucung\n⭐ Rating 4.0 (12 reviews)\n⏰ Sen-Sab 08:00-15:00\n\nBank sampah komunitas kelurahan Pondok Pucung. Dekat dengan Bank Sampah Kasuari.\nKapasitas bulanan: ~1.2 ton.`;
        } else if (ql.includes("pbh") || ql.includes("peduli bersih") || ql.includes("peduli")) {
          response = `📍 Peduli Bersih Hijau (PBH)\n📍 Blk. C5 No.16, Pd. Aren, Kec. Pd. Aren\nTipe: Komunitas • Status: Aktif\nStok: 35/70 kg • Hari ini: 3 transaksi\n\nDrop point berbasis komunitas di kelurahan Pondok Aren. Terima berbagai jenis sampah termasuk kardus, botol bersih, dan plastik.`;
        } else if (ql.includes("parigi")) {
          response = `📍 Drop Point Parigi Baru\n📍 Gang Bari II, Parigi Baru, Kec. Pd. Aren\nTipe: Warung / Rumahan • Status: Aktif\nStok: 28/60 kg • Hari ini: 4 transaksi\n\nDrop point di area Parigi Baru. Terima kardus, besi, dan botol bersih.`;
        } else {
          response = `Saya bisa bantu dengan:\n• Cek harga item spesifik (misal: "harga kardus")\n• Info drop point terdekat (4 lokasi aktif)\n• Rekomendasi item paling menguntungkan\n• Info Bank Sampah (misal: "kertabumi", "teratai")\n• Info Drop Point (misal: "PBH", "parigi")\n\nKetik pertanyaan Anda! 🤖`;
        }
        setAiChat(prev => [...prev, { role: "ai", text: response }]);
        setChatLoading(false);
      }, 800);
      return;
    }

    // ─── REAL API: Groq Llama 3 ───
    setChatLoading(true);
    try {
      const systemPrompt = buildChatSystemPrompt(margins);
      const historyMessages = [...aiChat, { role: "user", text: q }]
        .slice(-20)
        .map(msg => ({
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.text,
        }));

      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "system", content: systemPrompt }, ...historyMessages],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Groq API ${res.status}`);
      }

      const data = await res.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      if (!aiResponse) throw new Error("Empty response from Groq");

      setAiChat(prev => [...prev, { role: "ai", text: aiResponse }]);
    } catch (err) {
      console.error("Groq chat error:", err);
      setAiChat(prev => [...prev, {
        role: "ai",
        text: `⚠️ Maaf, terjadi gangguan koneksi AI.\n\n${err.message}\n\nSilakan coba lagi atau gunakan fitur lainnya.`,
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiChat]);

  const scanTotal = useMemo(() => {
    if (!scanResults) return 0;
    return scanResults.results.reduce((s, r) => {
      const item = findItem(r.code);
      if (!item) return s;
      return s + CASCADE(item.price, margins).user * r.weight;
    }, 0);
  }, [scanResults, margins]);

  const allTxTotal = useMemo(() => 
    TRANSACTIONS.reduce((s, tx) => s + getTxTotal(tx.items, margins), 0)
  , [margins]);

  // ─── CSS ───
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,800;1,9..144,400&display=swap');
    :root {
      --bg: #080C14; --bg2: #0D1420; --bg3: #131B2B;
      --border: rgba(255,255,255,0.06); --border2: rgba(255,255,255,0.1);
      --text: #CBD5E1; --text2: #64748B; --white: #F1F5F9;
      --green: #22C55E; --yellow: #F59E0B; --blue: #3B82F6; --purple: #A855F7;
      --red: #EF4444; --cyan: #06B6D4;
      --font: 'Sora', sans-serif; --mono: 'JetBrains Mono', monospace; --display: 'Fraunces', serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
    @keyframes scanBeam { 0% { top:-4px; } 100% { top:calc(100% - 4px); } }
    @keyframes pulseGlow { 0%,100% { box-shadow:0 0 8px rgba(34,197,94,0.2); } 50% { box-shadow:0 0 24px rgba(34,197,94,0.5); } }
    @keyframes slideIn { from { transform:translateX(-100%); } to { transform:translateX(0); } }
    @keyframes shimmer { 0% { background-position:-400px 0; } 100% { background-position:400px 0; } }
    @keyframes popIn { 0% { transform:scale(0.8); opacity:0; } 100% { transform:scale(1); opacity:1; } }
    .fu { animation: fadeUp 0.5s ease both; }
    .fu1 { animation: fadeUp 0.5s 0.05s ease both; }
    .fu2 { animation: fadeUp 0.5s 0.1s ease both; }
    .fu3 { animation: fadeUp 0.5s 0.15s ease both; }
    .fu4 { animation: fadeUp 0.5s 0.2s ease both; }
    .fu5 { animation: fadeUp 0.5s 0.25s ease both; }
    .fu6 { animation: fadeUp 0.5s 0.3s ease both; }
    .card { background:var(--bg3); border:1px solid var(--border); border-radius:16px; transition:all 0.25s; }
    .card:hover { border-color:var(--border2); transform:translateY(-1px); box-shadow:0 8px 32px rgba(0,0,0,0.3); }
    .btn { border:none; cursor:pointer; font-family:var(--font); transition:all 0.2s; }
    .btn:hover { filter:brightness(1.1); transform:scale(1.02); }
    .btn:active { transform:scale(0.98); }
    .pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:8px; font-size:11px; font-weight:600; }
    .mono { font-family:var(--mono); }
    .glow-green { animation: pulseGlow 2s ease infinite; }
    input[type=range] { width:100%; accent-color:var(--blue); cursor:pointer; height:4px; }
    input[type=range]::-webkit-slider-thumb { width:16px; height:16px; }
    ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }
    .shimmer-row { background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent); background-size:800px; animation:shimmer 2s infinite; }
  `;

  // ─── RENDER HELPERS ───
  const Badge = ({ children, color, outline }) => (
    <span className="pill" style={{
      background: outline ? "transparent" : `${color}18`,
      color: color,
      border: outline ? `1px solid ${color}40` : "none",
    }}>{children}</span>
  );

  const Stat = ({ icon, label, value, color, sub, delay = "" }) => (
    <div className={`card ${delay}`} style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 10, color: "var(--text2)", fontFamily: "var(--mono)", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "var(--display)", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const CascadeBar = ({ item, m }) => {
    const p = CASCADE(item.price, m);
    const levels = [
      { l: "Pelapak", v: p.pelapak, c: "var(--purple)" },
      { l: "Bank", v: p.bank, c: "var(--blue)" },
      { l: "Drop Pt", v: p.dropPoint, c: "var(--yellow)" },
      { l: "User", v: p.user, c: "var(--green)" },
    ];
    return (
      <div style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
        {levels.map((lv, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              height: Math.max(24, (lv.v / p.pelapak) * 56), borderRadius: 6,
              background: `${lv.c}`, opacity: 0.8, transition: "height 0.5s ease",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", color: "#000",
              minWidth: 0,
            }}>
              {lv.v >= 1000 ? `${(lv.v/1000).toFixed(1)}k` : lv.v}
            </div>
            <div style={{ fontSize: 8, color: "var(--text2)", marginTop: 3, fontFamily: "var(--mono)" }}>{lv.l}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)", color: "var(--text)", position: "relative" }}>
      <style>{CSS}</style>

      {/* Subtle grid bg */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.015, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle at 1px 1px, #fff 0.5px, transparent 0)",
        backgroundSize: "24px 24px" }} />

      {/* NOTIFICATION */}
      {notif && (
        <div style={{
          position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          padding: "12px 28px", borderRadius: 14,
          background: notif.type === "info" ? "rgba(59,130,246,0.92)" : "rgba(34,197,94,0.92)",
          color: "#fff", fontWeight: 600, fontSize: 13, backdropFilter: "blur(12px)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)", animation: "popIn 0.3s ease",
        }}>{notif.msg}</div>
      )}

      {/* ═══ HEADER ═══ */}
      <header style={{
        padding: "12px 20px", background: "rgba(8,12,20,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, #22C55E, #06B6D4)", fontSize: 17, fontWeight: 800,
              fontFamily: "var(--display)", color: "#000",
            }}>♻</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--display)", color: "var(--white)", letterSpacing: "-0.5px" }}>
                Eco<span style={{ color: "var(--green)" }}>Chain</span><span style={{ color: "var(--cyan)", fontSize: 12, fontStyle: "italic" }}> AI</span>
              </div>
              <div style={{ fontSize: 8, fontFamily: "var(--mono)", color: "var(--text2)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                Pondok Aren • Tangerang Selatan
              </div>
            </div>
          </div>

          {/* Role Switch */}
          <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 3 }}>
            {roles.map(r => (
              <button key={r.id} className="btn" onClick={() => {
                setRole(r.id);
                setTab(r.id === "user" ? "scan" : r.id === "dp" ? "cashier" : r.id === "bank" ? "overview" : "pricing");
                setDpDetail(null);
              }} style={{
                padding: "7px 13px", borderRadius: 9,
                background: role === r.id ? `${r.c}15` : "transparent",
                color: role === r.id ? r.c : "var(--text2)",
                fontWeight: 600, fontSize: 11,
                border: role === r.id ? `1px solid ${r.c}30` : "1px solid transparent",
              }}>
                <span style={{ marginRight: 4 }}>{r.icon}</span>{r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ═══ MAIN ═══ */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>

        {/* ROLE BANNER */}
        <div className="fu" style={{
          padding: "18px 22px", borderRadius: 16, marginBottom: 20,
          background: `linear-gradient(135deg, ${activeRole.c}08, ${activeRole.c}03)`,
          border: `1px solid ${activeRole.c}20`,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ fontSize: 32 }}>{activeRole.icon}</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)" }}>
              {activeRole.label}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text2)", marginLeft: 8, fontFamily: "var(--font)" }}>— {activeRole.sub}</span>
            </h2>
            <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 3 }}>
              {role === "user" && "🤖 Smart Waste Scout — Scan, estimasi nilai, temukan drop point terdekat"}
              {role === "dp" && "🤖 Rapid Cashier Agent — Foto → Auto-price → OCR timbangan → Ijab Kabul"}
              {role === "bank" && "🤖 Logistics Commander — Monitor stok, routing penjemputan, margin management"}
              {role === "pelapak" && "🤖 Price Setter — Upload harga pasar → AI cascade ke seluruh rantai"}
            </p>
          </div>
        </div>

        {/* ╔══════════════════════════════════════╗ */}
        {/* ║          USER VIEW                   ║ */}
        {/* ╚══════════════════════════════════════╝ */}
        {role === "user" && (<>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {[
              { id: "scan", label: "📷 Scan", desc: "Vision AI" },
              { id: "map", label: "📍 Drop Point", desc: "Lokasi" },
              { id: "chat", label: "💬 Tanya AI", desc: "Assistant" },
              { id: "wallet", label: "💰 Poin", desc: "Riwayat" },
            ].map(t => (
              <button key={t.id} className="btn" onClick={() => setTab(t.id)} style={{
                flex: 1, padding: "12px 10px", borderRadius: 12, textAlign: "left",
                background: tab === t.id ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.02)",
                color: tab === t.id ? "var(--green)" : "var(--text2)",
                fontWeight: 600, fontSize: 12,
                border: `1px solid ${tab === t.id ? "rgba(34,197,94,0.25)" : "var(--border)"}`,
              }}>
                <div>{t.label}</div>
                <div style={{ fontSize: 9, fontFamily: "var(--mono)", opacity: 0.6, marginTop: 1 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* SCAN TAB */}
          {tab === "scan" && (
            <div className="fu">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleImageCapture} />
              <div className="card" style={{ padding: 28, textAlign: "center", position: "relative", overflow: "hidden", minHeight: 200 }}>
                {scanning && <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "var(--green)", animation: "scanBeam 1.5s linear infinite", borderRadius: 2 }} />}

                {!scanResults ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    {scanning && scanPhoto ? (
                      <img src={scanPhoto} alt="Captured" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 16, border: "2px solid var(--green)", opacity: 0.8 }} />
                    ) : (
                      <div className={scanning ? "glow-green" : ""} style={{
                        width: 72, height: 72, borderRadius: 18,
                        background: scanning ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
                        transition: "all 0.3s",
                      }}>{scanning ? "🔍" : "📷"}</div>
                    )}
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)" }}>
                        {scanning ? "Menganalisis foto..." : "Smart Waste Scout"}
                      </h3>
                      <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 4, maxWidth: 360 }}>
                        {scanning ? "Gemini Vision AI mendeteksi jenis sampah & estimasi berat" : "Foto tumpukan sampah → AI deteksi jenis, berat, dan estimasi nilai tukar"}
                      </p>
                    </div>
                    {!scanning && (
                      <button onClick={doScan} className="btn" style={{
                        marginTop: 8, padding: "13px 36px", borderRadius: 12,
                        background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff",
                        fontWeight: 700, fontSize: 14, letterSpacing: "-0.3px",
                      }}>📸 Ambil Foto Sampah</button>
                    )}
                    {scanError && !scanning && (
                      <div style={{ marginTop: 8, padding: "10px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "var(--red)" }}>
                        {scanError}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "var(--text2)", fontFamily: "var(--mono)" }}>
                      {GEMINI_API_KEY ? "Powered by Google Gemini Vision AI" : `Demo Mode — ${SCAN_SCENARIOS[scanIdx].label}`}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      <Badge color="var(--green)">🤖 SMART WASTE SCOUT</Badge>
                      <span style={{ fontSize: 11, color: "var(--text2)" }}>— {scanResults.label}</span>
                      {!GEMINI_API_KEY && <Badge color="var(--yellow)" outline>DEMO</Badge>}
                    </div>

                    {scanResults.results.map((r, i) => {
                      const item = findItem(r.code);
                      const cat = WASTE_DB[r.cat];
                      const prices = item ? CASCADE(item.price, margins) : null;
                      const val = prices ? Math.round(prices.user * r.weight) : 0;
                      return (
                        <div key={i} className={`card fu${Math.min(i+1, 6)}`} style={{ padding: "14px 18px", marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                <span style={{ fontSize: 15 }}>{cat?.icon}</span>
                                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--white)" }}>{r.item}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <Badge color={cat?.accent || "#888"} outline>{cat?.label}</Badge>
                                <Badge color="var(--text2)" outline>{r.code}</Badge>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--green)", fontFamily: "var(--mono)" }}>{rp(val)}</div>
                              <div style={{ fontSize: 10, color: "var(--text2)", fontFamily: "var(--mono)" }}>{kg(r.weight)} × {rp(prices?.user || 0)}</div>
                            </div>
                          </div>
                          {/* Cascade mini */}
                          {prices && (
                            <div style={{ marginTop: 8, marginBottom: r.tip ? 8 : 0 }}>
                              <CascadeBar item={item} m={margins} />
                            </div>
                          )}
                          {r.tip && (
                            <div style={{
                              marginTop: 8, padding: "10px 14px", borderRadius: 10,
                              background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)",
                              fontSize: 11, color: "var(--yellow)", lineHeight: 1.6,
                            }}>{r.tip}</div>
                          )}
                        </div>
                      );
                    })}

                    {/* Total */}
                    <div style={{
                      marginTop: 16, padding: "18px 22px", borderRadius: 14,
                      background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(6,182,212,0.05))",
                      border: "1px solid rgba(34,197,94,0.2)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>Total Estimasi Poin</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)", fontFamily: "var(--display)" }}>
                          <Anim value={Math.round(scanTotal)} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => flash("📍 Navigasi ke Drop Point terdekat...")} className="btn" style={{
                          padding: "10px 18px", borderRadius: 10, background: "var(--green)", color: "#000", fontWeight: 700, fontSize: 12,
                        }}>📍 Antar ke DP</button>
                        <button onClick={() => { setScanResults(null); setScanPhoto(null); setScanError(null); }} className="btn" style={{
                          padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "var(--text)", fontWeight: 600, fontSize: 12, border: "1px solid var(--border)",
                        }}>📸 Scan Ulang</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MAP TAB */}
          {tab === "map" && (
            <div className="fu">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Badge color="var(--cyan)">🤖 GEOTAGGING AGENT</Badge>
                <span style={{ fontSize: 11, color: "var(--text2)" }}>Drop point & Bank Sampah di Pondok Aren</span>
              </div>
              
              {/* Drop Points */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--yellow)", marginBottom: 8, fontFamily: "var(--mono)", letterSpacing: 0.5 }}>📍 DROP POINTS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {NETWORK.dropPoints.map((dp, i) => (
                  <div key={dp.id} className={`card fu${i+1}`} style={{ padding: "18px 20px", cursor: "pointer" }} onClick={() => setDpDetail(dpDetail === dp.id ? null : dp.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Badge color="var(--green)">● AKTIF</Badge>
                      <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text2)" }}>{dp.todayTx} tx hari ini</span>
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--white)", fontFamily: "var(--display)", marginBottom: 2 }}>{dp.name}</h4>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 10 }}>{dp.address}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>👤 {dp.operator} • {dp.type}</div>
                    
                    {/* Stock Bar */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text2)", marginBottom: 3 }}>
                        <span>Stok</span>
                        <span className="mono">{dp.stock}/{dp.capacity} kg</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3, transition: "width 1s ease",
                          width: `${(dp.stock/dp.capacity)*100}%`,
                          background: dp.stock/dp.capacity > 0.8 ? "linear-gradient(90deg, var(--yellow), var(--red))" : "linear-gradient(90deg, var(--green), var(--cyan))",
                        }} />
                      </div>
                    </div>

                    {dpDetail === dp.id && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", animation: "fadeUp 0.3s ease" }}>
                        <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>Top items: {dp.topItems.join(", ")}</div>
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>Revenue minggu ini: <span className="mono" style={{ color: "var(--green)" }}>{rp(dp.weekRevenue)}</span></div>
                        <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text2)", marginTop: 4 }}>
                          📐 {dp.lat.toFixed(6)}, {dp.lng.toFixed(6)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bank Sampah */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", marginBottom: 8, fontFamily: "var(--mono)", letterSpacing: 0.5 }}>🏦 BANK SAMPAH NETWORK</div>
              {NETWORK.bankSampah.map((bs, i) => (
                <div key={bs.id} className={`card fu${i+2}`} style={{ padding: "16px 20px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--white)", fontFamily: "var(--display)" }}>{bs.name}</h4>
                        <Badge color="var(--yellow)">⭐ {bs.rating}</Badge>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>{bs.address}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>⏰ {bs.hours} • 📞 {bs.phone}</div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 10, fontFamily: "var(--mono)", color: "var(--text2)" }}>
                      <div>→ DP1: {bs.distToDp1}</div>
                      <div>→ DP2: {bs.distToDp2}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <Badge color="var(--cyan)" outline>{bs.specialty}</Badge>
                    <Badge color="var(--text2)" outline>Cap: {bs.monthlyCapacity}/bln</Badge>
                    {bs.website && <Badge color="var(--green)" outline>🌐 {bs.website}</Badge>}
                  </div>
                </div>
              ))}

              {/* Pelapak */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--purple)", marginBottom: 8, marginTop: 18, fontFamily: "var(--mono)", letterSpacing: 0.5 }}>🏭 PELAPAK / OFFTAKER</div>
              {NETWORK.pelapak.map((pl, i) => (
                <div key={pl.id} className={`card fu${i+4}`} style={{ padding: "16px 20px" }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--white)", fontFamily: "var(--display)", marginBottom: 2 }}>{pl.name}</h4>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>{pl.address} • {pl.type}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>📞 {pl.phone} • 🌐 {pl.website}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {pl.accepts.map(a => <Badge key={a} color="var(--purple)" outline>{a}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CHAT TAB */}
          {tab === "chat" && (
            <div className="fu">
              <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: 480 }}>
                {/* Chat Header */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, var(--green), var(--cyan))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--white)" }}>EcoChain Assistant</div>
                    <div style={{ fontSize: 10, color: GROQ_API_KEY ? "var(--green)" : "var(--yellow)" }}>
                      {GROQ_API_KEY ? "● Online — RAG + Groq Llama 3" : "● Demo Mode — API key belum dikonfigurasi"}
                    </div>
                  </div>
                </div>
                
                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                  {aiChat.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
                      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Tanya apa saja tentang sampah & harga!</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                        {["Harga kardus?", "Drop point terdekat", "Item paling mahal?", "Info Kertabumi", "Info Teratai", "Info PBH"].map(q => (
                          <button key={q} className="btn" onClick={() => sendChat(q)}
                            style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 11, fontWeight: 500 }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiChat.map((msg, i) => (
                    <div key={i} style={{
                      marginBottom: 12, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                      animation: "fadeUp 0.3s ease",
                    }}>
                      <div style={{
                        maxWidth: "80%", padding: "12px 16px", borderRadius: 14,
                        background: msg.role === "user" ? "var(--green)" : "var(--bg3)",
                        color: msg.role === "user" ? "#000" : "var(--text)",
                        fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
                        border: msg.role === "ai" ? "1px solid var(--border)" : "none",
                        fontWeight: msg.role === "user" ? 600 : 400,
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-start", animation: "fadeUp 0.3s ease" }}>
                      <div style={{
                        padding: "12px 16px", borderRadius: 14, background: "var(--bg3)",
                        border: "1px solid var(--border)", fontSize: 12, color: "var(--text2)",
                      }}>
                        <span style={{ animation: "pulse 1.5s infinite" }}>Mengetik...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !chatLoading && sendChat()}
                    placeholder="Tanya harga, lokasi, tips..."
                    disabled={chatLoading}
                    style={{
                      flex: 1, padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.03)", color: "var(--white)", fontSize: 13,
                      fontFamily: "var(--font)", outline: "none",
                      opacity: chatLoading ? 0.5 : 1,
                    }} />
                  <button onClick={() => sendChat()} disabled={chatLoading} className="btn" style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: chatLoading ? "var(--bg3)" : "var(--green)",
                    color: chatLoading ? "var(--text2)" : "#000",
                    fontWeight: 700, fontSize: 13,
                    cursor: chatLoading ? "not-allowed" : "pointer",
                  }}>{chatLoading ? "..." : "Kirim"}</button>
                </div>
              </div>
            </div>
          )}

          {/* WALLET TAB */}
          {tab === "wallet" && (
            <div className="fu">
              <div style={{
                padding: "28px", borderRadius: 20, marginBottom: 18, textAlign: "center",
                background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(6,182,212,0.06))",
                border: "1px solid rgba(34,197,94,0.2)",
              }}>
                <div style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--mono)" }}>TOTAL POIN TERKUMPUL</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "var(--green)", fontFamily: "var(--display)", marginTop: 4 }}>
                  <Anim value={Math.round(allTxTotal)} dur={1000} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>{TRANSACTIONS.length} transaksi</div>
              </div>
              {TRANSACTIONS.map((tx, i) => {
                const total = getTxTotal(tx.items, margins);
                return (
                  <div key={tx.id} className={`card fu${Math.min(i+1, 6)}`} style={{ padding: "14px 18px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 12, color: "var(--white)" }}>{tx.id}</span>
                        <Badge color={tx.status === "done" ? "var(--green)" : "var(--yellow)"} outline>
                          {tx.status === "done" ? "SELESAI" : "PENDING"}
                        </Badge>
                      </div>
                      <span className="mono" style={{ fontWeight: 700, color: "var(--green)", fontSize: 14 }}>+{rp(total)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>
                      👤 {tx.user} → 📍 {NETWORK.dropPoints.find(d => d.id === tx.dp)?.name?.split(" ").slice(2).join(" ") || tx.dp} • {tx.date} {tx.time}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 2 }}>
                      {tx.items.map(it => `${it.name} (${it.w}kg)`).join(" + ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>)}

        {/* ╔══════════════════════════════════════╗ */}
        {/* ║       DROP POINT VIEW                ║ */}
        {/* ╚══════════════════════════════════════╝ */}
        {role === "dp" && (<>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            <Stat icon="💰" label="Hari Ini" value={<Anim value={211800} />} color="var(--yellow)" sub="13 transaksi" delay="fu1" />
            <Stat icon="📦" label="Total Stok" value="173 kg" color="var(--white)" sub="4 Drop Point" delay="fu2" />
            <Stat icon="📈" label="Minggu Ini" value={<Anim value={1535000} />} color="var(--green)" sub="+18% vs lalu" delay="fu3" />
            <Stat icon="⚡" label="Margin" value="20%" color="var(--cyan)" sub="Avg per item" delay="fu4" />
          </div>

          {/* Rapid Cashier Flow */}
          <div className="fu2" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              🤖 Rapid Cashier Agent — Flow Transaksi
            </h3>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {[
                { s: 1, icon: "📷", label: "Foto Barang", desc: "Gemini Vision Free", c: "var(--blue)" },
                { s: 2, icon: "🏷️", label: "Auto-Detect", desc: "RAG Price Lookup", c: "var(--purple)" },
                { s: 3, icon: "⚖️", label: "OCR Timbangan", desc: "Tesseract Free", c: "var(--yellow)" },
                { s: 4, icon: "🤝", label: "Ijab Kabul", desc: "Notif ke User", c: "var(--green)" },
              ].map((st, i) => (
                <div key={st.s} className={`card fu${i+1}`} style={{ flex: "0 0 160px", padding: "18px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>{st.icon}</div>
                  <Badge color={st.c}>STEP {st.s}</Badge>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--white)", marginTop: 6 }}>{st.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text2)", fontFamily: "var(--mono)", marginTop: 2 }}>{st.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Table */}
          <div className="fu3">
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              💰 Harga Beli Drop Point <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text2)" }}>(auto-cascade dari Pelapak)</span>
            </h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
              {Object.entries(WASTE_DB).map(([k, v]) => (
                <button key={k} className="btn" onClick={() => setCatFilter(k)} style={{
                  padding: "7px 13px", borderRadius: 9, whiteSpace: "nowrap", fontSize: 11, fontWeight: 600,
                  background: catFilter === k ? `${v.accent}20` : "rgba(255,255,255,0.02)",
                  color: catFilter === k ? v.accent : "var(--text2)",
                  border: `1px solid ${catFilter === k ? `${v.accent}30` : "var(--border)"}`,
                }}>{v.icon} {v.label}</button>
              ))}
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 18px", background: "rgba(255,255,255,0.02)", fontSize: 9, fontFamily: "var(--mono)", color: "var(--text2)", fontWeight: 700, letterSpacing: 0.5 }}>
                <span>ITEM</span>
                <span style={{ textAlign: "right" }}>HARGA BELI DP</span>
                <span style={{ textAlign: "right" }}>BAYAR USER</span>
              </div>
              {WASTE_DB[catFilter]?.items.map((item, i) => {
                const p = CASCADE(item.price, margins);
                return (
                  <div key={item.code} className={priceUpdating ? "shimmer-row" : ""} style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 18px",
                    borderTop: "1px solid var(--border)", fontSize: 12, alignItems: "center",
                    cursor: "pointer", transition: "background 0.2s",
                  }} onClick={() => setShowCascadeFor(showCascadeFor === item.code ? null : item.code)}>
                    <span>
                      <span className="mono" style={{ fontSize: 9, color: "var(--text2)", marginRight: 6 }}>{item.code}</span>
                      <span style={{ color: "var(--white)" }}>{item.name}</span>
                    </span>
                    <span className="mono" style={{ textAlign: "right", fontWeight: 700, color: "var(--yellow)" }}>{rp(p.dropPoint)}</span>
                    <span className="mono" style={{ textAlign: "right", fontWeight: 600, color: "var(--green)" }}>{rp(p.user)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>)}

        {/* ╔══════════════════════════════════════╗ */}
        {/* ║       BANK SAMPAH VIEW               ║ */}
        {/* ╚══════════════════════════════════════╝ */}
        {role === "bank" && (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            <Stat icon="📦" label="Total Stok" value="173 kg" color="var(--blue)" sub="4 Drop Points" delay="fu1" />
            <Stat icon="📍" label="Drop Points" value="4 aktif" color="var(--green)" sub="Pondok Aren" delay="fu2" />
            <Stat icon="💰" label="Revenue Bln" value={<Anim value={4850000} />} color="var(--yellow)" sub="+23% vs lalu" delay="fu3" />
            <Stat icon="🏦" label="Bank Mitra" value="3" color="var(--purple)" sub="Kertabumi lead" delay="fu4" />
          </div>

          {/* Smart Routing */}
          <div className="fu2" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              🤖 Logistics Commander — Smart Routing
            </h3>
            <div className="card" style={{ padding: 20 }}>
              <div style={{
                background: "var(--bg)", borderRadius: 12, padding: 18,
                fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", lineHeight: 2.0,
              }}>
                <div style={{ color: "var(--red)", fontWeight: 700, marginBottom: 4 }}>🔴 PRIORITAS PENJEMPUTAN:</div>
                <div style={{ paddingLeft: 16 }}>
                  <div>1. <span style={{ color: "var(--white)" }}>Jl. H. Saan Tumpang</span> — 67/100 kg (67%)</div>
                  <div style={{ paddingLeft: 16, fontSize: 10, color: "var(--text2)" }}>Top: Kardus, Botol Bersih, Ember</div>
                </div>
                <div style={{ paddingLeft: 16 }}>
                  <div>2. <span style={{ color: "var(--white)" }}>Pondok Kacang Barat</span> — 43/80 kg (54%)</div>
                  <div style={{ paddingLeft: 16, fontSize: 10, color: "var(--text2)" }}>Top: Besi, Alumunium, Kaleng</div>
                </div>
                <div style={{ color: "var(--green)", fontWeight: 700, marginTop: 12, marginBottom: 4 }}>🟢 RUTE OPTIMAL:</div>
                <div style={{ paddingLeft: 16 }}>
                  <div style={{ color: "var(--white)" }}>DP2 (Pd. Kacang) → Kertabumi (300m) → DP1 (H. Saan) → Kertabumi</div>
                  <div style={{ fontSize: 10, color: "var(--text2)" }}>Estimasi: 25 menit, 4.2 km • Total angkut: ~110 kg</div>
                </div>
                <div style={{ color: "var(--cyan)", fontWeight: 700, marginTop: 12, marginBottom: 4 }}>💡 REKOMENDASI AI:</div>
                <div style={{ paddingLeft: 16, fontSize: 10, color: "var(--text2)" }}>
                  <div>• Kertabumi kapasitas 2 ton/bln — 110 kg masih sangat OK</div>
                  <div>• Jadwalkan pickup Rabu & Sabtu untuk cycle time optimal</div>
                  <div>• DP1 punya banyak Minyak Jelantah — bawa wadah khusus</div>
                </div>
              </div>
            </div>
          </div>

          {/* Margin Manager */}
          <div className="fu3">
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              ⚙️ Margin Manager — Cascading Price Control
            </h3>
            <div className="card" style={{ padding: 24 }}>
              {/* Cascade Visual: Alumunium example */}
              <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text2)", marginBottom: 12, letterSpacing: 0.5 }}>
                CASCADING FLOW — Contoh: Alumunium Rp11.000/kg
              </div>
              {(() => {
                const p = CASCADE(11000, margins);
                const lvs = [
                  { l: "🏭 Pelapak", v: p.pelapak, c: "var(--purple)", m: "—" },
                  { l: "🏦 Bank Sampah", v: p.bank, c: "var(--blue)", m: `${Math.round(margins.pelapakToBank*100)}%` },
                  { l: "📍 Drop Point", v: p.dropPoint, c: "var(--yellow)", m: `${Math.round(margins.bankToDropPoint*100)}%` },
                  { l: "👤 User", v: p.user, c: "var(--green)", m: `${Math.round(margins.dropPointToUser*100)}%` },
                ];
                return (
                  <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
                    {lvs.map((lv, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{
                          flex: 1, padding: "14px 6px", borderRadius: 12, textAlign: "center",
                          background: `${lv.c}10`, border: `1px solid ${lv.c}25`,
                        }}>
                          <div style={{ fontSize: 14 }}>{lv.l.split(" ")[0]}</div>
                          <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 2 }}>{lv.l.split(" ").slice(1).join(" ")}</div>
                          <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: lv.c, marginTop: 4 }}>{rp(lv.v)}</div>
                          {lv.m !== "—" && <div style={{ fontSize: 9, color: "var(--text2)", marginTop: 2 }}>margin {lv.m}</div>}
                        </div>
                        {i < lvs.length - 1 && <span style={{ color: "var(--text2)", fontSize: 12 }}>→</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Margin Sliders */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                {[
                  { key: "pelapakToBank", label: "🏭→🏦 Pelapak → Bank", c: "var(--blue)" },
                  { key: "bankToDropPoint", label: "🏦→📍 Bank → Drop Pt", c: "var(--yellow)" },
                  { key: "dropPointToUser", label: "📍→👤 Drop Pt → User", c: "var(--green)" },
                ].map(s => (
                  <div key={s.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                      <span style={{ color: "var(--text2)" }}>{s.label}</span>
                      <span className="mono" style={{ fontWeight: 700, color: s.c }}>{Math.round(margins[s.key]*100)}%</span>
                    </div>
                    <input type="range" min={5} max={40} value={margins[s.key]*100}
                      onChange={e => setMargins(p => ({...p, [s.key]: +e.target.value/100}))}
                      style={{ accentColor: s.c }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="fu4" style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              📋 Transaksi Terkini
            </h3>
            {TRANSACTIONS.map((tx, i) => {
              const total = getTxTotal(tx.items, margins);
              const dp = NETWORK.dropPoints.find(d => d.id === tx.dp);
              return (
                <div key={tx.id} className={`card fu${Math.min(i+1,6)}`} style={{ padding: "12px 18px", marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--white)" }}>{tx.id}</span>
                      <Badge color={tx.status === "done" ? "var(--green)" : "var(--yellow)"}>
                        {tx.status === "done" ? "✓" : "⏳"} {tx.status === "done" ? "DONE" : "PENDING"}
                      </Badge>
                    </div>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--blue)", fontSize: 13 }}>{rp(total)}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 3 }}>
                    👤 {tx.user} → 📍 {dp?.operator || tx.dp} • {tx.date} {tx.time} • {tx.items.map(it => `${it.name} ${it.w}kg`).join(" + ")}
                  </div>
                </div>
              );
            })}
          </div>
        </>)}

        {/* ╔══════════════════════════════════════╗ */}
        {/* ║       PELAPAK VIEW                   ║ */}
        {/* ╚══════════════════════════════════════╝ */}
        {role === "pelapak" && (<>
          {/* Upload Area */}
          <div className="card fu1" style={{
            padding: 36, textAlign: "center", marginBottom: 24,
            background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(6,182,212,0.04))",
          }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📸</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 6 }}>
              Price Setter — Upload Harga Pasar
            </h3>
            <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 20, maxWidth: 460, margin: "0 auto 20px" }}>
              Upload foto/PDF daftar harga terbaru dari pasar. Pricing Agent (Gemini Vision) akan membaca dokumen dan auto-cascade ke Bank Sampah → Drop Point → User.
            </p>
            <button onClick={doPriceUpdate} className="btn" style={{
              padding: "14px 36px", borderRadius: 13, fontSize: 15, fontWeight: 700,
              background: "linear-gradient(135deg, #A855F7, #7C3AED)", color: "#fff",
            }}>
              {priceUpdating ? "⏳ Memproses..." : "📷 Upload Daftar Harga"}
            </button>
            <div className="mono" style={{ fontSize: 10, color: "var(--text2)", marginTop: 12 }}>
              Sumber: DB_Harga_Sampah.jpeg • Berlaku: 02 Januari 2026
            </div>
          </div>

          {/* Full Cascade Table */}
          <div className="fu2">
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              🔄 Cascading Price — All Levels Preview
            </h3>
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr", padding: "10px 18px",
                background: "rgba(255,255,255,0.02)", fontSize: 9, fontFamily: "var(--mono)",
                color: "var(--text2)", fontWeight: 700, letterSpacing: 0.5,
              }}>
                <span>ITEM</span>
                <span style={{ textAlign: "right", color: "var(--purple)" }}>🏭 PELAPAK</span>
                <span style={{ textAlign: "right", color: "var(--blue)" }}>🏦 BANK</span>
                <span style={{ textAlign: "right", color: "var(--yellow)" }}>📍 DROP PT</span>
                <span style={{ textAlign: "right", color: "var(--green)" }}>👤 USER</span>
              </div>
              {Object.entries(WASTE_DB).flatMap(([catKey, cat]) =>
                cat.items.slice(0, catKey === "elektronik" ? 3 : catKey === "lainnya" ? 4 : 3).map(item => {
                  const p = CASCADE(item.price, margins);
                  return (
                    <div key={item.code} className={priceUpdating ? "shimmer-row" : ""} style={{
                      display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr", padding: "9px 18px",
                      borderTop: "1px solid var(--border)", fontSize: 11, alignItems: "center",
                    }}>
                      <span>
                        <span style={{ marginRight: 6 }}>{cat.icon}</span>
                        <span style={{ color: "var(--text)" }}>{item.name.length > 28 ? item.name.slice(0, 28) + "…" : item.name}</span>
                        {item.unit && <span className="mono" style={{ fontSize: 8, color: "var(--text2)", marginLeft: 4 }}>/{item.unit}</span>}
                      </span>
                      <span className="mono" style={{ textAlign: "right", fontWeight: 600, color: "var(--purple)" }}>{rp(p.pelapak)}</span>
                      <span className="mono" style={{ textAlign: "right", fontWeight: 600, color: "var(--blue)" }}>{rp(p.bank)}</span>
                      <span className="mono" style={{ textAlign: "right", fontWeight: 600, color: "var(--yellow)" }}>{rp(p.dropPoint)}</span>
                      <span className="mono" style={{ textAlign: "right", fontWeight: 600, color: "var(--green)" }}>{rp(p.user)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Architecture */}
          <div className="fu3" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              🏗️ Free Tier Architecture Stack
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { icon: "🧠", label: "AI / RAG", desc: "Groq Llama 3 (free) + Google Gemini Vision (free 1K/mo)", c: "var(--green)" },
                { icon: "⚡", label: "Automation", desc: "n8n Self-hosted — workflow engine untuk cascade pricing", c: "var(--yellow)" },
                { icon: "💾", label: "Database", desc: "Supabase Free — PostgreSQL + Auth + Realtime", c: "var(--blue)" },
                { icon: "📱", label: "Frontend", desc: "Telegram Bot (User & DP) + PWA React (Bank & Pelapak)", c: "var(--purple)" },
                { icon: "📍", label: "Geolocation", desc: "Kode Pos BPS + OpenStreetMap — fully free", c: "var(--cyan)" },
                { icon: "👁️", label: "OCR / Vision", desc: "Tesseract (weight) + Gemini Vision (waste detection)", c: "var(--red)" },
              ].map((a, i) => (
                <div key={i} className={`card fu${Math.min(i+1,6)}`} style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.c, fontFamily: "var(--display)" }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 3, lineHeight: 1.5 }}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Summary */}
          <div className="fu4" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--display)", color: "var(--white)", marginBottom: 12 }}>
              🌐 Network Summary — Pondok Aren, Tangsel
            </h3>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 2.2, color: "var(--text)" }}>
                <div style={{ fontWeight: 700, color: "var(--yellow)" }}>📍 DROP POINTS (Level 2):</div>
                <div style={{ paddingLeft: 16 }}>• Jl. H. Saan Tumpang, Parigi Baru — <span style={{ color: "var(--green)" }}>Pak Ahmad</span></div>
                <div style={{ paddingLeft: 16 }}>• Pondok Kacang Barat — <span style={{ color: "var(--green)" }}>Bang Roni</span></div>
                
                <div style={{ fontWeight: 700, color: "var(--blue)", marginTop: 8 }}>🏦 BANK SAMPAH (Level 3):</div>
                <div style={{ paddingLeft: 16 }}>• <span style={{ color: "var(--white)" }}>Kertabumi Recycling Center</span> ⭐4.5 — 300m dari DP2 — <span style={{ color: "var(--cyan)" }}>HUB UTAMA</span></div>
                <div style={{ paddingLeft: 16 }}>• Bank Sampah Japos Raya ⭐5.0 — komunitas ibu RT</div>
                <div style={{ paddingLeft: 16 }}>• Bank Sampah Kasuari — node tambahan</div>
                
                <div style={{ fontWeight: 700, color: "var(--purple)", marginTop: 8 }}>🏭 PELAPAK (Level 4):</div>
                <div style={{ paddingLeft: 16 }}>• <span style={{ color: "var(--white)" }}>Wastehub® Jakarta Area</span> — aggregator platform — wastehub.webflow.io</div>
                
                <div style={{ fontWeight: 700, color: "var(--green)", marginTop: 8 }}>📊 METRIK:</div>
                <div style={{ paddingLeft: 16 }}>• Coverage: ~5 km² area Pondok Aren</div>
                <div style={{ paddingLeft: 16 }}>• Kapasitas: ~3.5 ton/bulan (combined Bank Sampah)</div>
                <div style={{ paddingLeft: 16 }}>• Pipeline: Rp4.8M+ revenue/bulan</div>
              </div>
            </div>
          </div>
        </>)}

      </main>

      {/* FOOTER */}
      <footer style={{
        padding: "18px 24px", textAlign: "center", borderTop: "1px solid var(--border)",
        fontSize: 10, color: "var(--text2)", fontFamily: "var(--mono)", letterSpacing: 0.3, lineHeight: 1.8,
      }}>
        <div>EcoChain AI Marketplace • Cascading Price Model • Free Tier Architecture</div>
        <div>Harga berlaku mulai 02 Januari 2026 • Network: Pondok Aren, Tangerang Selatan</div>
        <div style={{ marginTop: 4, color: "var(--green)" }}>Powered by Groq + Gemini Vision + n8n + Supabase</div>
      </footer>
    </div>
  );
}
