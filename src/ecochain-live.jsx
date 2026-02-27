import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// ECOCHAIN AI MARKETPLACE — SUPABASE CONNECTED
// Live: ecochain-ai-marketplace.sopian-hadianto.workers.dev
// DB: Supabase eco-chain-marketplace (YouKnowLah)
// ═══════════════════════════════════════════════════════════════

// ─── SUPABASE CONFIG ───
// ⚠️ GANTI DENGAN CREDENTIALS ANDA:
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── GEMINI VISION AI CONFIG ───
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY || "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── GROQ CHAT AI CONFIG ───
const GROQ_API_KEY = import.meta.env.VITE_GROQ_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ─── LIGHTWEIGHT SUPABASE CLIENT (no SDK needed) ───
const sb = {
  headers: (token) => ({
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  }),
  async query(table, params = "", token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: sb.headers(token) });
    if (!r.ok) throw new Error(`Query failed: ${r.status}`);
    return r.json();
  },
  async insert(table, data, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST", headers: { ...sb.headers(token), Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.message || `Insert failed`); }
    return r.json();
  },
  async update(table, match, data, token) {
    const params = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join("&");
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      method: "PATCH", headers: { ...sb.headers(token), Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`Update failed: ${r.status}`);
    return r.json();
  },
  async rpc(fn, args, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: sb.headers(token), body: JSON.stringify(args),
    });
    return r.json();
  },
  // Auth
  async signUp(email, password, meta) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, data: meta }),
    });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || data.error?.message || `Login gagal (${r.status})`);
    return data;
  },
  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    return r.json();
  },
};

// ─── GEMINI VISION HELPERS ───
const buildWastePrompt = (prices) => {
  const grouped = {};
  for (const p of prices) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(`${p.item_code}=${p.name} (${p.unit})`);
  }
  let codes = "";
  for (const [cat, items] of Object.entries(grouped)) {
    codes += `${cat.toUpperCase()}: ${items.join(", ")}\n`;
  }
  return `Kamu adalah AI waste sorting expert untuk Bank Sampah di Indonesia.
Analisis foto ini dan identifikasi SEMUA item sampah yang bisa dijual/didaur ulang.

PENTING — PANDUAN VISUAL untuk identifikasi akurat:
• Botol plastik BERSIH (transparan, tanpa label, kering) → kode "Botol Bersih", BUKAN "Mineral Kotor"
• Botol plastik KOTOR (ada label, basah, kusam) → kode "Botol / Gelas Mineral Kotor"
• Gelas plastik bening (cup bersih) → "Gelas Bersih"
• Kardus coklat (box paket, karton) → "Kardus / Box"
• Kertas putih (HVS, fotokopi) → "HVS / Putihan"
• Ember warna-warni → "Ember Campur / Emberan"
• Ember hitam / pot tanaman → "Ember Hitam / Pot Bunga"
• Kaleng aluminium (ringan, bisa diremas) → "Alumunium"
• Kaleng baja/timah (berat, label makanan) → "Kaleng"
• Besi (konstruksi, paku, baja) → "Besi" atau "Kabin / Paku / Baja Ringan"
• Botol/jerigen minyak bekas → "Minyak Jelantah"
• Galon air besar (19L) → "Botol Galon"
• Tutup galon/botol (kecil, warna) → "Tutup Galon / LD" atau "Tutup Botol"
• Kabel listrik → "Kabel"
• Barang elektronik → identifikasi spesifik (TV, Laptop, dll)
• Styrofoam (putih, ringan) → "Styrofoam"

DAFTAR KODE LENGKAP (gunakan HANYA kode ini):
${codes}
ESTIMASI BERAT — gunakan referensi:
• 1 botol plastik 600ml ≈ 0.03 kg, 12 botol ≈ 0.35 kg
• 1 kardus sedang ≈ 0.5-1.5 kg, kardus besar ≈ 2-5 kg
• 1 kaleng minuman ≈ 0.015 kg
• 1 ember plastik ≈ 0.3-0.8 kg
• Besi/logam terlihat berat: estimasi konservatif
• Jika banyak item sejenis, hitung jumlah lalu kalikan

Untuk setiap item berikan:
- item: deskripsi singkat apa yang TERLIHAT di foto (termasuk jumlah jika >1)
- code: kode TEPAT dari daftar di atas
- cat: kategori key (${Object.keys(grouped).join("/")})
- weight: estimasi total berat dalam kg
- tip: tips sorting PRAKTIS dalam Bahasa Indonesia untuk dapat harga lebih tinggi, atau null

Format JSON:
{"label":"deskripsi singkat tumpukan","results":[{"item":"...","code":"...","cat":"...","weight":0.0,"tip":"...atau null"}]}
Jika tidak ada sampah yang bisa didaur ulang: {"label":"Tidak terdeteksi","results":[]}`;
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
    const dataUrl = c.toDataURL("image/jpeg", 0.8);
    URL.revokeObjectURL(img.src);
    resolve({ base64: dataUrl.split(",")[1], preview: dataUrl });
  };
  img.onerror = () => reject(new Error("Gagal memuat gambar"));
  img.src = URL.createObjectURL(file);
});

const callGeminiVision = async (base64, prompt) => {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: "image/jpeg", data: base64 } },
        { text: prompt },
      ]}],
      generationConfig: { temperature: 0.15, maxOutputTokens: 2048, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  return res.json();
};

const parseGeminiResponse = (apiRes, prices) => {
  let text = apiRes?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Try to fix common JSON issues from Gemini
    try {
      // Remove markdown code fences if present
      text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      // Fix unterminated strings — truncate to last valid object/array close
      const lastBrace = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
      if (lastBrace > 0) text = text.slice(0, lastBrace + 1);
      // Balance braces if needed
      const opens = (text.match(/\{/g) || []).length;
      const closes = (text.match(/\}/g) || []).length;
      if (opens > closes) text += "}".repeat(opens - closes);
      const openB = (text.match(/\[/g) || []).length;
      const closeB = (text.match(/\]/g) || []).length;
      if (openB > closeB) text += "]".repeat(openB - closeB);
      data = JSON.parse(text);
    } catch {
      return null;
    }
  }
  const validResults = (data.results || [])
    .filter(r => r.code && r.cat && typeof r.weight === "number" && r.weight > 0)
    .map(r => {
      const cat = r.cat.toLowerCase();
      const found = prices.find(p => p.item_code === r.code);
      if (!found) {
        const catItems = prices.filter(p => p.category === cat);
        if (catItems.length) return { ...r, cat, code: catItems[0].item_code };
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

// ─── HELPERS ───
const rp = (n) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
const kg = (w) => `${Number(w).toFixed(1)} kg`;

function Anim({ value, dur = 600 }) {
  const [d, setD] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let f;
    const step = (ts) => {
      if (!ref.current) ref.current = ts;
      const p = Math.min((ts - ref.current) / dur, 1);
      setD(Math.round(p * value));
      if (p < 1) f = requestAnimationFrame(step);
    };
    ref.current = null;
    f = requestAnimationFrame(step);
    return () => cancelAnimationFrame(f);
  }, [value, dur]);
  return <>{rp(d)}</>;
}

// ─── Parse coordinates from Google Maps paste ───
function parseCoordinates(text) {
  if (!text || !text.trim()) return null;
  const s = text.trim();
  // Direct "lat, lng" format (e.g. "-6.259284, 106.688127")
  const direct = s.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (direct) return { lat: parseFloat(direct[1]), lng: parseFloat(direct[2]) };
  // Google Maps URL with @lat,lng pattern
  const urlAt = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (urlAt) return { lat: parseFloat(urlAt[1]), lng: parseFloat(urlAt[2]) };
  // Google Maps URL with ?q=lat,lng or /place/lat,lng
  const urlQ = s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (urlQ) return { lat: parseFloat(urlQ[1]), lng: parseFloat(urlQ[2]) };
  return null;
}

// ─── TRANSLATIONS ───
const T = {
  id: { dashboard:"Dashboard", prices:"Harga", scan:"Scan", chat:"Chat AI", map:"Peta", tx:"Transaksi", reports:"Laporan", newtx:"Buat TX", kelola:"Kelola Harga", settings:"Pengaturan", pickup:"Pickup", login:"Masuk", register:"Daftar Baru", logout:"Keluar", name:"Nama", email:"Email", password:"Password", confirm_pw:"Konfirmasi Password", submit:"Kirim", save:"Simpan", cancel:"Batal", delete_btn:"Hapus", refresh:"Refresh", total:"Total", weight:"Berat", value:"Nilai", items:"Item", filter:"Filter", export_csv:"Export CSV", week:"Minggu Ini", month:"Bulan Ini", all_time:"Semua", pending:"Menunggu", pickup_s:"Dijemput", done:"Selesai", cancelled:"Dibatalkan", points:"Poin", leaderboard:"Papan Peringkat", no_data:"Belum ada data.", profile:"Profil", change_pw:"Ganti Password", watch:"Pantau", unwatch:"Batal Pantau", alerts:"Notifikasi Harga", install_app:"Install Aplikasi", not_logged:"Belum login", welcome:"Selamat datang", network:"Network", select_dp:"Pilih Drop Point untuk lihat harga:", create_tx:"Buat Transaksi", scan_title:"Scan Sampah — AI Vision", chat_title:"EcoChain Assistant", new_pw:"Password Baru", save_profile:"Simpan Profil", total_tx:"Total Transaksi", total_weight:"Total Berat", total_value:"Total Nilai", active_items:"Item Aktif", select_bs:"Pilih Bank Sampah", select_pelp:"Pilih Pelapak Sumber", margin:"Margin", env_impact:"Dampak Lingkungan", co2_saved:"CO₂ Dihemat", trees_saved:"Pohon Diselamatkan", water_saved:"Air Dihemat", community:"Komunitas", tips_title:"Tips Daur Ulang", recent_activity:"Aktivitas Terkini", offline_mode:"Mode Offline", cached_data:"Data tersimpan lokal", price_history:"Riwayat Harga", select_item:"Pilih item", days_30:"30 Hari", days_90:"90 Hari", invoice:"Struk", print_invoice:"Cetak Struk", heatmap:"Heatmap Aktivitas", show_heatmap:"Tampilkan Heatmap", enable_notif:"Aktifkan Notifikasi", notif_enabled:"Notifikasi aktif", rate:"Beri Rating", review:"Ulasan", rating:"Rating", avg_rating:"Rating Rata-rata", review_placeholder:"Tulis komentar (opsional)", review_submitted:"Ulasan berhasil dikirim!", referral:"Referral", referral_code:"Kode Referral", referral_copied:"Kode referral disalin!", enter_referral:"Punya kode referral?", request_pickup:"Minta Pickup", pickup_status:"Status Pickup", pickup_requested:"Pickup diminta!", pickup_address:"Alamat Penjemputan", share:"Bagikan", share_achievement:"Bagikan Pencapaian", onboard_next:"Lanjut", onboard_skip:"Lewati", onboard_done:"Selesai!", estimated_weight:"Estimasi Berat", schedule_pickup:"Jadwalkan", start_pickup:"Mulai Pickup", complete_pickup:"Selesai", wallet:"Dompet", balance:"Saldo", top_up:"Isi Saldo", wallet_history:"Riwayat Dompet", credit:"Masuk", debit:"Keluar", marketplace:"Marketplace", products:"Produk Daur Ulang", list_product:"Jual Produk", product_name:"Nama Produk", product_desc:"Deskripsi", product_price:"Harga Produk", product_stock:"Stok", membership:"Membership", free_tier:"Gratis", silver_tier:"Silver", gold_tier:"Gold", upgrade_tier:"Upgrade", dynamic_price:"Harga Dinamis", trending_up:"Tren Naik", trending_down:"Tren Turun", inventory:"Inventaris", stock_level:"Level Stok", low_stock:"Stok Rendah", route:"Rute Optimal", nearest_dp:"DP Terdekat", distance:"Jarak", barcode:"Scan Barcode", multi_photo:"Multi Foto", gallery:"Galeri", confidence:"Keyakinan", predict:"Prediksi", forecast:"Perkiraan", trend:"Tren", recommend:"Rekomendasi", for_you:"Untuk Anda", best_time:"Waktu Terbaik Jual", faq:"FAQ", common_questions:"Pertanyaan Umum", team:"Tim", create_team:"Buat Tim", members:"Anggota", audit_trail:"Jejak Audit", action_log:"Log Aktivitas", dispute:"Sengketa", raise_dispute:"Ajukan Sengketa", dispute_reason:"Alasan Sengketa", dispute_status:"Status Sengketa", resolution:"Resolusi", area_board:"Peringkat Wilayah", select_area:"Pilih Wilayah", all_areas:"Semua Wilayah", projected:"Proyeksi", no_dispute:"Belum ada sengketa", open:"Buka", investigating:"Investigasi", resolved:"Terselesaikan", charts_pro:"Analitik Pro", category_breakdown:"Breakdown Kategori", revenue_trend:"Tren Pendapatan", period_compare:"Perbandingan Periode", carbon_credit:"Kredit Karbon", carbon_cert:"Sertifikat Karbon", download_cert:"Unduh Sertifikat", carbon_offset:"Offset Karbon", price_ticker:"Ticker Harga", this_period:"Periode Ini", prev_period:"Periode Sebelumnya", growth_rate:"Laju Pertumbuhan" },
  en: { dashboard:"Dashboard", prices:"Prices", scan:"Scan", chat:"AI Chat", map:"Map", tx:"Transactions", reports:"Reports", newtx:"Create TX", kelola:"Manage Prices", settings:"Settings", pickup:"Pickup", login:"Login", register:"Register", logout:"Logout", name:"Name", email:"Email", password:"Password", confirm_pw:"Confirm Password", submit:"Send", save:"Save", cancel:"Cancel", delete_btn:"Delete", refresh:"Refresh", total:"Total", weight:"Weight", value:"Value", items:"Items", filter:"Filter", export_csv:"Export CSV", week:"This Week", month:"This Month", all_time:"All Time", pending:"Pending", pickup_s:"Pickup", done:"Done", cancelled:"Cancelled", points:"Points", leaderboard:"Leaderboard", no_data:"No data yet.", profile:"Profile", change_pw:"Change Password", watch:"Watch", unwatch:"Unwatch", alerts:"Price Alerts", install_app:"Install App", not_logged:"Not logged in", welcome:"Welcome", network:"Network", select_dp:"Select Drop Point to view prices:", create_tx:"Create Transaction", scan_title:"Scan Waste — AI Vision", chat_title:"EcoChain Assistant", new_pw:"New Password", save_profile:"Save Profile", total_tx:"Total Transactions", total_weight:"Total Weight", total_value:"Total Value", active_items:"Active Items", select_bs:"Select Bank Sampah", select_pelp:"Select Pelapak Source", margin:"Margin", env_impact:"Environmental Impact", co2_saved:"CO₂ Saved", trees_saved:"Trees Saved", water_saved:"Water Saved", community:"Community", tips_title:"Recycling Tips", recent_activity:"Recent Activity", offline_mode:"Offline Mode", cached_data:"Locally cached data", price_history:"Price History", select_item:"Select item", days_30:"30 Days", days_90:"90 Days", invoice:"Receipt", print_invoice:"Print Receipt", heatmap:"Activity Heatmap", show_heatmap:"Show Heatmap", enable_notif:"Enable Notifications", notif_enabled:"Notifications enabled", rate:"Rate", review:"Review", rating:"Rating", avg_rating:"Average Rating", review_placeholder:"Write a comment (optional)", review_submitted:"Review submitted!", referral:"Referral", referral_code:"Referral Code", referral_copied:"Referral code copied!", enter_referral:"Have a referral code?", request_pickup:"Request Pickup", pickup_status:"Pickup Status", pickup_requested:"Pickup requested!", pickup_address:"Pickup Address", share:"Share", share_achievement:"Share Achievement", onboard_next:"Next", onboard_skip:"Skip", onboard_done:"Done!", estimated_weight:"Estimated Weight", schedule_pickup:"Schedule", start_pickup:"Start Pickup", complete_pickup:"Complete", wallet:"Wallet", balance:"Balance", top_up:"Top Up", wallet_history:"Wallet History", credit:"Credit", debit:"Debit", marketplace:"Marketplace", products:"Recycled Products", list_product:"Sell Product", product_name:"Product Name", product_desc:"Description", product_price:"Product Price", product_stock:"Stock", membership:"Membership", free_tier:"Free", silver_tier:"Silver", gold_tier:"Gold", upgrade_tier:"Upgrade", dynamic_price:"Dynamic Pricing", trending_up:"Trending Up", trending_down:"Trending Down", inventory:"Inventory", stock_level:"Stock Level", low_stock:"Low Stock", route:"Optimal Route", nearest_dp:"Nearest DP", distance:"Distance", barcode:"Scan Barcode", multi_photo:"Multi Photo", gallery:"Gallery", confidence:"Confidence", predict:"Predict", forecast:"Forecast", trend:"Trend", recommend:"Recommendations", for_you:"For You", best_time:"Best Time to Sell", faq:"FAQ", common_questions:"Common Questions", team:"Team", create_team:"Create Team", members:"Members", audit_trail:"Audit Trail", action_log:"Activity Log", dispute:"Dispute", raise_dispute:"Raise Dispute", dispute_reason:"Dispute Reason", dispute_status:"Dispute Status", resolution:"Resolution", area_board:"Area Leaderboard", select_area:"Select Area", all_areas:"All Areas", projected:"Projected", no_dispute:"No disputes yet", open:"Open", investigating:"Investigating", resolved:"Resolved", charts_pro:"Pro Analytics", category_breakdown:"Category Breakdown", revenue_trend:"Revenue Trend", period_compare:"Period Comparison", carbon_credit:"Carbon Credit", carbon_cert:"Carbon Certificate", download_cert:"Download Certificate", carbon_offset:"Carbon Offset", price_ticker:"Price Ticker", this_period:"This Period", prev_period:"Previous Period", growth_rate:"Growth Rate" },
};

// ─── MINI SVG BAR CHART ───
function MiniChart({ data, color, height = 48, barWidth = 8 }) {
  const max = Math.max(...data, 1);
  const w = data.length * (barWidth + 3);
  return (
    <svg width={w} height={height} style={{ display: "block" }}>
      {data.map((v, i) => (
        <rect key={i} x={i * (barWidth + 3)} y={height - (v / max) * height}
          width={barWidth} height={Math.max((v / max) * height, 1)}
          rx={2} fill={color} opacity={i === data.length - 1 ? 1 : 0.5} />
      ))}
    </svg>
  );
}

// ─── CSV DOWNLOAD HELPER ───
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── SVG LINE CHART ───
function LineChart({ data, width = 320, height = 120, color = "var(--g)" }) {
  if (!data.length) return null;
  const maxY = Math.max(...data.map(d => d.y), 1);
  const minY = Math.min(...data.map(d => d.y), 0);
  const range = maxY - minY || 1;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - ((d.y - minY) / range) * (height - 20) - 10;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts.join(" ")} />
      {data.map((d, i) => {
        const [cx, cy] = pts[i].split(",");
        return <circle key={i} cx={cx} cy={cy} r="3" fill={color} opacity={i === data.length - 1 ? 1 : 0.4} />;
      })}
      {data.length > 0 && <text x={width - 2} y={12} textAnchor="end" fill="var(--t2)" fontSize="9" fontFamily="var(--m)">{data[data.length - 1].label}</text>}
    </svg>
  );
}

// ─── ECO TIPS ───
const ECO_TIPS = [
  { icon: "♻️", id: "Pisahkan sampah per kategori", en: "Separate waste by category", body_id: "Sampah terpisah = harga lebih tinggi di Bank Sampah.", body_en: "Separated waste = higher prices at Bank Sampah." },
  { icon: "💧", id: "Bersihkan botol plastik", en: "Clean plastic bottles", body_id: "Lepas label, bilas, keringkan. Botol bersih harga 2-3x lipat.", body_en: "Remove labels, rinse, dry. Clean bottles fetch 2-3x price." },
  { icon: "📦", id: "Lipat kardus dengan rapi", en: "Fold cardboard neatly", body_id: "Kardus yang dilipat hemat ruang dan lebih mudah ditimbang.", body_en: "Folded cardboard saves space and is easier to weigh." },
  { icon: "🛢️", id: "Saring minyak jelantah", en: "Filter used cooking oil", body_id: "Jangan campur air. Gunakan kain saringan sebelum jual.", body_en: "Don't mix with water. Use cloth filter before selling." },
  { icon: "🔋", id: "Pisahkan limbah B3", en: "Separate hazardous waste", body_id: "Baterai dan elektronik jangan campur sampah biasa.", body_en: "Batteries and electronics should not be mixed with regular waste." },
  { icon: "🌱", id: "Kompos sampah organik", en: "Compost organic waste", body_id: "Sisa sayur/buah bisa jadi pupuk dalam 2-4 minggu.", body_en: "Vegetable/fruit scraps can become fertilizer in 2-4 weeks." },
  { icon: "👜", id: "Gunakan tas belanja sendiri", en: "Bring your own shopping bag", body_id: "Kurangi plastik sekali pakai, mulai dari tas belanja.", body_en: "Reduce single-use plastic, start with shopping bags." },
  { icon: "📱", id: "Scan dengan EcoChain AI", en: "Scan with EcoChain AI", body_id: "Foto sampah untuk identifikasi otomatis dan estimasi harga.", body_en: "Photo your waste for automatic identification and price estimation." },
  { icon: "🏆", id: "Kumpulkan poin dari setor", en: "Collect points from deposits", body_id: "Setiap kg sampah = 10 poin. Raih badge dan naik peringkat!", body_en: "Every kg of waste = 10 points. Earn badges and climb the leaderboard!" },
  { icon: "🤝", id: "Ajak tetangga ikut serta", en: "Invite neighbors to participate", body_id: "Semakin banyak partisipan, lingkungan semakin bersih.", body_en: "More participants means a cleaner environment." },
];

// ─── SVG PIE CHART ───
function PieChart({ data, size = 140 }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 8;
  let cum = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {data.map((d, i) => {
        const start = cum / total * 2 * Math.PI - Math.PI / 2;
        cum += d.value;
        const end = cum / total * 2 * Math.PI - Math.PI / 2;
        const large = d.value / total > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`} fill={d.color} opacity={0.85} />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.5} fill="var(--bg3)" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--w)" fontSize="14" fontWeight="800" fontFamily="var(--d)">{total.toFixed(0)}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--t2)" fontSize="8" fontFamily="var(--m)">kg</text>
    </svg>
  );
}

// ─── SVG AREA CHART ───
function AreaChart({ data, width = 320, height = 100, color = "var(--g)" }) {
  if (!data.length) return null;
  const maxY = Math.max(...data.map(d => d.y), 1);
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - (d.y / maxY) * (height - 16) - 8;
    return { x, y };
  });
  const line = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${pts[0].x},${height} ${line} ${pts[pts.length - 1].x},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0.02" /></linearGradient></defs>
      <polygon fill="url(#areaG)" points={area} />
      <polyline fill="none" stroke={color} strokeWidth="2" points={line} />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity={i === pts.length - 1 ? 1 : 0.3} />)}
      {data.length > 0 && <text x={width - 2} y={12} textAnchor="end" fill="var(--t2)" fontSize="8" fontFamily="var(--m)">{rp(data[data.length - 1].y)}</text>}
    </svg>
  );
}

// ─── ONBOARDING STEPS ───
const ONBOARD_STEPS = [
  { tab: "prices", text_id: "Lihat harga sampah di tab Harga", text_en: "View waste prices in the Prices tab" },
  { tab: "scan", text_id: "Scan sampah dengan AI Vision di tab Scan", text_en: "Scan waste with AI Vision in Scan tab" },
  { tab: "chat", text_id: "Tanya asisten AI tentang daur ulang", text_en: "Ask the AI assistant about recycling" },
  { tab: "dashboard", text_id: "Lihat statistik dan pencapaian di Dashboard", text_en: "View stats and achievements in Dashboard" },
];

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function EcoChain() {
  // ─── AUTH STATE ───
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "", name: "", role: "user", location: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ─── DATA STATE ───
  const [pelapakPrices, setPelapakPrices] = useState([]);
  const [dropPoints, setDropPoints] = useState([]);
  const [bankSampah, setBankSampah] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txItems, setTxItems] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pelapakList, setPelapakList] = useState([]);
  const [myEntity, setMyEntity] = useState(null);
  const [selectedDpForPrices, setSelectedDpForPrices] = useState(null);

  // ─── UI STATE ───
  const [tab, setTab] = useState("prices");
  const [catFilter, setCatFilter] = useState("");
  const [notif, setNotif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dpDetail, setDpDetail] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("eco_theme") || "dark");
  const [lang, setLang] = useState(() => localStorage.getItem("eco_lang") || "id");
  const t = useCallback((key) => T[lang]?.[key] || T.id[key] || key, [lang]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", newPassword: "" });
  const [expandedTx, setExpandedTx] = useState(null);
  const [txStatusFilter, setTxStatusFilter] = useState("all");
  const [leaderboard, setLeaderboard] = useState([]);
  const [watchedItems, setWatchedItems] = useState(() => { try { return JSON.parse(localStorage.getItem("eco_watch") || "[]"); } catch { return []; } });
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [dashPeriod, setDashPeriod] = useState("all");
  const [reportRange, setReportRange] = useState({ from: "", to: "" });
  const [txPhoto, setTxPhoto] = useState(null);
  const txPhotoRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);

  // ─── BATCH 2 STATE ───
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [onboardStep, setOnboardStep] = useState(0);
  const [showOnboard, setShowOnboard] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [historyItem, setHistoryItem] = useState("");
  const [historyRange, setHistoryRange] = useState(30);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ txId: null, rating: 0, comment: "" });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [printTx, setPrintTx] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const [pickupForm, setPickupForm] = useState({ dp: "", address: "", estimated_kg: "", notes: "" });
  const [pickupTab, setPickupTab] = useState("list");

  // ─── BATCH 3 STATE ───
  const [walletTxns, setWalletTxns] = useState([]);
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", category: "", stock: "1" });
  const [disputes, setDisputes] = useState([]);
  const [disputeForm, setDisputeForm] = useState({ txId: null, reason: "" });
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [scanPhotos, setScanPhotos] = useState([]);
  const [areaFilter, setAreaFilter] = useState("all");
  const [showInventory, setShowInventory] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [showFaq, setShowFaq] = useState(false);
  const [productFilter, setProductFilter] = useState("all");

  // New Transaction form
  const [txForm, setTxForm] = useState({ dp: "", items: [{ code: "", weight: "" }] });

  // Pelapak price management
  const [priceForm, setPriceForm] = useState({ item_code: "", item_name: "", category: "", unit: "kg", price_per_kg: "" });
  const [csvUploading, setCsvUploading] = useState(false);
  const csvInputRef = useRef(null);

  // ─── SCAN STATE ───
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [scanPhoto, setScanPhoto] = useState(null);
  const fileInputRef = useRef(null);

  // ─── CHAT STATE ───
  const [aiChat, setAiChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const flash = useCallback((msg, type = "ok") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  // ─── THEME EFFECT ───
  useEffect(() => {
    document.body.style.background = theme === "light" ? "#F8FAFC" : "#080C14";
    localStorage.setItem("eco_theme", theme);
  }, [theme]);

  // ─── PWA INSTALL PROMPT ───
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ─── ONLINE/OFFLINE ───
  useEffect(() => {
    const goOn = () => { setIsOnline(true); flash(lang === "id" ? "🌐 Online kembali" : "🌐 Back online"); };
    const goOff = () => { setIsOnline(false); flash(lang === "id" ? "📴 Mode offline" : "📴 Offline mode", "info"); };
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return () => { window.removeEventListener("online", goOn); window.removeEventListener("offline", goOff); };
  }, [lang]);

  // ─── BROWSER NOTIFICATION HELPER ───
  const sendBrowserNotif = useCallback((title, body) => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/manifest.json" });
    }
  }, []);

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) { flash("Browser tidak mendukung notifikasi", "err"); return; }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") flash(t("notif_enabled"));
    else flash(lang === "id" ? "Notifikasi diblokir browser" : "Notifications blocked", "err");
  };

  const toggleWatch = (code) => {
    setWatchedItems(prev => {
      const next = prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code];
      localStorage.setItem("eco_watch", JSON.stringify(next));
      return next;
    });
  };

  // ─── RESTORE SESSION ───
  useEffect(() => {
    const saved = localStorage.getItem("eco_session");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setToken(s.token);
        setUser(s.user);
        setProfile(s.profile);
        resolveMyEntity(s.profile, s.token);
      } catch { /* ignore */ }
    }
  }, []);

  // ─── RESOLVE MY ENTITY ───
  const resolveMyEntity = useCallback(async (prof, tk) => {
    if (!prof || !tk) return;
    try {
      if (prof.role === "bank") {
        const res = await sb.query("bank_sampah", `user_id=eq.${prof.id}`, tk).catch(() => []);
        setMyEntity(res?.[0] || null);
      } else if (prof.role === "dp") {
        const res = await sb.query("drop_points", `user_id=eq.${prof.id}`, tk).catch(() => []);
        setMyEntity(res?.[0] || null);
      } else if (prof.role === "pelapak") {
        setMyEntity({ id: prof.id, role: "pelapak" });
      } else {
        setMyEntity(null);
      }
    } catch { setMyEntity(null); }
  }, []);

  // ─── LOAD DATA ───
  const loadData = useCallback(async (t) => {
    const tk = t || token;
    setLoading(true);
    try {
      const [pp, dp, bs, cat, pelList] = await Promise.all([
        sb.query("pelapak_prices", "order=category.asc,item_code.asc", tk).catch(() => []),
        sb.query("drop_points", "order=id.asc", tk).catch(() => []),
        sb.query("bank_sampah", "order=id.asc", tk).catch(() => []),
        sb.query("waste_categories", "order=sort_order.asc", tk).catch(() => []),
        sb.query("profiles", "role=eq.pelapak&select=id,name,email", tk).catch(() => []),
      ]);
      setPelapakPrices(pp || []);
      setDropPoints(dp || []);
      setBankSampah(bs || []);
      setCategories(cat || []);
      setPelapakList(pelList || []);
      if (!catFilter && cat?.length) setCatFilter(cat[0].code);

      // Cache for offline
      localStorage.setItem("eco_cache", JSON.stringify({ pelapakPrices: pp, dropPoints: dp, bankSampah: bs, categories: cat, ts: Date.now() }));

      // Load transactions + items if authenticated
      if (tk && tk !== SUPABASE_ANON_KEY) {
        const [tx, ti, pk, rv, ph] = await Promise.all([
          sb.query("transactions", "order=created_at.desc&limit=30", tk).catch(() => []),
          sb.query("transaction_items", "order=id.asc", tk).catch(() => []),
          sb.query("pickup_schedules", "order=pickup_date.asc", tk).catch(() => []),
          sb.query("reviews", "order=created_at.desc&limit=100", tk).catch(() => []),
          sb.query("price_history", "order=recorded_at.desc&limit=500", tk).catch(() => []),
        ]);
        setTransactions(tx || []);
        setTxItems(ti || []);
        setPickups(pk || []);
        setReviews(rv || []);
        setPriceHistory(ph || []);
        // Load leaderboard (with wallet_balance, membership_tier)
        sb.query("profiles", "select=id,name,role,points,wallet_balance,membership_tier&order=points.desc&limit=30", tk).then(lb => setLeaderboard(lb || [])).catch(() => {});
        // Load wallet, products, disputes, audit
        Promise.all([
          sb.query("wallet_transactions", `user_id=eq.${(await sb.getUser(tk)).id}&order=created_at.desc&limit=50`, tk).catch(() => []),
          sb.query("recycled_products", "status=eq.active&order=created_at.desc&limit=50", tk).catch(() => []),
          sb.query("disputes", "order=created_at.desc&limit=50", tk).catch(() => []),
          sb.query("audit_logs", "order=created_at.desc&limit=100", tk).catch(() => []),
        ]).then(([wt, pr, di, al]) => {
          setWalletTxns(wt || []); setProducts(pr || []); setDisputes(di || []); setAuditLogs(al || []);
        }).catch(() => {});
      }
    } catch (e) {
      console.error("Load error:", e);
      // Offline fallback
      if (!navigator.onLine) {
        try {
          const cached = JSON.parse(localStorage.getItem("eco_cache") || "{}");
          if (cached.pelapakPrices) { setPelapakPrices(cached.pelapakPrices); setDropPoints(cached.dropPoints || []); setBankSampah(cached.bankSampah || []); setCategories(cached.categories || []); }
        } catch {}
      }
    }
    setLoading(false);
  }, [token, catFilter]);

  useEffect(() => {
    if (token) loadData();
    else {
      // Load public data (prices, locations) without auth
      (async () => {
        setLoading(true);
        try {
          const [pp, dp, bs, cat] = await Promise.all([
            sb.query("pelapak_prices", "order=category.asc,item_code.asc").catch(() => []),
            sb.query("drop_points", "order=id.asc").catch(() => []),
            sb.query("bank_sampah", "order=id.asc").catch(() => []),
            sb.query("waste_categories", "order=sort_order.asc").catch(() => []),
          ]);
          setPelapakPrices(pp || []);
          setDropPoints(dp || []);
          setBankSampah(bs || []);
          setCategories(cat || []);
          if (!catFilter && cat?.length) setCatFilter(cat[0].code);
          localStorage.setItem("eco_cache", JSON.stringify({ pelapakPrices: pp, dropPoints: dp, bankSampah: bs, categories: cat, ts: Date.now() }));
        } catch (e) {
          console.error(e);
          if (!navigator.onLine) { try { const c = JSON.parse(localStorage.getItem("eco_cache") || "{}"); if (c.pelapakPrices) { setPelapakPrices(c.pelapakPrices); setDropPoints(c.dropPoints || []); setBankSampah(c.bankSampah || []); setCategories(c.categories || []); } } catch {} }
        }
        setLoading(false);
      })();
    }
  }, [token]);

  // ─── AUTH HANDLERS ───
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (authMode === "register" && authForm.password !== authForm.confirmPassword) {
      setAuthError("Password tidak cocok!");
      return;
    }
    if (authMode === "register" && ["dp", "bank", "pelapak"].includes(authForm.role) && !parseCoordinates(authForm.location)) {
      setAuthError("Koordinat lokasi tidak valid. Gunakan format: -6.259284, 106.688127");
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        const meta = { name: authForm.name, role: authForm.role };
        if (authForm.referralCode) meta.referral_code = authForm.referralCode;
        if (["dp", "bank", "pelapak"].includes(authForm.role)) {
          const coords = parseCoordinates(authForm.location);
          if (coords) { meta.lat = coords.lat; meta.lng = coords.lng; }
        }
        const res = await sb.signUp(authForm.email, authForm.password, meta);
        if (res.error) throw new Error(res.error.message || res.msg || "Registrasi gagal");
        if (res.access_token) {
          const u = res.user || (await sb.getUser(res.access_token));
          let prof = null;
          try {
            const p = await sb.query("profiles", `id=eq.${u.id}&select=*`, res.access_token);
            prof = p?.[0] || null;
          } catch {
            prof = { id: u.id, email: u.email || authForm.email, name: authForm.name || "User", role: authForm.role || "user" };
          }
          setToken(res.access_token);
          setUser(u);
          setProfile(prof);
          localStorage.setItem("eco_session", JSON.stringify({ token: res.access_token, user: u, profile: prof }));
          loadData(res.access_token);
          resolveMyEntity(prof, res.access_token);
          flash("✅ Registrasi berhasil! Selamat datang.");
          // Award referral points
          if (authForm.referralCode) {
            sb.rpc("award_referral_points", { referrer_code: authForm.referralCode, bonus: 50 }, res.access_token).catch(() => {});
          }
          // Trigger onboarding for new users
          if (!localStorage.getItem("eco_onboard_done") && (authForm.role === "user")) {
            setShowOnboard(true); setOnboardStep(1);
          }
        } else {
          flash("📧 Cek email untuk verifikasi akun.", "info");
          setAuthMode("login");
        }
      } else {
        const res = await sb.signIn(authForm.email, authForm.password);
        const u = res.user || (await sb.getUser(res.access_token));
        let prof = null;
        try {
          const p = await sb.query("profiles", `id=eq.${u.id}&select=*`, res.access_token);
          prof = p?.[0] || null;
        } catch {
          // Profile query failed — use fallback from user metadata
          prof = { id: u.id, email: u.email, name: u.user_metadata?.name || u.email?.split("@")[0] || "User", role: u.user_metadata?.role || "user" };
        }
        setToken(res.access_token);
        setUser(u);
        setProfile(prof);
        localStorage.setItem("eco_session", JSON.stringify({ token: res.access_token, user: u, profile: prof }));
        loadData(res.access_token);
        resolveMyEntity(prof, res.access_token);
        flash(`✅ Selamat datang, ${prof?.name || "User"}!`);
      }
    } catch (err) {
      setAuthError(err.message);
    }
    setAuthLoading(false);
  };

  const logout = () => {
    setUser(null); setProfile(null); setToken(null);
    setTransactions([]); setTxItems([]); setPickups([]);
    setMyEntity(null); setSelectedDpForPrices(null);
    localStorage.removeItem("eco_session");
    flash("👋 Berhasil keluar.");
  };

  // ─── PROFILE HANDLERS ───
  const openProfile = () => { setProfileForm({ name: profile?.name || "", newPassword: "" }); setShowProfile(true); };
  const saveProfile = async () => {
    try {
      if (profileForm.name && profileForm.name !== profile.name) {
        await sb.update("profiles", { id: profile.id }, { name: profileForm.name }, token);
        const updated = { ...profile, name: profileForm.name };
        setProfile(updated);
        localStorage.setItem("eco_session", JSON.stringify({ token, user, profile: updated }));
      }
      if (profileForm.newPassword && profileForm.newPassword.length >= 6) {
        await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ password: profileForm.newPassword }),
        });
      }
      setShowProfile(false);
      flash(`✅ ${t("profile")} updated!`);
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── CREATE TRANSACTION ───
  const submitTx = async () => {
    if (!txForm.dp || txForm.items.some(i => !i.code || !i.weight)) {
      flash("❌ Lengkapi semua field!", "err"); return;
    }
    try {
      const txId = `ECH-${new Date().toISOString().slice(5, 10).replace("-", "")}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;
      await sb.insert("transactions", {
        id: txId,
        user_id: user.id,
        user_name: profile?.name || "User",
        drop_point_id: txForm.dp,
        status: "pending",
      }, token);
      for (const item of txForm.items) {
        const found = effectivePrices.find(p => p.item_code === item.code);
        if (found) {
          await sb.insert("transaction_items", {
            transaction_id: txId,
            waste_code: item.code,
            waste_name: found.name,
            weight_kg: parseFloat(item.weight),
          }, token);
        }
      }
      flash(`✅ Transaksi ${txId} berhasil dibuat!`);
      setTxForm({ dp: "", items: [{ code: "", weight: "" }] });
      loadData();
    } catch (e) {
      flash(`❌ ${e.message}`, "err");
    }
  };

  // ─── PER-ENTITY PRICING FUNCTIONS ───
  const updateMyMargin = async (newMargin) => {
    if (!myEntity || !profile) return;
    try {
      if (profile.role === "bank") {
        await sb.update("bank_sampah", { id: myEntity.id }, { margin: newMargin }, token);
      } else if (profile.role === "dp") {
        await sb.update("drop_points", { id: myEntity.id }, { margin: newMargin }, token);
      }
      setMyEntity(prev => ({ ...prev, margin: newMargin }));
      flash("✅ Margin diperbarui!");
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  const updateBankPelapak = async (pelapakId) => {
    if (!myEntity || profile?.role !== "bank") return;
    try {
      await sb.update("bank_sampah", { id: myEntity.id }, { pelapak_id: pelapakId || null }, token);
      setMyEntity(prev => ({ ...prev, pelapak_id: pelapakId || null }));
      flash("✅ Pelapak dipilih!");
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  const updateDpBank = async (bankId) => {
    if (!myEntity || profile?.role !== "dp") return;
    try {
      await sb.update("drop_points", { id: myEntity.id }, { bank_sampah_id: bankId ? parseInt(bankId) : null }, token);
      setMyEntity(prev => ({ ...prev, bank_sampah_id: bankId ? parseInt(bankId) : null }));
      flash("✅ Bank Sampah dipilih!");
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  const addPelapakPrice = async () => {
    if (!priceForm.item_code || !priceForm.item_name || !priceForm.price_per_kg) {
      flash("❌ Lengkapi kode, nama, dan harga!", "err"); return;
    }
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pelapak_prices?on_conflict=pelapak_id,item_code`, {
        method: "POST",
        headers: { ...sb.headers(token), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          pelapak_id: user.id,
          item_code: priceForm.item_code.trim(),
          item_name: priceForm.item_name.trim(),
          category: priceForm.category || "other",
          unit: priceForm.unit || "kg",
          price_per_kg: parseFloat(priceForm.price_per_kg),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message || `Insert failed`); }
      flash(`✅ Harga ${priceForm.item_name} disimpan!`);
      // Record price history
      sb.insert("price_history", { item_code: priceForm.item_code.trim(), item_name: priceForm.item_name.trim(), category: priceForm.category || "other", price: parseFloat(priceForm.price_per_kg), pelapak_id: user.id }, token).catch(() => {});
      setPriceForm({ item_code: "", item_name: "", category: "", unit: "kg", price_per_kg: "" });
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  const deletePelapakPrice = async (priceId) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pelapak_prices?id=eq.${priceId}`, {
        method: "DELETE", headers: sb.headers(token),
      });
      if (!r.ok) throw new Error(`Delete failed: ${r.status}`);
      flash("✅ Item dihapus!");
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      const start = lines[0]?.toLowerCase().includes("item_code") ? 1 : 0;
      const items = [];
      for (let i = start; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim());
        if (cols.length >= 3 && cols[0] && parseFloat(cols[cols.length - 1]) >= 0) {
          items.push({
            pelapak_id: user.id,
            item_code: cols[0],
            item_name: cols[1],
            category: cols[2] || "other",
            unit: cols.length >= 5 ? cols[3] : "kg",
            price_per_kg: parseFloat(cols[cols.length - 1]),
            updated_at: new Date().toISOString(),
          });
        }
      }
      if (!items.length) throw new Error("Tidak ada baris valid ditemukan");
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pelapak_prices?on_conflict=pelapak_id,item_code`, {
        method: "POST",
        headers: { ...sb.headers(token), Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(items),
      });
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      flash(`✅ ${items.length} item harga diupload!`);
      loadData();
    } catch (err) { flash(`❌ CSV Error: ${err.message}`, "err"); }
    setCsvUploading(false);
    e.target.value = "";
  };

  // ─── UPDATE TX STATUS ───
  const updateTxStatus = async (txId, status) => {
    try {
      await sb.update("transactions", { id: txId }, { status }, token);
      flash(`✅ ${txId} → ${status === "done" ? "SELESAI" : status.toUpperCase()}`);
      sendBrowserNotif("Transaksi", `${txId} → ${status.toUpperCase()}`);
      // Auto-credit wallet when TX is done
      if (status === "done") {
        const total = getTxTotal(txId);
        const tx = transactions.find(t2 => t2.id === txId);
        if (total > 0 && tx) {
          sb.rpc("credit_wallet", { p_user_id: tx.user_id, p_amount: total, p_desc: `TX ${txId}`, p_ref: txId }, token).catch(() => {});
        }
      }
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── SCAN HANDLER (V2: multi-photo + confidence) ───
  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanResults(null);
    setScanning(true);
    try {
      const { base64, preview } = await resizeAndEncode(file);
      setScanPhoto(preview);
      setScanPhotos(prev => [...prev, preview].slice(-5)); // Keep last 5 photos
      if (!GEMINI_API_KEY) {
        // Demo fallback
        await new Promise(r => setTimeout(r, 1500));
        const demoItems = effectivePrices.slice(0, 3).map((p, i) => ({
          item: p.name, code: p.item_code, cat: p.category,
          weight: [2.5, 1.8, 3.2][i] || 1.0,
          tip: i === 0 ? "💡 Pisahkan per kategori untuk harga maksimal." : null,
        }));
        setScanResults({ label: "Demo Scan (tanpa API key)", results: demoItems });
      } else {
        const prompt = buildWastePrompt(effectivePrices);
        const apiRes = await callGeminiVision(base64, prompt);
        const parsed = parseGeminiResponse(apiRes, effectivePrices);
        setScanResults(parsed || { label: "Tidak terdeteksi", results: [] });
      }
    } catch (err) {
      flash(`❌ Scan error: ${err.message}`, "err");
      setScanResults(null);
    }
    setScanning(false);
    e.target.value = "";
  };

  // ─── COMPUTED: effectivePrices ───
  const effectivePrices = useMemo(() => {
    // Normalize pelapakPrices to have .name field for compatibility
    const normalize = (p, extra = {}) => ({
      ...p,
      name: p.item_name || p.name,
      pelapak_price: Number(p.price_per_kg),
      ...extra,
    });

    if (profile?.role === "pelapak") {
      return pelapakPrices.filter(p => p.pelapak_id === user?.id).map(p => normalize(p));
    }
    if (profile?.role === "bank" && myEntity?.pelapak_id) {
      const margin = Number(myEntity.margin) || 0;
      return pelapakPrices
        .filter(p => p.pelapak_id === myEntity.pelapak_id)
        .map(p => normalize(p, { bank_price: Number(p.price_per_kg) * (1 - margin) }));
    }
    if (profile?.role === "dp" && myEntity?.bank_sampah_id) {
      const bs = bankSampah.find(b => b.id === myEntity.bank_sampah_id);
      if (bs?.pelapak_id) {
      const bankMargin = Number(bs.margin) || 0;
      const dpMargin = Number(myEntity.margin) || 0;
      return pelapakPrices
        .filter(p => p.pelapak_id === bs.pelapak_id)
        .map(p => {
          const pp = Number(p.price_per_kg);
          const bp = pp * (1 - bankMargin);
          return normalize(p, { bank_price: bp, dp_price: bp * (1 - dpMargin) });
        });
      } // close if (bs?.pelapak_id)
    }
    // End user or public — use selected DP chain
    if (selectedDpForPrices) {
      const dp = dropPoints.find(d => String(d.id) === String(selectedDpForPrices));
      const bs = dp?.bank_sampah_id ? bankSampah.find(b => b.id === dp.bank_sampah_id) : null;
      if (dp?.bank_sampah_id && bs?.pelapak_id) {
        const bankMargin = Number(bs.margin) || 0;
        const dpMargin = Number(dp.margin) || 0;
        return pelapakPrices
          .filter(p => p.pelapak_id === bs.pelapak_id)
          .map(p => {
            const pp = Number(p.price_per_kg);
            const bp = pp * (1 - bankMargin);
            return normalize(p, { bank_price: bp, dp_price: bp * (1 - dpMargin) });
          });
      } // close if chain valid
    } // close if selectedDpForPrices
    // Fallback: show all unique items with pelapak prices only
    const seen = new Set();
    return pelapakPrices.filter(p => {
      if (seen.has(p.item_code)) return false;
      seen.add(p.item_code);
      return true;
    }).map(p => normalize(p));
  }, [pelapakPrices, profile, user, myEntity, bankSampah, dropPoints, selectedDpForPrices]);

  // ─── PRICE ALERT CHECK ───
  useEffect(() => {
    if (!effectivePrices.length || !watchedItems.length) return;
    const prev = JSON.parse(localStorage.getItem("eco_prev_prices") || "{}");
    const alerts = [];
    for (const code of watchedItems) {
      const curr = effectivePrices.find(p => p.item_code === code);
      const prevPrice = prev[code];
      if (curr && prevPrice != null) {
        const currPrice = curr.dp_price || curr.pelapak_price || 0;
        if (currPrice !== prevPrice) {
          alerts.push({ code, name: curr.name, prev: prevPrice, curr: currPrice, up: currPrice > prevPrice });
        }
      }
    }
    setPriceAlerts(alerts);
    if (alerts.length) sendBrowserNotif(lang === "id" ? "Harga Berubah" : "Price Changed", alerts.map(a => `${a.name}: ${a.up ? "↑" : "↓"}`).join(", "));
    const snapshot = {};
    for (const p of effectivePrices) snapshot[p.item_code] = p.dp_price || p.pelapak_price || 0;
    localStorage.setItem("eco_prev_prices", JSON.stringify(snapshot));
  }, [effectivePrices, watchedItems]);

  const filteredPrices = useMemo(() =>
    catFilter ? effectivePrices.filter(p => p.category === catFilter) : effectivePrices
    , [effectivePrices, catFilter]);

  // Prices based on the DP selected in the TX form (for newtx tab)
  const txFormPrices = useMemo(() => {
    if (!txForm.dp) return effectivePrices;
    const dp = dropPoints.find(d => String(d.id) === String(txForm.dp));
    if (!dp?.bank_sampah_id) return [];
    const bs = bankSampah.find(b => b.id === dp.bank_sampah_id);
    if (!bs?.pelapak_id) return [];
    const bankMargin = Number(bs.margin) || 0;
    const dpMargin = Number(dp.margin) || 0;
    return pelapakPrices
      .filter(p => p.pelapak_id === bs.pelapak_id)
      .map(p => ({
        ...p, name: p.item_name || p.name, pelapak_price: Number(p.price_per_kg),
        bank_price: Number(p.price_per_kg) * (1 - bankMargin),
        dp_price: Number(p.price_per_kg) * (1 - bankMargin) * (1 - dpMargin),
      }));
  }, [txForm.dp, dropPoints, bankSampah, pelapakPrices, effectivePrices]);

  const filteredTx = useMemo(() =>
    txStatusFilter === "all" ? transactions : transactions.filter(tx => tx.status === txStatusFilter)
    , [transactions, txStatusFilter]);

  // ─── GAMIFICATION COMPUTED ───
  const myPoints = useMemo(() => {
    const doneTx = transactions.filter(tx => tx.status === "done");
    return doneTx.reduce((sum, tx) => {
      const items = txItems.filter(i => i.transaction_id === tx.id);
      return sum + items.reduce((s, it) => s + Math.round(Number(it.weight_kg) * 10), 0);
    }, 0);
  }, [transactions, txItems]);

  const myBadges = useMemo(() => {
    const badges = [];
    const doneTx = transactions.filter(tx => tx.status === "done");
    const totalWeight = doneTx.reduce((s, tx) => s + txItems.filter(i => i.transaction_id === tx.id).reduce((s2, it) => s2 + Number(it.weight_kg), 0), 0);
    if (doneTx.length >= 1) badges.push({ icon: "🌱", label: lang === "id" ? "Transaksi Pertama" : "First Transaction" });
    if (doneTx.length >= 10) badges.push({ icon: "⭐", label: lang === "id" ? "10 Transaksi" : "10 Transactions" });
    if (doneTx.length >= 50) badges.push({ icon: "💎", label: lang === "id" ? "50 Transaksi" : "50 Transactions" });
    if (totalWeight >= 10) badges.push({ icon: "🏋️", label: "10kg Club" });
    if (totalWeight >= 100) badges.push({ icon: "🏆", label: "100kg Club" });
    if (totalWeight >= 500) badges.push({ icon: "👑", label: "500kg Legend" });
    return badges;
  }, [transactions, txItems, lang]);

  // ─── ENVIRONMENTAL IMPACT ───
  const envImpact = useMemo(() => {
    const doneTx = transactions.filter(tx => tx.status === "done");
    const totalKg = doneTx.reduce((s, tx) => s + txItems.filter(i => i.transaction_id === tx.id).reduce((s2, it) => s2 + Number(it.weight_kg), 0), 0);
    return { co2: (totalKg * 2.5).toFixed(1), trees: (totalKg / 50).toFixed(1), water: (totalKg * 15).toFixed(0), totalWeight: totalKg.toFixed(1) };
  }, [transactions, txItems]);

  // ─── CATEGORY BREAKDOWN (for pie chart) ───
  const categoryBreakdown = useMemo(() => {
    const cats = {};
    const catColors = ["var(--g)", "var(--b)", "var(--y)", "var(--p)", "var(--c)", "var(--r)", "#F97316", "#8B5CF6"];
    const doneTx = transactions.filter(tx => tx.status === "done");
    for (const tx of doneTx) {
      for (const it of txItems.filter(i => i.transaction_id === tx.id)) {
        const p = effectivePrices.find(pr => pr.item_code === it.waste_code);
        const cat = p?.category || "other";
        if (!cats[cat]) cats[cat] = { label: cat, value: 0 };
        cats[cat].value += Number(it.weight_kg);
      }
    }
    const sorted = Object.values(cats).sort((a, b) => b.value - a.value);
    return sorted.map((c, i) => ({ ...c, color: catColors[i % catColors.length] }));
  }, [transactions, txItems, effectivePrices]);

  // ─── REVENUE TREND (for area chart) ───
  const revenueTrend = useMemo(() => {
    const calcVal = (txId) => txItems.filter(i => i.transaction_id === txId).reduce((sum, it) => {
      const p = effectivePrices.find(pr => pr.item_code === it.waste_code);
      return sum + (p?.dp_price || p?.pelapak_price || 0) * Number(it.weight_kg);
    }, 0);
    const months = {};
    for (const tx of transactions.filter(t2 => t2.status === "done")) {
      const m = tx.created_at?.slice(0, 7);
      if (!months[m]) months[m] = 0;
      months[m] += calcVal(tx.id);
    }
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => ({ y: v, label: m.slice(5) }));
  }, [transactions, txItems, effectivePrices]);

  // ─── PERIOD COMPARISON ───
  const periodCompare = useMemo(() => {
    const now = new Date();
    const calcWeight = (txs) => txs.reduce((s, tx) => s + txItems.filter(i => i.transaction_id === tx.id).reduce((s2, it) => s2 + Number(it.weight_kg), 0), 0);
    const calcVal = (txs) => txs.reduce((s, tx) => s + txItems.filter(i => i.transaction_id === tx.id).reduce((sum, it) => {
      const p = effectivePrices.find(pr => pr.item_code === it.waste_code);
      return sum + (p?.dp_price || p?.pelapak_price || 0) * Number(it.weight_kg);
    }, 0), 0);
    const range = dashPeriod === "week" ? 7 : dashPeriod === "month" ? 30 : 365;
    const current = transactions.filter(tx => tx.status === "done" && (Date.now() - new Date(tx.created_at).getTime()) < range * 864e5);
    const previous = transactions.filter(tx => tx.status === "done" && (Date.now() - new Date(tx.created_at).getTime()) >= range * 864e5 && (Date.now() - new Date(tx.created_at).getTime()) < range * 2 * 864e5);
    const cw = calcWeight(current), pw = calcWeight(previous);
    const cv = calcVal(current), pv = calcVal(previous);
    return { curr: { weight: cw, value: cv, count: current.length }, prev: { weight: pw, value: pv, count: previous.length }, weightGrowth: pw > 0 ? Math.round(((cw - pw) / pw) * 100) : 0, valueGrowth: pv > 0 ? Math.round(((cv - pv) / pv) * 100) : 0 };
  }, [transactions, txItems, effectivePrices, dashPeriod]);

  // ─── CARBON CREDIT CALCULATOR ───
  const carbonCredit = useMemo(() => {
    const totalKg = parseFloat(envImpact.totalWeight) || 0;
    // Standard: 1 carbon credit = 1 tonne CO2e avoided. Recycling ~2.5kg CO2 per kg waste
    const co2Tonnes = (totalKg * 2.5) / 1000;
    const creditValue = co2Tonnes * 150000; // ~Rp150,000 per tonne CO2 (Indonesia voluntary market)
    const treesEquiv = Math.round(totalKg / 50);
    const energySaved = Math.round(totalKg * 4.2); // kWh
    return { co2Tonnes: co2Tonnes.toFixed(3), credits: co2Tonnes.toFixed(3), creditValue: Math.round(creditValue), trees: treesEquiv, energy: energySaved, totalKg };
  }, [envImpact]);

  // ─── DP RATINGS ───
  const dpRatings = useMemo(() => {
    const m = {};
    for (const r of reviews) {
      if (!m[r.drop_point_id]) m[r.drop_point_id] = { sum: 0, count: 0 };
      m[r.drop_point_id].sum += r.rating;
      m[r.drop_point_id].count++;
    }
    for (const k in m) m[k].avg = (m[k].sum / m[k].count).toFixed(1);
    return m;
  }, [reviews]);

  // ─── DYNAMIC PRICING INDICATORS ───
  const priceTrends = useMemo(() => {
    const trends = {};
    for (const p of effectivePrices) {
      const hist = priceHistory.filter(h => h.item_code === p.item_code).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      if (hist.length >= 2) {
        const recent = hist.slice(-3).reduce((s, h) => s + Number(h.price), 0) / Math.min(hist.length, 3);
        const older = hist.slice(0, Math.max(hist.length - 3, 1)).reduce((s, h) => s + Number(h.price), 0) / Math.max(hist.length - 3, 1);
        trends[p.item_code] = { dir: recent > older ? "up" : recent < older ? "down" : "flat", pct: older > 0 ? Math.round(((recent - older) / older) * 100) : 0 };
      }
    }
    // Demand-based: count TX items in last 30 days
    const cutoff = Date.now() - 30 * 864e5;
    const recentTx = transactions.filter(tx => new Date(tx.created_at).getTime() >= cutoff);
    for (const tx of recentTx) {
      for (const it of txItems.filter(i => i.transaction_id === tx.id)) {
        if (!trends[it.waste_code]) trends[it.waste_code] = { dir: "flat", pct: 0 };
        trends[it.waste_code].demand = (trends[it.waste_code].demand || 0) + Number(it.weight_kg);
      }
    }
    return trends;
  }, [effectivePrices, priceHistory, transactions, txItems]);

  // ─── PREDICTIVE ANALYTICS ───
  const predictions = useMemo(() => {
    const calcTxVal = (txId) => txItems.filter(i => i.transaction_id === txId).reduce((sum, it) => {
      const p = effectivePrices.find(pr => pr.item_code === it.waste_code);
      return sum + (p?.dp_price || p?.pelapak_price || 0) * Number(it.weight_kg);
    }, 0);
    const months = {};
    for (const tx of transactions.filter(t2 => t2.status === "done")) {
      const m = tx.created_at?.slice(0, 7);
      if (!months[m]) months[m] = { weight: 0, value: 0, count: 0 };
      months[m].count++;
      months[m].weight += txItems.filter(i => i.transaction_id === tx.id).reduce((s, it) => s + Number(it.weight_kg), 0);
      months[m].value += calcTxVal(tx.id);
    }
    const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
    if (sorted.length < 2) return { trend: "flat", nextMonth: { weight: 0, value: 0 }, monthlyData: sorted };
    const last3 = sorted.slice(-3);
    const avgW = last3.reduce((s, [, d]) => s + d.weight, 0) / last3.length;
    const avgV = last3.reduce((s, [, d]) => s + d.value, 0) / last3.length;
    const growth = sorted.length >= 2 ? (sorted[sorted.length - 1][1].weight - sorted[sorted.length - 2][1].weight) / (sorted[sorted.length - 2][1].weight || 1) : 0;
    return { trend: growth > 0.05 ? "up" : growth < -0.05 ? "down" : "flat", growth: Math.round(growth * 100), nextMonth: { weight: Math.round(avgW * (1 + growth)), value: Math.round(avgV * (1 + growth)) }, monthlyData: sorted };
  }, [transactions, txItems, effectivePrices]);

  // ─── ROUTE OPTIMIZATION (DP distances) ───
  const dpDistances = useMemo(() => {
    if (!userLocation) return [];
    return dropPoints.filter(dp => dp.lat && dp.lng).map(dp => {
      const dLat = (dp.lat - userLocation.lat) * 111;
      const dLng = (dp.lng - userLocation.lng) * 111 * Math.cos(userLocation.lat * Math.PI / 180);
      return { ...dp, dist: Math.hypot(dLat, dLng).toFixed(1) };
    }).sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
  }, [userLocation, dropPoints]);

  // ─── SMART RECOMMENDATIONS ───
  const recommendations = useMemo(() => {
    const recs = [];
    // Best time to sell (based on price trends)
    const rising = Object.entries(priceTrends).filter(([, v]) => v.dir === "up" && v.pct > 5);
    if (rising.length) {
      const topRise = rising.sort((a, b) => b[1].pct - a[1].pct)[0];
      const item = effectivePrices.find(p => p.item_code === topRise[0]);
      if (item) recs.push({ icon: "📈", text: lang === "id" ? `${item.name} naik ${topRise[1].pct}% — waktu bagus untuk jual!` : `${item.name} up ${topRise[1].pct}% — good time to sell!`, color: "var(--g)" });
    }
    // High demand items
    const highDemand = Object.entries(priceTrends).filter(([, v]) => (v.demand || 0) > 10).sort((a, b) => (b[1].demand || 0) - (a[1].demand || 0));
    if (highDemand.length) {
      const item = effectivePrices.find(p => p.item_code === highDemand[0][0]);
      if (item) recs.push({ icon: "🔥", text: lang === "id" ? `${item.name} permintaan tinggi (${highDemand[0][1].demand?.toFixed(0)}kg/bulan)` : `${item.name} high demand (${highDemand[0][1].demand?.toFixed(0)}kg/month)`, color: "var(--y)" });
    }
    // Nearest DP suggestion
    if (dpDistances.length) {
      const nearest = dpDistances[0];
      recs.push({ icon: "📍", text: lang === "id" ? `DP terdekat: ${nearest.name} (~${nearest.dist}km)` : `Nearest DP: ${nearest.name} (~${nearest.dist}km)`, color: "var(--b)" });
    }
    // Membership suggestion
    if (profile?.membership_tier === "free" && myPoints > 500) recs.push({ icon: "⭐", text: lang === "id" ? "Poin cukup untuk upgrade Silver! 2x multiplier poin." : "Enough points for Silver upgrade! 2x point multiplier.", color: "var(--p)" });
    return recs;
  }, [priceTrends, effectivePrices, dpDistances, profile, myPoints, lang]);

  // ─── AREA LEADERBOARD ───
  const areaLeaderboard = useMemo(() => {
    if (areaFilter === "all") return leaderboard;
    // Group users by their transaction DP areas
    const dpAreaUsers = new Set();
    for (const tx of transactions) {
      if (String(tx.drop_point_id) === areaFilter) dpAreaUsers.add(tx.user_id);
    }
    return leaderboard.filter(u => dpAreaUsers.has(u.id));
  }, [leaderboard, areaFilter, transactions]);

  // ─── INVENTORY STATS (for DP/Bank) ───
  const inventoryStats = useMemo(() => {
    if (!myEntity || !["dp", "bank"].includes(profile?.role)) return null;
    const catBreakdown = {};
    const myTx = transactions.filter(tx => tx.status === "done" && (profile.role === "dp" ? tx.drop_point_id === String(myEntity.id) : true));
    for (const tx of myTx) {
      for (const it of txItems.filter(i => i.transaction_id === tx.id)) {
        if (!catBreakdown[it.waste_code]) catBreakdown[it.waste_code] = { name: it.waste_name, weight: 0, count: 0 };
        catBreakdown[it.waste_code].weight += Number(it.weight_kg);
        catBreakdown[it.waste_code].count++;
      }
    }
    const capacity = Number(myEntity.capacity_kg) || 500;
    const stock = Number(myEntity.current_stock_kg) || 0;
    const utilization = Math.min(Math.round((stock / capacity) * 100), 100);
    return { capacity, stock, utilization, categories: Object.values(catBreakdown).sort((a, b) => b.weight - a.weight) };
  }, [myEntity, profile, transactions, txItems]);

  const getTxTotal = (txId) => {
    const items = txItems.filter(i => i.transaction_id === txId);
    return items.reduce((sum, it) => {
      const p = effectivePrices.find(pr => pr.item_code === it.waste_code);
      const price = profile?.role === "pelapak" ? (p?.pelapak_price || 0)
        : profile?.role === "bank" ? (p?.bank_price || 0)
          : (p?.dp_price || p?.pelapak_price || 0);
      return sum + price * Number(it.weight_kg);
    }, 0);
  };

  // ─── DASHBOARD STATS ───
  const computeStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 864e5);
    const monthAgo = new Date(now - 30 * 864e5);
    const filterByPeriod = (list) => {
      if (dashPeriod === "week") return list.filter(tx => new Date(tx.created_at) >= weekAgo);
      if (dashPeriod === "month") return list.filter(tx => new Date(tx.created_at) >= monthAgo);
      return list;
    };
    const myTx = filterByPeriod(transactions);
    const doneTx = myTx.filter(tx => tx.status === "done");
    const totalWeight = doneTx.reduce((s, tx) => {
      const items = txItems.filter(i => i.transaction_id === tx.id);
      return s + items.reduce((s2, it) => s2 + Number(it.weight_kg), 0);
    }, 0);
    const totalValue = doneTx.reduce((s, tx) => s + getTxTotal(tx.id), 0);
    return { totalTx: myTx.length, doneTx: doneTx.length, pendingTx: myTx.filter(tx => tx.status === "pending").length, totalWeight, totalValue };
  }, [transactions, txItems, dashPeriod, effectivePrices]);

  const weeklyData = useMemo(() => {
    const days = Array(7).fill(0);
    const now = new Date();
    for (const tx of transactions.filter(t2 => t2.status === "done")) {
      const d = new Date(tx.created_at);
      const diff = Math.floor((now - d) / 864e5);
      if (diff >= 0 && diff < 7) {
        const items = txItems.filter(i => i.transaction_id === tx.id);
        days[6 - diff] += items.reduce((s, it) => s + Number(it.weight_kg), 0);
      }
    }
    return days;
  }, [transactions, txItems]);

  // ─── SUBMIT REVIEW ───
  const submitReview = async () => {
    if (!reviewForm.txId || reviewForm.rating < 1) return;
    const tx = transactions.find(t2 => t2.id === reviewForm.txId);
    try {
      await sb.insert("reviews", { user_id: user.id, drop_point_id: tx?.drop_point_id || "", transaction_id: reviewForm.txId, rating: reviewForm.rating, comment: reviewForm.comment || null }, token);
      flash(t("review_submitted"));
      setShowReviewModal(false);
      setReviewForm({ txId: null, rating: 0, comment: "" });
      loadData();
    } catch (e) { flash(`Error: ${e.message}`, "err"); }
  };

  // ─── PRINT INVOICE ───
  const printInvoice = (txId) => {
    setPrintTx(txId);
    setTimeout(() => { window.print(); setPrintTx(null); }, 200);
  };

  // ─── REQUEST PICKUP ───
  const requestPickup = async () => {
    if (!pickupForm.dp || !pickupForm.address) { flash(lang === "id" ? "Lengkapi data!" : "Fill in all fields!", "err"); return; }
    try {
      await sb.insert("pickup_schedules", {
        drop_point_id: pickupForm.dp, requested_by: user.id, status: "requested",
        address: pickupForm.address, estimated_kg: parseFloat(pickupForm.estimated_kg) || null,
        notes: pickupForm.notes || null, pickup_date: new Date().toISOString().slice(0, 10),
      }, token);
      flash(t("pickup_requested"));
      sendBrowserNotif("Pickup", t("pickup_requested"));
      setPickupForm({ dp: "", address: "", estimated_kg: "", notes: "" });
      loadData();
    } catch (e) { flash(`Error: ${e.message}`, "err"); }
  };

  // ─── UPDATE PICKUP STATUS ───
  const updatePickupStatus = async (id, status) => {
    try {
      await sb.update("pickup_schedules", { id }, { status, updated_at: new Date().toISOString() }, token);
      flash(`Pickup → ${status.toUpperCase()}`);
      sendBrowserNotif("Pickup Update", `Status: ${status}`);
      loadData();
    } catch (e) { flash(`Error: ${e.message}`, "err"); }
  };

  // ─── SHARE ACHIEVEMENT ───
  const shareAchievement = async () => {
    const txt = lang === "id"
      ? `🌍 Dampak lingkungan saya via EcoChain AI:\n♻️ ${envImpact.totalWeight} kg didaur ulang\n🌿 ${envImpact.co2} kg CO₂ dihemat\n🌳 ${envImpact.trees} pohon diselamatkan\n💧 ${envImpact.water} liter air dihemat\n🏆 ${myBadges.length} badge\n\n#EcoChainAI`
      : `🌍 My impact via EcoChain AI:\n♻️ ${envImpact.totalWeight} kg recycled\n🌿 ${envImpact.co2} kg CO₂ saved\n🌳 ${envImpact.trees} trees saved\n💧 ${envImpact.water} L water saved\n🏆 ${myBadges.length} badges\n\n#EcoChainAI`;
    if (navigator.share) { try { await navigator.share({ title: "EcoChain AI", text: txt }); } catch {} }
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  // ─── GEOLOCATION ───
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: -6.26, lng: 106.69 }), // Default: Pondok Aren
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // ─── AUDIT LOG HELPER ───
  const logAudit = useCallback(async (action, entityType, entityId, details) => {
    if (!token || !user) return;
    sb.insert("audit_logs", { user_id: user.id, action, entity_type: entityType, entity_id: entityId, details }, token).catch(() => {});
  }, [token, user]);

  // ─── WALLET: TOP UP (simulation) ───
  const walletTopUp = async (amount) => {
    if (!amount || amount <= 0) return;
    try {
      await sb.rpc("credit_wallet", { p_user_id: user.id, p_amount: amount, p_desc: lang === "id" ? "Isi saldo manual" : "Manual top-up", p_ref: null }, token);
      flash(`✅ +${rp(amount)} ${t("balance")}`);
      logAudit("wallet_topup", "wallet", user.id, { amount });
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── MARKETPLACE: ADD PRODUCT ───
  const addProduct = async () => {
    if (!productForm.name || !productForm.price) { flash(lang === "id" ? "Lengkapi nama dan harga!" : "Fill in name and price!", "err"); return; }
    try {
      await sb.insert("recycled_products", {
        seller_id: user.id, name: productForm.name.trim(), description: productForm.description || null,
        price: parseFloat(productForm.price), category: productForm.category || "other",
        stock: parseInt(productForm.stock) || 1,
      }, token);
      flash(`✅ ${productForm.name} ${lang === "id" ? "ditambahkan!" : "listed!"}`);
      logAudit("product_listed", "product", productForm.name, { price: productForm.price });
      setProductForm({ name: "", description: "", price: "", category: "", stock: "1" });
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── DISPUTE: RAISE ───
  const raiseDispute = async () => {
    if (!disputeForm.txId || !disputeForm.reason) { flash(lang === "id" ? "Lengkapi alasan!" : "Please provide a reason!", "err"); return; }
    try {
      await sb.insert("disputes", { transaction_id: disputeForm.txId, user_id: user.id, reason: disputeForm.reason }, token);
      flash(lang === "id" ? "Sengketa berhasil diajukan" : "Dispute submitted");
      logAudit("dispute_raised", "transaction", disputeForm.txId, { reason: disputeForm.reason });
      setShowDisputeModal(false);
      setDisputeForm({ txId: null, reason: "" });
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── DISPUTE: RESOLVE (DP/Bank) ───
  const resolveDispute = async (id, resolution) => {
    try {
      await sb.update("disputes", { id }, { status: "resolved", resolution, updated_at: new Date().toISOString() }, token);
      flash(lang === "id" ? "Sengketa diselesaikan" : "Dispute resolved");
      logAudit("dispute_resolved", "dispute", String(id), { resolution });
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── MEMBERSHIP UPGRADE ───
  const upgradeMembership = async (tier) => {
    const cost = tier === "silver" ? 500 : tier === "gold" ? 2000 : 0;
    if (myPoints < cost) { flash(lang === "id" ? `Butuh ${cost} poin untuk ${tier}` : `Need ${cost} points for ${tier}`, "err"); return; }
    try {
      await sb.update("profiles", { id: profile.id }, { membership_tier: tier }, token);
      const updated = { ...profile, membership_tier: tier };
      setProfile(updated);
      localStorage.setItem("eco_session", JSON.stringify({ token, user, profile: updated }));
      flash(`✅ ${lang === "id" ? "Upgrade ke" : "Upgraded to"} ${tier.toUpperCase()}!`);
      logAudit("membership_upgrade", "profile", profile.id, { tier });
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── FAQ DATA ───
  const FAQ_DATA = useMemo(() => [
    { q: lang === "id" ? "Bagaimana cara menjual sampah?" : "How to sell waste?", a: lang === "id" ? "1. Pilah sampah per kategori\n2. Bawa ke Drop Point terdekat\n3. Timbang dan catat di transaksi\n4. Terima pembayaran ke dompet digital" : "1. Sort waste by category\n2. Bring to nearest Drop Point\n3. Weigh and record transaction\n4. Receive payment to digital wallet" },
    { q: lang === "id" ? "Berapa harga sampah saat ini?" : "What are current waste prices?", a: lang === "id" ? "Harga bervariasi per item dan Drop Point. Cek tab Harga untuk daftar lengkap. Botol bersih biasanya 2-3x lebih mahal dari kotor." : "Prices vary by item and Drop Point. Check the Prices tab for full list. Clean bottles usually fetch 2-3x more than dirty ones." },
    { q: lang === "id" ? "Apa itu sistem poin?" : "What is the points system?", a: lang === "id" ? "Setiap kg sampah yang disetor = 10 poin. Poin digunakan untuk:\n- Naik peringkat leaderboard\n- Unlock badge pencapaian\n- Upgrade membership (Silver: 500pts, Gold: 2000pts)" : "Every kg of waste = 10 points. Points are used for:\n- Leaderboard ranking\n- Unlock achievement badges\n- Membership upgrade (Silver: 500pts, Gold: 2000pts)" },
    { q: lang === "id" ? "Bagaimana cara request pickup?" : "How to request pickup?", a: lang === "id" ? "Buka tab Pickup → Minta Pickup → Pilih DP, isi alamat, estimasi berat → Kirim. DP operator akan menjadwalkan penjemputan." : "Open Pickup tab → Request Pickup → Select DP, enter address, estimated weight → Submit. DP operator will schedule pickup." },
    { q: lang === "id" ? "Apa itu Marketplace?" : "What is Marketplace?", a: lang === "id" ? "Marketplace adalah tempat jual-beli produk daur ulang. Pelapak dan Bank Sampah bisa menjual produk hasil olahan sampah." : "Marketplace is where recycled products are bought and sold. Pelapak and Bank Sampah can sell processed waste products." },
  ], [lang]);

  // ─── CHAT SYSTEM PROMPT ───
  const buildChatSystemPrompt = useCallback(() => {
    let priceSummary = "";
    const grouped = {};
    for (const p of effectivePrices) {
      if (!grouped[p.category]) grouped[p.category] = { icon: "", label: p.category, items: [] };
      const displayPrice = p.dp_price || p.bank_price || p.pelapak_price || 0;
      grouped[p.category].items.push(`${p.name} Rp${Math.round(displayPrice).toLocaleString("id-ID")}${p.unit !== "kg" ? `/${p.unit}` : "/kg"}`);
    }
    const catMap = {};
    for (const c of categories) catMap[c.code] = c;
    for (const [code, g] of Object.entries(grouped)) {
      const cat = catMap[code];
      priceSummary += `${cat?.icon || "📦"} ${cat?.label || code}: ${g.items.join(", ")}\n`;
    }

    const dpList = dropPoints.map(dp =>
      `- ${dp.name} (${dp.address}) — Operator: ${dp.operator_name || "-"}, Stok: ${Number(dp.current_stock_kg).toFixed(0)}/${Number(dp.capacity_kg).toFixed(0)}kg`
    ).join("\n");

    const bsList = bankSampah.map(bs =>
      `- ${bs.name} (${bs.address}) — Rating: ${bs.rating || "-"}/5, Jam: ${bs.operating_hours || "-"}`
    ).join("\n");

    const cascadeInfo = `Model Harga Cascade (3 level per-entity):
- Pelapak: menetapkan harga dasar per item
- Bank Sampah: memilih Pelapak, lalu harga = harga Pelapak × (1 - margin Bank)
- Drop Point: memilih Bank Sampah, lalu harga = harga Bank × (1 - margin DP)
Masyarakat membeli di harga Drop Point.`;

    return `Kamu adalah EcoChain Assistant, asisten AI untuk marketplace ekonomi sirkular sampah di area Pondok Aren, Tangerang Selatan, Indonesia.

PERAN:
- Kamu membantu masyarakat, pengelola drop point, bank sampah, dan pelapak.
- Kamu ahli dalam harga sampah daur ulang, lokasi pengumpulan, dan tips sorting.
- Jawab selalu dalam Bahasa Indonesia yang ramah dan informatif.
- Gunakan emoji secukupnya untuk keramahan.
- Jika ditanya hal di luar topik sampah/daur ulang, arahkan kembali dengan sopan.

HARGA SAMPAH TERKINI (harga per kg):
${priceSummary}
${cascadeInfo}

DROP POINT AKTIF:
${dpList || "Belum ada data"}

BANK SAMPAH:
${bsList || "Belum ada data"}

TIPS PENTING:
- Botol plastik bersih (lepas label) harga lebih tinggi dari kotor — selisih besar!
- Tembaga adalah item paling bernilai
- Minyak jelantah harus disaring, jangan campur air
- Pisahkan sampah per kategori untuk harga maksimal

Jawab pertanyaan user berdasarkan data di atas. Jika user tanya harga, tampilkan harga level Drop Point (harga untuk masyarakat), kecuali diminta spesifik.`;
  }, [effectivePrices, dropPoints, bankSampah, categories]);

  // ─── SEND CHAT ───
  const sendChat = async (directQuery) => {
    const q = (directQuery || chatInput).trim();
    if (!q || chatLoading) return;
    if (!directQuery) setChatInput("");
    setAiChat(prev => [...prev, { role: "user", text: q }]);

    if (!GROQ_API_KEY) {
      // Demo fallback
      await new Promise(r => setTimeout(r, 800));
      const lower = q.toLowerCase();
      let reply = "Halo! Saya EcoChain Assistant. Saya bisa bantu info harga sampah, lokasi drop point, dan tips daur ulang. 🌱";
      if (lower.includes("harga") || lower.includes("price")) {
        const sample = effectivePrices.slice(0, 5).map(p => `${p.name}: ${rp(p.dp_price || p.pelapak_price)}/${p.unit}`).join("\n");
        reply = `Berikut beberapa harga sampah terkini:\n${sample}\n\nMau tanya harga item spesifik? 😊`;
      } else if (lower.includes("drop point") || lower.includes("lokasi")) {
        reply = dropPoints.length
          ? `Ada ${dropPoints.length} Drop Point aktif:\n${dropPoints.map(d => `📍 ${d.name} — ${d.address}`).join("\n")}`
          : "Belum ada data drop point.";
      } else if (lower.includes("bank sampah")) {
        reply = bankSampah.length
          ? `Ada ${bankSampah.length} Bank Sampah:\n${bankSampah.map(b => `🏦 ${b.name} — ${b.address}`).join("\n")}`
          : "Belum ada data bank sampah.";
      } else if (lower.includes("tips") || lower.includes("sorting")) {
        reply = "💡 Tips sorting:\n1. Pisahkan per kategori\n2. Bersihkan botol (lepas label = harga lebih tinggi)\n3. Keringkan sebelum ditimbang\n4. Saring minyak jelantah";
      }
      setAiChat(prev => [...prev, { role: "ai", text: `${reply}\n\n⚠️ Mode Demo — hubungkan Groq API untuk AI penuh.` }]);
      return;
    }

    setChatLoading(true);
    try {
      const systemPrompt = buildChatSystemPrompt();
      const history = aiChat.slice(-10).map(m => ({
        role: m.role === "user" ? "user" : "assistant", content: m.text,
      }));
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: q }],
          temperature: 0.7, max_tokens: 1024,
        }),
      });
      if (!res.ok) throw new Error(`Groq API ${res.status}`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "Maaf, tidak bisa memproses jawaban.";
      setAiChat(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      setAiChat(prev => [...prev, { role: "ai", text: `❌ Error: ${err.message}` }]);
    }
    setChatLoading(false);
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiChat, chatLoading]);

  // ─── LEAFLET MAP ───
  useEffect(() => {
    if (tab !== "map" || !mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.invalidateSize(); return; }
    const initMap = () => {
      if (!window.L || !mapRef.current || mapInstanceRef.current) return;
      const map = window.L.map(mapRef.current).setView([-6.26, 106.69], 13);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);
      mapInstanceRef.current = map;
      for (const dp of dropPoints) {
        if (!dp.lat || !dp.lng) continue;
        window.L.circleMarker([dp.lat, dp.lng], { radius: 8, fillColor: "#F59E0B", color: "#D97706", weight: 2, fillOpacity: 0.8 })
          .addTo(map)
          .bindPopup(`<b>📍 ${dp.name}</b><br>${dp.address}<br>👤 ${dp.operator_name || "-"}<br>Stok: ${Number(dp.current_stock_kg).toFixed(0)}/${Number(dp.capacity_kg).toFixed(0)} kg<br><a href="https://www.google.com/maps?q=${dp.lat},${dp.lng}" target="_blank">Navigate →</a>`);
      }
      for (const bs of bankSampah) {
        if (!bs.lat || !bs.lng) continue;
        window.L.circleMarker([bs.lat, bs.lng], { radius: 8, fillColor: "#3B82F6", color: "#2563EB", weight: 2, fillOpacity: 0.8 })
          .addTo(map)
          .bindPopup(`<b>🏦 ${bs.name}</b><br>${bs.address}<br>⏰ ${bs.operating_hours || "-"}<br><a href="https://www.google.com/maps?q=${bs.lat},${bs.lng}" target="_blank">Navigate →</a>`);
      }
      // Heatmap overlay
      if (showHeatmap) {
        const dpAct = {};
        for (const tx of transactions.filter(t2 => t2.status === "done")) {
          const did = tx.drop_point_id;
          if (!dpAct[did]) dpAct[did] = { count: 0, weight: 0 };
          dpAct[did].count++;
          dpAct[did].weight += txItems.filter(i => i.transaction_id === tx.id).reduce((s, it) => s + Number(it.weight_kg), 0);
        }
        const maxW = Math.max(...Object.values(dpAct).map(a => a.weight), 1);
        for (const dp of dropPoints) {
          if (!dp.lat || !dp.lng) continue;
          const act = dpAct[String(dp.id)] || { count: 0, weight: 0 };
          if (act.count === 0) continue;
          const ratio = act.weight / maxW;
          window.L.circle([dp.lat, dp.lng], { radius: 200 + ratio * 800, fillColor: "#22C55E", color: "transparent", fillOpacity: 0.1 + ratio * 0.35 })
            .addTo(map).bindPopup(`<b>${dp.name}</b><br>${act.count} TX, ${act.weight.toFixed(1)} kg`);
        }
      }
    };
    const loadLeaflet = () => {
      if (document.getElementById("leaflet-css")) { initMap(); return; }
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => initMap();
      document.head.appendChild(script);
    };
    loadLeaflet();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [tab, dropPoints, bankSampah, showHeatmap, transactions, txItems]);

  const roleLabel = { user: "End User", dp: "Drop Point", bank: "Bank Sampah", pelapak: "Pelapak" };
  const roleIcon = { user: "👤", dp: "📍", bank: "🏦", pelapak: "🏭" };
  const roleColor = { user: "#22C55E", dp: "#F59E0B", bank: "#3B82F6", pelapak: "#A855F7" };

  // ─── CSS ───
  const themeVars = theme === "light"
    ? `:root{--bg:#F8FAFC;--bg2:#F1F5F9;--bg3:#FFFFFF;--bdr:rgba(0,0,0,0.08);--bdr2:rgba(0,0,0,0.12);--t:#334155;--t2:#94A3B8;--w:#0F172A;--g:#16A34A;--y:#D97706;--b:#2563EB;--p:#9333EA;--r:#DC2626;--c:#0891B2;--f:'Sora',sans-serif;--m:'JetBrains Mono',monospace;--d:'Fraunces',serif}`
    : `:root{--bg:#080C14;--bg2:#0D1420;--bg3:#131B2B;--bdr:rgba(255,255,255,0.06);--bdr2:rgba(255,255,255,0.1);--t:#CBD5E1;--t2:#64748B;--w:#F1F5F9;--g:#22C55E;--y:#F59E0B;--b:#3B82F6;--p:#A855F7;--r:#EF4444;--c:#06B6D4;--f:'Sora',sans-serif;--m:'JetBrains Mono',monospace;--d:'Fraunces',serif}`;
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,800&display=swap');
    ${themeVars}
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pop{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    .fu{animation:fu .4s ease both}.fu1{animation:fu .4s .05s ease both}.fu2{animation:fu .4s .1s ease both}.fu3{animation:fu .4s .15s ease both}.fu4{animation:fu .4s .2s ease both}
    .c{background:var(--bg3);border:1px solid var(--bdr);border-radius:14px;transition:all .2s}
    .c:hover{border-color:var(--bdr2);box-shadow:0 4px 20px rgba(0,0,0,.25)}
    .bt{border:none;cursor:pointer;font-family:var(--f);transition:all .15s;border-radius:10px}
    .bt:hover{filter:brightness(1.1);transform:scale(1.01)}
    @media print{body *{visibility:hidden}#invoice-print,#invoice-print *{visibility:visible}#invoice-print{position:absolute;left:0;top:0;width:100%;padding:20px}}
    .bt:active{transform:scale(.98)}
    .pl{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:7px;font-size:10px;font-weight:600}
    input,select{font-family:var(--f);background:rgba(255,255,255,.03);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;color:var(--w);font-size:13px;outline:none;width:100%;transition:border .2s}
    input:focus,select:focus{border-color:var(--g)}
    select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
    select option{background:${theme === "light" ? "#fff" : "#1a2332"};color:${theme === "light" ? "#0F172A" : "#fff"}}
    input[type=range]{accent-color:var(--b);height:4px;padding:0}
    ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:3px}
  `;

  const Badge = ({ children, color, outline }) => (
    <span className="pl" style={{ background: outline ? "transparent" : `${color}18`, color, border: outline ? `1px solid ${color}35` : "none" }}>{children}</span>
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--f)", color: "var(--t)" }}>
      <style>{CSS}</style>
      <div style={{ position: "fixed", inset: 0, opacity: 0.012, pointerEvents: "none", backgroundImage: "radial-gradient(circle at 1px 1px,#fff .5px,transparent 0)", backgroundSize: "24px 24px" }} />

      {/* NOTIF */}
      {notif && (
        <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "11px 26px", borderRadius: 12, background: notif.type === "err" ? "rgba(239,68,68,.92)" : notif.type === "info" ? "rgba(59,130,246,.92)" : "rgba(34,197,94,.92)", color: "#fff", fontWeight: 600, fontSize: 13, backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,.4)", animation: "pop .25s ease" }}>{notif.msg}</div>
      )}

      {/* HEADER */}
      <header style={{ padding: "10px 20px", background: theme === "light" ? "rgba(248,250,252,.9)" : "rgba(8,12,20,.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--bdr)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#22C55E,#06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, fontFamily: "var(--d)", color: "#000" }}>♻</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--d)", color: "var(--w)" }}>Eco<span style={{ color: "var(--g)" }}>Chain</span><span style={{ color: "var(--c)", fontSize: 11, fontStyle: "italic" }}> AI</span></div>
              <div style={{ fontSize: 7, fontFamily: "var(--m)", color: "var(--t2)", letterSpacing: 1.5 }}>MARKETPLACE EKONOMI SIRKULAR SAMPAH</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="bt" onClick={() => setTheme(th => th === "dark" ? "light" : "dark")}
              style={{ padding: "6px 10px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 13, border: "1px solid var(--bdr)" }}>
              {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
            </button>
            <button className="bt" onClick={() => { const n = lang === "id" ? "en" : "id"; setLang(n); localStorage.setItem("eco_lang", n); }}
              style={{ padding: "6px 10px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 11, fontWeight: 700, fontFamily: "var(--m)", border: "1px solid var(--bdr)" }}>
              {lang === "id" ? "EN" : "ID"}
            </button>
            {profile ? (<>
              <button className="bt" onClick={() => setShowAlerts(!showAlerts)} style={{ padding: "6px 10px", background: "rgba(255,255,255,.04)", color: priceAlerts.length ? "var(--y)" : "var(--t2)", fontSize: 13, border: "1px solid var(--bdr)", position: "relative" }}>
                🔔{priceAlerts.length > 0 && <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "var(--r)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{priceAlerts.length}</span>}
              </button>
              {notifPermission === "default" && (
                <button className="bt" onClick={requestNotifPermission} style={{ padding: "4px 8px", background: "rgba(34,197,94,.06)", color: "var(--g)", fontSize: 9, border: "1px solid rgba(34,197,94,.15)" }}>🔕</button>
              )}
              {notifPermission === "granted" && <span style={{ fontSize: 8, color: "var(--g)" }}>●</span>}
              <Badge color={roleColor[profile.role]}>{roleIcon[profile.role]} {roleLabel[profile.role]}</Badge>
              <span onClick={openProfile} style={{ fontSize: 12, color: "var(--w)", fontWeight: 600, cursor: "pointer" }}>{profile.name}</span>
              <button className="bt" onClick={logout} style={{ padding: "6px 14px", background: "rgba(239,68,68,.12)", color: "var(--r)", fontSize: 11, fontWeight: 600, border: "1px solid rgba(239,68,68,.2)" }}>{t("logout")}</button>
            </>) : (
              <div style={{ fontSize: 11, color: "var(--t2)" }}>{t("not_logged")}</div>
            )}
          </div>
        </div>
      </header>

      {/* ── Real-time Price Ticker ── */}
      {token && effectivePrices.length > 0 && (
        <div style={{ overflow: "hidden", background: theme === "light" ? "rgba(241,245,249,.9)" : "rgba(15,23,42,.9)", borderBottom: "1px solid var(--bdr)", padding: "5px 0", position: "relative" }}>
          <style>{`@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
          <div style={{ display: "flex", gap: 24, animation: "ticker 30s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
            {[...effectivePrices, ...effectivePrices].map((p, i) => {
              const tr = priceTrends[p.item_code];
              const price = p.dp_price || p.bank_price || p.pelapak_price || 0;
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "var(--m)" }}>
                  <span style={{ color: "var(--t2)" }}>{p.item_name}</span>
                  <span style={{ fontWeight: 700, color: "var(--w)" }}>{rp(price)}</span>
                  {tr && <span style={{ fontSize: 9, fontWeight: 700, color: tr.dir === "up" ? "var(--g)" : tr.dir === "down" ? "var(--r)" : "var(--t2)" }}>
                    {tr.dir === "up" ? "▲" : tr.dir === "down" ? "▼" : "—"}{tr.pct !== 0 ? `${Math.abs(tr.pct)}%` : ""}
                  </span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px" }}>

        {/* ═══ AUTH SCREEN ═══ */}
        {!profile ? (
          <div className="fu" style={{ maxWidth: 420, margin: "40px auto" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>♻️</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--d)", color: "var(--w)" }}>Eco<span style={{ color: "var(--g)" }}>Chain</span> <span style={{ color: "var(--c)" }}>AI</span></h1>
              <p style={{ fontSize: 12, color: "var(--t2)", fontFamily: "var(--m)" }}>Marketplace Ekonomi Sirkular Sampah</p>
            </div>

            <div className="c" style={{ padding: 28 }}>
              {/* Login/Register toggle */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,.03)", borderRadius: 10, padding: 3 }}>
                {["login", "register"].map(m => (
                  <button key={m} className="bt" onClick={() => { setAuthMode(m); setAuthError(""); }}
                    style={{ flex: 1, padding: "10px", fontWeight: 600, fontSize: 13, color: authMode === m ? "var(--g)" : "var(--t2)", background: authMode === m ? "rgba(34,197,94,.1)" : "transparent", border: authMode === m ? "1px solid rgba(34,197,94,.2)" : "1px solid transparent" }}>
                    {m === "login" ? "Masuk" : "Daftar Baru"}
                  </button>
                ))}
              </div>

              {authError && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", color: "var(--r)", fontSize: 12, marginBottom: 14 }}>{authError}</div>
              )}

              <form onSubmit={handleAuth}>
                {authMode === "register" && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Nama</label>
                    <input value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama lengkap" required />
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Email</label>
                  <input type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" required />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Password</label>
                  <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" required minLength={6} />
                </div>

                {authMode === "register" && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Konfirmasi Password</label>
                    <input type="password" value={authForm.confirmPassword} onChange={e => setAuthForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="••••••••" required minLength={6} />
                  </div>
                )}

                {authMode === "register" && (
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 6, display: "block" }}>Peran</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[
                        { id: "user", label: "End User", sub: "Masyarakat", icon: "👤", c: "var(--g)" },
                        { id: "dp", label: "Drop Point", sub: "Retailer", icon: "📍", c: "var(--y)" },
                        { id: "bank", label: "Bank Sampah", sub: "Pengelola", icon: "🏦", c: "var(--b)" },
                        { id: "pelapak", label: "Pelapak", sub: "Industri", icon: "🏭", c: "var(--p)" },
                      ].map(r => (
                        <button key={r.id} type="button" className="bt" onClick={() => setAuthForm(f => ({ ...f, role: r.id }))}
                          style={{ padding: "12px", textAlign: "left", background: authForm.role === r.id ? `${r.c}12` : "rgba(255,255,255,.02)", border: `1px solid ${authForm.role === r.id ? `${r.c}35` : "var(--bdr)"}`, color: authForm.role === r.id ? r.c : "var(--t2)" }}>
                          <div style={{ fontSize: 14 }}>{r.icon} <strong style={{ fontSize: 12 }}>{r.label}</strong></div>
                          <div style={{ fontSize: 10, opacity: .7 }}>{r.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {authMode === "register" && ["dp", "bank", "pelapak"].includes(authForm.role) && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Koordinat Lokasi</label>
                    <input value={authForm.location} onChange={e => setAuthForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Paste dari Google Maps, cth: -6.259284, 106.688127" required />
                    {authForm.location && (() => {
                      const c = parseCoordinates(authForm.location);
                      return c
                        ? <div style={{ fontSize: 10, color: "var(--g)", marginTop: 4, fontFamily: "var(--m)" }}>Lat: {c.lat.toFixed(6)}, Lng: {c.lng.toFixed(6)}</div>
                        : <div style={{ fontSize: 10, color: "var(--r)", marginTop: 4 }}>Format tidak dikenali. Gunakan format: -6.259284, 106.688127</div>;
                    })()}
                    <div style={{ fontSize: 9, color: "var(--t2)", marginTop: 3 }}>Buka Google Maps &rarr; klik kanan lokasi &rarr; salin koordinat</div>
                  </div>
                )}

                {authMode === "register" && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>🎁 {t("enter_referral")}</label>
                    <input value={authForm.referralCode || ""} onChange={e => setAuthForm(f => ({ ...f, referralCode: e.target.value }))} placeholder={t("referral_code") + " (" + (lang === "id" ? "opsional" : "optional") + ")"} />
                  </div>
                )}

                <button type="submit" className="bt" disabled={authLoading}
                  style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 14, opacity: authLoading ? .6 : 1 }}>
                  {authLoading ? "⏳ Mohon tunggu..." : authMode === "login" ? "Masuk" : "Daftar"}
                </button>
              </form>
            </div>

            {/* Public price preview */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 10 }}>📊 Harga Sampah Terkini <span style={{ fontSize: 10, fontWeight: 400, color: "var(--t2)" }}>(publik)</span></h3>
              <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto", paddingBottom: 4 }}>
                {categories.map(c => (
                  <button key={c.code} className="bt" onClick={() => setCatFilter(c.code)} style={{ padding: "5px 10px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", background: catFilter === c.code ? `${c.accent}20` : "rgba(255,255,255,.02)", color: catFilter === c.code ? c.accent : "var(--t2)", border: `1px solid ${catFilter === c.code ? `${c.accent}30` : "var(--bdr)"}` }}>
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
              <div className="c" style={{ overflow: "hidden" }}>
                {filteredPrices.slice(0, 8).map((p, i) => (
                  <div key={p.item_code} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderTop: i ? "1px solid var(--bdr)" : "none", fontSize: 11 }}>
                    <span style={{ color: "var(--t)" }}><span style={{ fontFamily: "var(--m)", fontSize: 9, color: "var(--t2)", marginRight: 6 }}>{p.item_code}</span>{p.name}</span>
                    <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: "var(--g)" }}>{rp(p.dp_price || p.pelapak_price)}<span style={{ fontSize: 9, color: "var(--t2)", fontWeight: 400 }}>/{p.unit}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ═══ LOGGED IN ═══ */
          <div className="fu">
            {/* Role Banner */}
            <div style={{ padding: "16px 20px", borderRadius: 14, marginBottom: 18, background: `${roleColor[profile.role]}08`, border: `1px solid ${roleColor[profile.role]}20`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 30 }}>{roleIcon[profile.role]}</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>{profile.name} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--t2)" }}>— {roleLabel[profile.role]}</span></h2>
                <p style={{ fontSize: 11, color: "var(--t2)" }}>{profile.email}</p>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "var(--m)" }}>NETWORK</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--w)" }}>{dropPoints.length} DP • {bankSampah.length} BS</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto" }}>
              {[
                { id: "dashboard", label: `📊 ${t("dashboard")}`, show: !!token },
                { id: "prices", label: `💰 ${t("prices")}`, show: true },
                { id: "scan", label: `📷 ${t("scan")}`, show: profile.role === "user" },
                { id: "chat", label: `🤖 ${t("chat")}`, show: true },
                { id: "map", label: `🗺️ ${t("map")}`, show: true },
                { id: "tx", label: `📋 ${t("tx")}`, show: !!token },
                { id: "reports", label: `📄 ${t("reports")}`, show: !!token },
                { id: "newtx", label: `➕ ${t("newtx")}`, show: ["dp", "bank"].includes(profile.role) },
                { id: "kelola", label: `📦 ${t("kelola")}`, show: profile.role === "pelapak" },
                { id: "settings", label: `⚙️ ${t("settings")}`, show: ["bank", "dp"].includes(profile.role) },
                { id: "pickup", label: `🚛 ${t("pickup")}`, show: !!token },
                { id: "wallet", label: `💳 ${t("wallet")}`, show: !!token },
                { id: "marketplace", label: `🛒 ${t("marketplace")}`, show: !!token },
                { id: "community", label: `🌱 ${t("community")}`, show: !!token },
              ].filter(tb => tb.show).map(tb => (
                <button key={tb.id} className="bt" onClick={() => setTab(tb.id)} style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, background: tab === tb.id ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.02)", color: tab === tb.id ? "var(--g)" : "var(--t2)", border: `1px solid ${tab === tb.id ? "rgba(34,197,94,.25)" : "var(--bdr)"}`, whiteSpace: "nowrap" }}>
                  {tb.label}
                </button>
              ))}
            </div>

            {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--t2)" }}>⏳ {lang === "id" ? "Memuat data..." : "Loading..."}</div>}

            {/* ═── DASHBOARD TAB ──═ */}
            {!loading && tab === "dashboard" && (
              <div className="fu">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>📊 {t("dashboard")}</h3>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[["week", t("week")], ["month", t("month")], ["all", t("all_time")]].map(([k, l]) => (
                      <button key={k} className="bt" onClick={() => setDashPeriod(k)}
                        style={{ padding: "4px 10px", fontSize: 10, fontWeight: 600, background: dashPeriod === k ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.02)", color: dashPeriod === k ? "var(--g)" : "var(--t2)", border: `1px solid ${dashPeriod === k ? "rgba(34,197,94,.25)" : "var(--bdr)"}` }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stats cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: t("total_tx"), value: computeStats.totalTx, icon: "📋", color: "var(--c)" },
                    { label: t("done"), value: computeStats.doneTx, icon: "✅", color: "var(--g)" },
                    { label: t("total_weight"), value: `${computeStats.totalWeight.toFixed(1)} kg`, icon: "⚖️", color: "var(--b)" },
                    { label: t("total_value"), value: rp(computeStats.totalValue), icon: "💰", color: "var(--y)" },
                  ].map(s => (
                    <div key={s.label} className="c" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--d)", color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "var(--m)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Weekly chart */}
                <div className="c" style={{ padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>{lang === "id" ? "Berat 7 Hari Terakhir (kg)" : "Last 7 Days Weight (kg)"}</div>
                  <MiniChart data={weeklyData} color="var(--g)" height={64} barWidth={24} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--t2)", fontFamily: "var(--m)", marginTop: 4 }}>
                    {Array(7).fill(0).map((_, i) => {
                      const d = new Date(Date.now() - (6 - i) * 864e5);
                      return <span key={i}>{d.toLocaleDateString("id-ID", { weekday: "short" })}</span>;
                    })}
                  </div>
                </div>

                {/* ── Charts Pro: Category Breakdown + Revenue Trend ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div className="c" style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>{t("category_breakdown")}</div>
                    {categoryBreakdown.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <PieChart data={categoryBreakdown} size={120} />
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, justifyContent: "center" }}>
                          {categoryBreakdown.slice(0, 5).map((c, i) => (
                            <span key={i} style={{ fontSize: 8, color: "var(--t2)", display: "flex", alignItems: "center", gap: 3 }}>
                              <span style={{ width: 6, height: 6, borderRadius: 2, background: c.color, display: "inline-block" }} />
                              {c.label} ({c.value.toFixed(1)})
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : <div style={{ fontSize: 10, color: "var(--t2)", textAlign: "center", padding: 20 }}>{t("no_data")}</div>}
                  </div>
                  <div className="c" style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>{t("revenue_trend")}</div>
                    {revenueTrend.length > 1 ? (
                      <AreaChart data={revenueTrend} height={110} color="var(--g)" />
                    ) : <div style={{ fontSize: 10, color: "var(--t2)", textAlign: "center", padding: 20 }}>{t("no_data")}</div>}
                  </div>
                </div>

                {/* ── Period Comparison ── */}
                <div className="c" style={{ padding: "14px 18px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>{t("period_compare")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: t("total_weight"), curr: `${periodCompare.curr.weight.toFixed(1)} kg`, prev: `${periodCompare.prev.weight.toFixed(1)} kg`, growth: periodCompare.weightGrowth, color: "var(--b)" },
                      { label: t("total_value"), curr: rp(periodCompare.curr.value), prev: rp(periodCompare.prev.value), growth: periodCompare.valueGrowth, color: "var(--g)" },
                      { label: t("total_tx"), curr: periodCompare.curr.count, prev: periodCompare.prev.count, growth: periodCompare.prev.count > 0 ? Math.round(((periodCompare.curr.count - periodCompare.prev.count) / periodCompare.prev.count) * 100) : 0, color: "var(--c)" },
                    ].map(c => (
                      <div key={c.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--d)", color: c.color }}>{c.curr}</div>
                        <div style={{ fontSize: 8, color: "var(--t2)", marginBottom: 2 }}>{t("this_period")}</div>
                        <div style={{ fontSize: 10, fontFamily: "var(--m)", color: "var(--t2)" }}>{c.prev}</div>
                        <div style={{ fontSize: 8, color: "var(--t2)" }}>{t("prev_period")}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--m)", color: c.growth > 0 ? "var(--g)" : c.growth < 0 ? "var(--r)" : "var(--t2)", marginTop: 4 }}>
                          {c.growth > 0 ? "▲" : c.growth < 0 ? "▼" : "—"} {c.growth > 0 ? "+" : ""}{c.growth}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Environmental Impact */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                  {[
                    { icon: "🌿", value: `${envImpact.co2} kg`, label: t("co2_saved"), color: "var(--g)" },
                    { icon: "🌳", value: envImpact.trees, label: t("trees_saved"), color: "var(--c)" },
                    { icon: "💧", value: `${envImpact.water} L`, label: t("water_saved"), color: "var(--b)" },
                  ].map(s => (
                    <div key={s.label} className="c" style={{ padding: "12px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 18 }}>{s.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--d)", color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: "var(--t2)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── Carbon Credit Calculator ── */}
                <div className="c" style={{ padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)" }}>🏭 {t("carbon_credit")}</div>
                    <button className="bt" onClick={() => {
                      const canvas = document.createElement("canvas");
                      canvas.width = 600; canvas.height = 400;
                      const ctx = canvas.getContext("2d");
                      ctx.fillStyle = "#0D1117"; ctx.fillRect(0, 0, 600, 400);
                      ctx.strokeStyle = "#22C55E"; ctx.lineWidth = 2;
                      ctx.strokeRect(16, 16, 568, 368);
                      ctx.strokeRect(20, 20, 560, 360);
                      ctx.fillStyle = "#22C55E"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center";
                      ctx.fillText("EcoChain AI — Carbon Credit Certificate", 300, 60);
                      ctx.fillStyle = "#E2E8F0"; ctx.font = "16px sans-serif";
                      ctx.fillText(profile?.name || "User", 300, 110);
                      ctx.fillStyle = "#94A3B8"; ctx.font = "13px sans-serif";
                      ctx.fillText(`${lang === "id" ? "Total Daur Ulang" : "Total Recycled"}: ${carbonCredit.totalKg.toFixed(1)} kg`, 300, 150);
                      ctx.fillStyle = "#22C55E"; ctx.font = "bold 36px sans-serif";
                      ctx.fillText(`${carbonCredit.co2Tonnes} ${lang === "id" ? "Ton CO₂" : "Tonnes CO₂"}`, 300, 210);
                      ctx.fillStyle = "#94A3B8"; ctx.font = "14px sans-serif";
                      ctx.fillText(`≈ ${carbonCredit.credits} Carbon Credits`, 300, 245);
                      ctx.fillText(`${lang === "id" ? "Estimasi Nilai" : "Est. Value"}: ${rp(carbonCredit.creditValue)}`, 300, 275);
                      ctx.fillText(`🌳 ${carbonCredit.trees} ${lang === "id" ? "Pohon" : "Trees"} • ⚡ ${carbonCredit.energy} kWh`, 300, 305);
                      ctx.fillStyle = "#475569"; ctx.font = "11px sans-serif";
                      ctx.fillText(`${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })} • ecochain-ai-marketplace.sopian-hadianto.workers.dev`, 300, 360);
                      const link = document.createElement("a"); link.download = `ecochain-carbon-cert-${Date.now()}.png`; link.href = canvas.toDataURL(); link.click();
                    }} style={{ padding: "4px 10px", fontSize: 10, background: "rgba(34,197,94,.08)", color: "var(--g)", border: "1px solid rgba(34,197,94,.15)" }}>
                      📜 {t("download_cert")}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {[
                      { icon: "🏭", value: `${carbonCredit.co2Tonnes} ton`, label: t("carbon_offset"), color: "var(--g)" },
                      { icon: "💰", value: rp(carbonCredit.creditValue), label: t("carbon_credit"), color: "var(--y)" },
                      { icon: "🌳", value: carbonCredit.trees, label: t("trees_saved"), color: "var(--c)" },
                      { icon: "⚡", value: `${carbonCredit.energy} kWh`, label: lang === "id" ? "Energi Dihemat" : "Energy Saved", color: "var(--b)" },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "10px", textAlign: "center", background: "var(--bg2)", borderRadius: 8 }}>
                        <div style={{ fontSize: 16 }}>{s.icon}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--d)", color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: "var(--t2)" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gamification section */}
                <div className="c" style={{ padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)" }}>🏆 {t("points")}: <span style={{ color: "var(--y)", fontFamily: "var(--m)" }}>{myPoints}</span></div>
                    <button className="bt" onClick={shareAchievement} style={{ padding: "4px 10px", fontSize: 10, background: "rgba(34,197,94,.08)", color: "var(--g)", border: "1px solid rgba(34,197,94,.15)" }}>📤 {t("share")}</button>
                  </div>
                  {myBadges.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {myBadges.map(b => <Badge key={b.label} color="var(--y)" outline>{b.icon} {b.label}</Badge>)}
                    </div>
                  )}
                  {myBadges.length === 0 && <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10 }}>{lang === "id" ? "Setor sampah untuk mendapatkan badge!" : "Recycle waste to earn badges!"}</div>}
                  {/* Referral code */}
                  {profile?.referral_code && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg2)", borderRadius: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: "var(--t2)" }}>🎁 {t("referral_code")}:</span>
                      <span style={{ fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, color: "var(--g)" }}>{profile.referral_code}</span>
                      <button className="bt" onClick={() => { navigator.clipboard.writeText(profile.referral_code); flash(t("referral_copied")); }}
                        style={{ padding: "2px 8px", fontSize: 9, background: "rgba(34,197,94,.08)", color: "var(--g)", border: "1px solid rgba(34,197,94,.15)" }}>📋</button>
                    </div>
                  )}
                </div>

                {/* Smart Recommendations */}
                {recommendations.length > 0 && (
                  <div className="c" style={{ padding: "16px 20px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>💡 {t("recommend")} — {t("for_you")}</div>
                    {recommendations.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: i ? "1px solid var(--bdr)" : "none", fontSize: 11, alignItems: "center" }}>
                        <span style={{ fontSize: 16 }}>{r.icon}</span>
                        <span style={{ color: r.color }}>{r.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Predictive Analytics */}
                {predictions.monthlyData.length >= 2 && (
                  <div className="c" style={{ padding: "16px 20px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>📊 {t("predict")} & {t("trend")}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--d)", color: predictions.trend === "up" ? "var(--g)" : predictions.trend === "down" ? "var(--r)" : "var(--t2)" }}>
                          {predictions.trend === "up" ? "📈" : predictions.trend === "down" ? "📉" : "➡️"} {predictions.growth > 0 ? "+" : ""}{predictions.growth}%
                        </div>
                        <div style={{ fontSize: 9, color: "var(--t2)" }}>{t("trend")}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--d)", color: "var(--b)" }}>{predictions.nextMonth.weight} kg</div>
                        <div style={{ fontSize: 9, color: "var(--t2)" }}>{t("forecast")} {t("weight")}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--d)", color: "var(--g)" }}>{rp(predictions.nextMonth.value)}</div>
                        <div style={{ fontSize: 9, color: "var(--t2)" }}>{t("forecast")} {t("value")}</div>
                      </div>
                    </div>
                    <LineChart data={predictions.monthlyData.map(([m, d]) => ({ y: d.weight, label: m.slice(5) }))} color="var(--c)" height={80} />
                  </div>
                )}

                {/* Membership */}
                <div className="c" style={{ padding: "16px 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>⭐ {t("membership")}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { tier: "free", label: t("free_tier"), icon: "🆓", color: "var(--t2)", cost: 0 },
                      { tier: "silver", label: t("silver_tier"), icon: "🥈", color: "#94A3B8", cost: 500, benefit: lang === "id" ? "2x poin" : "2x points" },
                      { tier: "gold", label: t("gold_tier"), icon: "🥇", color: "var(--y)", cost: 2000, benefit: lang === "id" ? "3x poin + prioritas" : "3x points + priority" },
                    ].map(m => (
                      <div key={m.tier} className="c" style={{ flex: 1, padding: "10px", textAlign: "center", border: `2px solid ${profile.membership_tier === m.tier ? m.color : "var(--bdr)"}`, background: profile.membership_tier === m.tier ? `${m.color}10` : "transparent" }}>
                        <div style={{ fontSize: 20 }}>{m.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.label}</div>
                        {m.benefit && <div style={{ fontSize: 8, color: "var(--t2)", marginTop: 2 }}>{m.benefit}</div>}
                        {profile.membership_tier !== m.tier && m.cost > 0 && (
                          <button className="bt" onClick={() => upgradeMembership(m.tier)}
                            style={{ padding: "3px 8px", fontSize: 9, marginTop: 4, background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}30` }}>
                            {m.cost} pts
                          </button>
                        )}
                        {profile.membership_tier === m.tier && <div style={{ fontSize: 8, color: m.color, fontWeight: 700, marginTop: 2 }}>✓ {lang === "id" ? "Aktif" : "Active"}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leaderboard with Area Filter */}
                <div className="c" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)" }}>🏅 {t("leaderboard")}</div>
                    <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} style={{ fontSize: 10, padding: "3px 8px", width: "auto" }}>
                      <option value="all">{t("all_areas")}</option>
                      {dropPoints.map(dp => <option key={dp.id} value={dp.id}>📍 {dp.name}</option>)}
                    </select>
                  </div>
                  {areaLeaderboard.length === 0 && <div style={{ fontSize: 11, color: "var(--t2)" }}>{t("no_data")}</div>}
                  {areaLeaderboard.filter(u => (u.points || 0) > 0).slice(0, 10).map((u, i) => (
                    <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--bdr)", fontSize: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: i < 3 ? "var(--y)" : "var(--t2)", width: 20, textAlign: "center" }}>#{i + 1}</span>
                        <span style={{ color: "var(--w)", fontWeight: 600 }}>{u.name}</span>
                        <Badge color={roleColor[u.role]}>{roleIcon[u.role]}</Badge>
                        {u.membership_tier && u.membership_tier !== "free" && <Badge color={u.membership_tier === "gold" ? "var(--y)" : "#94A3B8"}>{u.membership_tier === "gold" ? "🥇" : "🥈"}</Badge>}
                      </div>
                      <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: "var(--y)" }}>{u.points || 0} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═── PRICES TAB ──═ */}
            {!loading && tab === "prices" && (
              <div className="fu">
                {/* DP selector for end users */}
                {(profile.role === "user") && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Pilih Drop Point untuk lihat harga:</label>
                    <select value={selectedDpForPrices || ""} onChange={e => setSelectedDpForPrices(e.target.value || null)}>
                      <option value="">-- Pilih Drop Point --</option>
                      {dropPoints.filter(d => d.bank_sampah_id).map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                    </select>
                  </div>
                )}

                <div style={{ display: "flex", gap: 4, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
                  {categories.map(c => (
                    <button key={c.code} className="bt" onClick={() => setCatFilter(c.code)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: catFilter === c.code ? `${c.accent}20` : "rgba(255,255,255,.02)", color: catFilter === c.code ? c.accent : "var(--t2)", border: `1px solid ${catFilter === c.code ? `${c.accent}30` : "var(--bdr)"}` }}>
                      {c.icon} {c.label} <span style={{ fontSize: 9, opacity: .6 }}>({effectivePrices.filter(p => p.category === c.code).length})</span>
                    </button>
                  ))}
                </div>

                {/* Price History Chart */}
                {priceHistory.length > 0 && (
                  <div className="c" style={{ padding: "14px 18px", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>📈 {t("price_history")}</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                      <select value={historyItem} onChange={e => setHistoryItem(e.target.value)} style={{ flex: 2, fontSize: 11 }}>
                        <option value="">{t("select_item")}</option>
                        {effectivePrices.map(p => <option key={p.item_code} value={p.item_code}>{p.item_code} — {p.name}</option>)}
                      </select>
                      {[30, 90].map(d => (
                        <button key={d} className="bt" onClick={() => setHistoryRange(d)}
                          style={{ padding: "4px 8px", fontSize: 10, background: historyRange === d ? "rgba(34,197,94,.1)" : "transparent", color: historyRange === d ? "var(--g)" : "var(--t2)", border: `1px solid ${historyRange === d ? "rgba(34,197,94,.25)" : "var(--bdr)"}` }}>
                          {d === 30 ? t("days_30") : t("days_90")}
                        </button>
                      ))}
                    </div>
                    {historyItem && (() => {
                      const cutoff = Date.now() - historyRange * 864e5;
                      const pts = priceHistory
                        .filter(h => h.item_code === historyItem && new Date(h.recorded_at).getTime() >= cutoff)
                        .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
                        .map(h => ({ y: Number(h.price), label: new Date(h.recorded_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) }));
                      return pts.length > 0 ? <LineChart data={pts} color="var(--g)" height={100} /> : <div style={{ fontSize: 11, color: "var(--t2)", padding: 8 }}>{t("no_data")}</div>;
                    })()}
                  </div>
                )}

                <div className="c" style={{ overflow: "hidden" }}>
                  {/* Header row — varies by role */}
                  {profile.role === "pelapak" && (
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", padding: "8px 16px", background: "rgba(255,255,255,.02)", fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)", fontWeight: 700, letterSpacing: .5 }}>
                      <span>ITEM</span>
                      <span style={{ textAlign: "right", color: "var(--p)" }}>🏭 HARGA</span>
                    </div>
                  )}
                  {profile.role === "bank" && (
                    <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr", padding: "8px 16px", background: "rgba(255,255,255,.02)", fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)", fontWeight: 700, letterSpacing: .5 }}>
                      <span>ITEM</span>
                      <span style={{ textAlign: "right", color: "var(--p)" }}>🏭 PELAPAK</span>
                      <span style={{ textAlign: "right", color: "var(--b)" }}>🏦 BANK</span>
                    </div>
                  )}
                  {profile.role === "dp" && (
                    <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr", padding: "8px 16px", background: "rgba(255,255,255,.02)", fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)", fontWeight: 700, letterSpacing: .5 }}>
                      <span>ITEM</span>
                      <span style={{ textAlign: "right", color: "var(--b)" }}>🏦 BANK</span>
                      <span style={{ textAlign: "right", color: "var(--y)" }}>📍 DP</span>
                    </div>
                  )}
                  {profile.role === "user" && (
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 0.3fr", padding: "8px 16px", background: "rgba(255,255,255,.02)", fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)", fontWeight: 700, letterSpacing: .5 }}>
                      <span>ITEM</span>
                      <span style={{ textAlign: "right", color: "var(--y)" }}>📍 HARGA</span>
                      <span style={{ textAlign: "center" }}>🔔</span>
                    </div>
                  )}
                  {/* Data rows */}
                  {filteredPrices.map((p, i) => (
                    <div key={p.item_code} style={{ display: "grid", gridTemplateColumns: profile.role === "pelapak" ? "3fr 1fr" : profile.role === "user" ? "3fr 1fr 0.3fr" : "2.5fr 1fr 1fr", padding: "8px 16px", borderTop: "1px solid var(--bdr)", fontSize: 11, alignItems: "center" }}>
                      <span><span style={{ fontFamily: "var(--m)", fontSize: 9, color: "var(--t2)", marginRight: 6 }}>{p.item_code}</span><span style={{ color: "var(--w)" }}>{p.name}</span>{p.unit !== "kg" && <span style={{ fontSize: 8, color: "var(--t2)", marginLeft: 4 }}>/{p.unit}</span>}{priceTrends[p.item_code]?.dir === "up" && <span style={{ fontSize: 8, color: "var(--g)", marginLeft: 4 }}>↑{priceTrends[p.item_code].pct}%</span>}{priceTrends[p.item_code]?.dir === "down" && <span style={{ fontSize: 8, color: "var(--r)", marginLeft: 4 }}>↓{Math.abs(priceTrends[p.item_code].pct)}%</span>}{(priceTrends[p.item_code]?.demand || 0) > 10 && <span style={{ fontSize: 7, background: "rgba(239,68,68,.1)", color: "var(--r)", padding: "1px 4px", borderRadius: 4, marginLeft: 4 }}>🔥</span>}</span>
                      {profile.role === "pelapak" && (
                        <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--p)" }}>{rp(p.pelapak_price)}</span>
                      )}
                      {profile.role === "bank" && (<>
                        <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--p)" }}>{rp(p.pelapak_price)}</span>
                        <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--b)" }}>{rp(p.bank_price)}</span>
                      </>)}
                      {profile.role === "dp" && (<>
                        <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--b)" }}>{rp(p.bank_price)}</span>
                        <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--y)" }}>{rp(p.dp_price)}</span>
                      </>)}
                      {profile.role === "user" && (<>
                        <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--y)" }}>{rp(p.dp_price || p.pelapak_price)}</span>
                        <button className="bt" onClick={() => toggleWatch(p.item_code)} style={{ padding: "2px 6px", fontSize: 9, background: watchedItems.includes(p.item_code) ? "rgba(245,158,11,.12)" : "rgba(255,255,255,.03)", color: watchedItems.includes(p.item_code) ? "var(--y)" : "var(--t2)", border: `1px solid ${watchedItems.includes(p.item_code) ? "rgba(245,158,11,.2)" : "var(--bdr)"}` }}>
                          {watchedItems.includes(p.item_code) ? "🔔" : "🔕"}
                        </button>
                      </>)}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: "var(--t2)", fontFamily: "var(--m)" }}>
                  {effectivePrices.length} items
                  {myEntity?.margin != null && ` • Margin: ${Math.round(Number(myEntity.margin) * 100)}%`}
                </div>
              </div>
            )}

            {/* ═── SCAN TAB ──═ */}
            {!loading && tab === "scan" && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>📷 Scan Sampah — AI Vision</h3>
                {!GEMINI_API_KEY && (
                  <div style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", color: "var(--y)", fontSize: 11, marginBottom: 12 }}>
                    ⚠️ Mode Demo — hubungkan Gemini API key untuk scan foto asli
                  </div>
                )}

                <div className="c" style={{ padding: 24, textAlign: "center" }}>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageCapture} style={{ display: "none" }} />
                  <button className="bt" onClick={() => fileInputRef.current?.click()} disabled={scanning}
                    style={{ padding: "18px 32px", fontSize: 15, fontWeight: 700, background: scanning ? "rgba(255,255,255,.04)" : "linear-gradient(135deg,#22C55E,#06B6D4)", color: scanning ? "var(--t2)" : "#fff", border: "none" }}>
                    {scanning ? "⏳ Menganalisis..." : "📷 Ambil Foto Sampah"}
                  </button>
                  <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 8 }}>Arahkan kamera ke tumpukan sampah</div>

                  {scanPhoto && (
                    <div style={{ marginTop: 16 }}>
                      <img src={scanPhoto} alt="Scan" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 12, border: "1px solid var(--bdr)" }} />
                    </div>
                  )}
                  {/* Multi-photo gallery */}
                  {scanPhotos.length > 1 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
                      {scanPhotos.map((photo, i) => (
                        <img key={i} src={photo} alt={`Scan ${i + 1}`} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: photo === scanPhoto ? "2px solid var(--g)" : "1px solid var(--bdr)", cursor: "pointer", opacity: photo === scanPhoto ? 1 : 0.6 }} onClick={() => setScanPhoto(photo)} />
                      ))}
                    </div>
                  )}
                </div>

                {scanResults && (
                  <div className="fu" style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--w)", fontFamily: "var(--d)" }}>🔍 {scanResults.label}</h4>
                      <Badge color="var(--c)">{scanResults.results.length} item</Badge>
                    </div>
                    {scanResults.results.length === 0 && (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--t2)" }}>Tidak terdeteksi sampah yang bisa didaur ulang.</div>
                    )}
                    {scanResults.results.map((r, i) => {
                      const p = effectivePrices.find(pr => pr.item_code === r.code);
                      const unitPrice = p?.dp_price || p?.pelapak_price || 0;
                      return (
                        <div key={i} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontWeight: 600, color: "var(--w)", fontSize: 12 }}>{r.item}</span>
                              <span style={{ fontFamily: "var(--m)", fontSize: 9, color: "var(--t2)", marginLeft: 8 }}>{r.code}</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "var(--m)", fontWeight: 700, color: "var(--g)", fontSize: 13 }}>{p ? rp(unitPrice * r.weight) : "-"}</div>
                              <div style={{ fontSize: 9, color: "var(--t2)" }}>{r.weight} kg × {p ? rp(unitPrice) : "?"}/{p?.unit || "kg"}</div>
                            </div>
                          </div>
                          {r.tip && <div style={{ fontSize: 10, color: "var(--y)", marginTop: 4 }}>{r.tip}</div>}
                          {/* V2: Confidence & alternatives */}
                          <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                            <span style={{ fontSize: 8, color: "var(--c)", fontFamily: "var(--m)" }}>{t("confidence")}: {r.confidence || Math.floor(75 + Math.random() * 20)}%</span>
                            {priceTrends[r.code]?.dir === "up" && <Badge color="var(--g)">↑ {t("trending_up")}</Badge>}
                          </div>
                        </div>
                      );
                    })}
                    {scanResults.results.length > 0 && (
                      <div className="c" style={{ padding: "14px 18px", marginTop: 8, background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.15)" }}>
                        <div style={{ fontSize: 10, color: "var(--t2)" }}>Estimasi Total</div>
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--d)", color: "var(--g)" }}>
                          {rp(scanResults.results.reduce((sum, r) => {
                            const p = effectivePrices.find(pr => pr.item_code === r.code);
                            return sum + (p?.dp_price || p?.pelapak_price || 0) * r.weight;
                          }, 0))}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>
                          Total berat: {scanResults.results.reduce((s, r) => s + r.weight, 0).toFixed(1)} kg
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═── CHAT AI TAB ──═ */}
            {!loading && tab === "chat" && (
              <div className="fu" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 240px)", minHeight: 400 }}>
                {/* Chat header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>🤖 EcoChain Assistant</h3>
                  <Badge color={GROQ_API_KEY ? "var(--g)" : "var(--y)"}>{GROQ_API_KEY ? "● Online" : "◌ Demo"}</Badge>
                </div>

                {/* Chat messages */}
                <div className="c" style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {aiChat.length === 0 && (
                    <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--t2)" }}>
                      <div style={{ fontSize: 30, marginBottom: 8 }}>🤖</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--w)", marginBottom: 4 }}>Halo! Saya EcoChain Assistant</div>
                      <div style={{ fontSize: 11 }}>Tanya harga sampah, lokasi drop point, tips sorting, atau apa saja tentang daur ulang!</div>
                    </div>
                  )}
                  {aiChat.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                      padding: "10px 14px",
                      borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: msg.role === "user" ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.04)",
                      border: `1px solid ${msg.role === "user" ? "rgba(34,197,94,.2)" : "var(--bdr)"}`,
                      color: "var(--w)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
                    }}>
                      {msg.text}
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: "rgba(255,255,255,.04)", border: "1px solid var(--bdr)", color: "var(--t2)", fontSize: 12 }}>
                      <span style={{ animation: "blink .8s infinite" }}>●</span> Mengetik...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick actions */}
                {aiChat.length === 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {[
                      "Harga sampah terkini?",
                      "Drop point terdekat?",
                      "Tips sorting botol plastik",
                      "Cara jual minyak jelantah?",
                    ].map(q => (
                      <button key={q} className="bt" onClick={() => sendChat(q)}
                        style={{ padding: "6px 12px", fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,.03)", color: "var(--t)", border: "1px solid var(--bdr)" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* FAQ Section */}
                <div style={{ marginTop: 10 }}>
                  <button className="bt" onClick={() => setShowFaq(!showFaq)}
                    style={{ padding: "6px 12px", fontSize: 10, fontWeight: 600, background: showFaq ? "rgba(6,182,212,.1)" : "rgba(255,255,255,.03)", color: showFaq ? "var(--c)" : "var(--t2)", border: `1px solid ${showFaq ? "rgba(6,182,212,.25)" : "var(--bdr)"}` }}>
                    ❓ {t("faq")} ({t("common_questions")})
                  </button>
                  {showFaq && (
                    <div style={{ marginTop: 8, animation: "fu .3s ease" }}>
                      {FAQ_DATA.map((faq, i) => (
                        <div key={i} className="c" style={{ padding: "10px 14px", marginBottom: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", marginBottom: 4, cursor: "pointer" }} onClick={() => sendChat(faq.q)}>💬 {faq.q}</div>
                          <div style={{ fontSize: 10, color: "var(--t2)", whiteSpace: "pre-line" }}>{faq.a}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chat input */}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder="Tanya tentang sampah, harga, lokasi..."
                    disabled={chatLoading}
                    style={{ flex: 1, opacity: chatLoading ? .5 : 1 }} />
                  <button className="bt" onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
                    style={{ padding: "10px 18px", background: chatInput.trim() && !chatLoading ? "linear-gradient(135deg,#22C55E,#16A34A)" : "rgba(255,255,255,.04)", color: chatInput.trim() && !chatLoading ? "#fff" : "var(--t2)", fontWeight: 700, fontSize: 13, border: "none" }}>
                    Kirim
                  </button>
                </div>
              </div>
            )}

            {/* ═── MAP TAB ──═ */}
            {!loading && tab === "map" && (
              <div className="fu">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>🗺️ {t("map")} — {t("network")}</h3>
                  <button className="bt" onClick={() => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } setShowHeatmap(h => !h); }}
                    style={{ padding: "4px 10px", fontSize: 10, background: showHeatmap ? "rgba(34,197,94,.1)" : "transparent", color: showHeatmap ? "var(--g)" : "var(--t2)", border: `1px solid ${showHeatmap ? "rgba(34,197,94,.25)" : "var(--bdr)"}` }}>
                    🔥 {t("heatmap")} {showHeatmap ? "ON" : "OFF"}
                  </button>
                </div>
                {/* Leaflet map container */}
                <div ref={mapRef} className="c" style={{ height: 350, borderRadius: 14, overflow: "hidden", marginBottom: 14 }} />

                {/* Route Optimization - Nearest DPs */}
                {dpDistances.length > 0 && (
                  <div className="c" style={{ padding: "12px 16px", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>🧭 {t("route")} — {t("nearest_dp")}</div>
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                      {dpDistances.slice(0, 5).map((dp, i) => (
                        <div key={dp.id} style={{ minWidth: 120, padding: "8px 10px", borderRadius: 10, background: i === 0 ? "rgba(34,197,94,.08)" : "rgba(255,255,255,.02)", border: `1px solid ${i === 0 ? "rgba(34,197,94,.2)" : "var(--bdr)"}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? "var(--g)" : "var(--w)" }}>{dp.name}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--m)", color: i === 0 ? "var(--g)" : "var(--c)" }}>{dp.dist} km</div>
                          <div style={{ fontSize: 8, color: "var(--t2)" }}>{dp.address?.slice(0, 30)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card listing below map */}
                <h4 style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--d)", color: "var(--y)", marginBottom: 8 }}>📍 Drop Points ({dropPoints.length})</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginBottom: 18 }}>
                  {dropPoints.map((dp, i) => (
                    <div key={dp.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <Badge color={dp.status === "active" ? "var(--g)" : "var(--r)"}>{dp.status === "active" ? "● AKTIF" : "NONAKTIF"}</Badge>
                        <span style={{ fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)" }}>{dp.id}</span>
                      </div>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--w)", fontFamily: "var(--d)" }}>{dp.name}</h4>
                      <div style={{ fontSize: 10, color: "var(--t2)" }}>{dp.address}</div>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>👤 {dp.operator_name || "-"} • Stok: {Number(dp.current_stock_kg).toFixed(0)}/{Number(dp.capacity_kg).toFixed(0)} kg</div>
                      {dp.bank_sampah_id && <div style={{ fontSize: 9, color: "var(--b)", marginTop: 2 }}>🏦 {bankSampah.find(b => b.id === dp.bank_sampah_id)?.name || "?"}</div>}
                      {dpRatings[dp.id] && <div style={{ fontSize: 9, color: "var(--y)", marginTop: 2 }}>⭐ {dpRatings[dp.id].avg} ({dpRatings[dp.id].count} {t("review")})</div>}
                    </div>
                  ))}
                </div>

                <h4 style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--d)", color: "var(--b)", marginBottom: 8 }}>🏦 Bank Sampah ({bankSampah.length})</h4>
                {bankSampah.map((bs, i) => (
                  <div key={bs.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", marginBottom: 6 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--w)", fontFamily: "var(--d)" }}>{bs.name} {bs.rating && <Badge color="var(--y)">⭐ {bs.rating}</Badge>}</h4>
                    <div style={{ fontSize: 10, color: "var(--t2)" }}>{bs.address} • ⏰ {bs.operating_hours || "-"}</div>
                    {bs.pelapak_id && <div style={{ fontSize: 9, color: "var(--p)", marginTop: 2 }}>🏭 {pelapakList.find(pl => pl.id === bs.pelapak_id)?.name || "?"} • {t("margin")}: {Math.round(Number(bs.margin) * 100)}%</div>}
                  </div>
                ))}
              </div>
            )}

            {/* ═── TRANSACTIONS TAB ──═ */}
            {!loading && tab === "tx" && (
              <div className="fu">
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>📋 {t("tx")} ({transactions.length})</h3>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {["all", "pending", "pickup", "done", "cancelled"].map(s => (
                      <button key={s} className="bt" onClick={() => setTxStatusFilter(s)}
                        style={{ padding: "4px 10px", fontSize: 10, fontWeight: 600, background: txStatusFilter === s ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.02)", color: txStatusFilter === s ? "var(--g)" : "var(--t2)", border: `1px solid ${txStatusFilter === s ? "rgba(34,197,94,.25)" : "var(--bdr)"}` }}>
                        {s === "all" ? (lang === "id" ? "Semua" : "All") : t(s === "pickup" ? "pickup_s" : s)}
                      </button>
                    ))}
                    <button className="bt" onClick={loadData} style={{ padding: "4px 10px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 10, border: "1px solid var(--bdr)" }}>🔄</button>
                  </div>
                </div>
                {filteredTx.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--t2)" }}>{t("no_data")}</div>}
                {filteredTx.map((tx, i) => {
                  const items = txItems.filter(ti => ti.transaction_id === tx.id);
                  const total = getTxTotal(tx.id);
                  const isExpanded = expandedTx === tx.id;
                  const statusColor = { pending: "var(--y)", pickup: "var(--c)", done: "var(--g)", cancelled: "var(--r)" };
                  const statusLabel = { pending: `⏳ ${t("pending")}`, pickup: `🚛 ${t("pickup_s")}`, done: `✓ ${t("done")}`, cancelled: `✕ ${t("cancelled")}` };
                  return (
                    <div key={tx.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", marginBottom: 6, cursor: "pointer" }} onClick={() => setExpandedTx(isExpanded ? null : tx.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "var(--m)", fontSize: 11, fontWeight: 600, color: "var(--w)" }}>{tx.id}</span>
                          <Badge color={statusColor[tx.status] || "var(--t2)"}>{statusLabel[tx.status] || tx.status}</Badge>
                        </div>
                        <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: roleColor[profile.role], fontSize: 13 }}>{rp(total)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 3 }}>
                        👤 {tx.user_name} → 📍 {tx.drop_point_id} • {new Date(tx.created_at).toLocaleDateString("id-ID")}
                      </div>
                      {!isExpanded && items.length > 0 && (
                        <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>
                          {items.map(it => `${it.waste_name} (${Number(it.weight_kg).toFixed(1)}kg)`).join(" + ")}
                        </div>
                      )}
                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--bdr)", animation: "fu .3s ease" }}>
                          {/* Status timeline */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                            {["pending", "pickup", "done"].map((st, si) => {
                              const reached = st === "pending" || (st === "pickup" && ["pickup", "done"].includes(tx.status)) || (st === "done" && tx.status === "done");
                              const isCancelled = tx.status === "cancelled";
                              return (
                                <React.Fragment key={st}>
                                  {si > 0 && <div style={{ flex: 1, height: 2, background: reached && !isCancelled ? "var(--g)" : "var(--bdr)" }} />}
                                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, background: reached && !isCancelled ? `${statusColor[st]}20` : "rgba(255,255,255,.03)", color: reached && !isCancelled ? statusColor[st] : "var(--t2)", border: `2px solid ${reached && !isCancelled ? statusColor[st] : "var(--bdr)"}` }}>
                                    {si + 1}
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--t2)", fontFamily: "var(--m)", marginBottom: 12, marginTop: -8, paddingLeft: 2, paddingRight: 2 }}>
                            <span>{t("pending")}</span><span>{t("pickup_s")}</span><span>{t("done")}</span>
                          </div>
                          {/* Item detail table */}
                          {items.map(it => {
                            const p = effectivePrices.find(pr => pr.item_code === it.waste_code);
                            const price = p?.dp_price || p?.pelapak_price || 0;
                            return (
                              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--bdr)", fontSize: 10 }}>
                                <span style={{ color: "var(--t)" }}>{it.waste_name} <span style={{ color: "var(--t2)", fontFamily: "var(--m)" }}>({Number(it.weight_kg).toFixed(1)}kg)</span></span>
                                <span style={{ fontFamily: "var(--m)", fontWeight: 600, color: "var(--g)" }}>{rp(price * Number(it.weight_kg))}</span>
                              </div>
                            );
                          })}
                          {/* QR code */}
                          <div style={{ textAlign: "center", marginTop: 12 }}>
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(tx.id)}&bgcolor=${theme === "light" ? "F8FAFC" : "131B2B"}&color=${theme === "light" ? "0F172A" : "F1F5F9"}`} alt="QR" style={{ borderRadius: 8 }} width={120} height={120} />
                            <div style={{ fontSize: 9, color: "var(--t2)", fontFamily: "var(--m)", marginTop: 4 }}>{tx.id}</div>
                          </div>
                          {/* Action buttons */}
                          {["dp", "bank"].includes(profile.role) && tx.status !== "done" && tx.status !== "cancelled" && (
                            <div style={{ marginTop: 10, display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                              {tx.status === "pending" && (
                                <button className="bt" onClick={() => updateTxStatus(tx.id, "pickup")} style={{ padding: "6px 14px", background: "rgba(6,182,212,.12)", color: "var(--c)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(6,182,212,.2)" }}>🚛 {t("pickup_s")}</button>
                              )}
                              {(tx.status === "pending" || tx.status === "pickup") && (
                                <button className="bt" onClick={() => updateTxStatus(tx.id, "done")} style={{ padding: "6px 14px", background: "rgba(34,197,94,.12)", color: "var(--g)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(34,197,94,.2)" }}>✓ {t("done")}</button>
                              )}
                              <button className="bt" onClick={() => updateTxStatus(tx.id, "cancelled")} style={{ padding: "6px 14px", background: "rgba(239,68,68,.08)", color: "var(--r)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(239,68,68,.15)" }}>✕ {t("cancelled")}</button>
                            </div>
                          )}
                          {/* Print + Rate buttons for done TX */}
                          {tx.status === "done" && (
                            <div style={{ marginTop: 10, display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                              <button className="bt" onClick={() => printInvoice(tx.id)} style={{ padding: "6px 14px", background: "rgba(59,130,246,.08)", color: "var(--b)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(59,130,246,.15)" }}>🖨️ {t("print_invoice")}</button>
                              {profile.role === "user" && !reviews.find(r => r.transaction_id === tx.id) && (
                                <button className="bt" onClick={() => { setReviewForm({ txId: tx.id, rating: 0, comment: "" }); setShowReviewModal(true); }} style={{ padding: "6px 14px", background: "rgba(245,158,11,.08)", color: "var(--y)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(245,158,11,.15)" }}>⭐ {t("rate")}</button>
                              )}
                              {reviews.find(r => r.transaction_id === tx.id) && (
                                <Badge color="var(--y)">⭐ {reviews.find(r => r.transaction_id === tx.id)?.rating}/5</Badge>
                              )}
                              {/* Dispute button */}
                              {!disputes.find(d => d.transaction_id === tx.id) && (
                                <button className="bt" onClick={() => { setDisputeForm({ txId: tx.id, reason: "" }); setShowDisputeModal(true); }}
                                  style={{ padding: "6px 14px", background: "rgba(239,68,68,.08)", color: "var(--r)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(239,68,68,.15)" }}>⚠️ {t("dispute")}</button>
                              )}
                              {disputes.find(d => d.transaction_id === tx.id) && (
                                <Badge color={disputes.find(d => d.transaction_id === tx.id)?.status === "resolved" ? "var(--g)" : "var(--y)"}>{disputes.find(d => d.transaction_id === tx.id)?.status === "resolved" ? "✓" : "⏳"} {t("dispute")}</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═── NEW TX TAB ──═ */}
            {!loading && tab === "newtx" && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>➕ Buat Transaksi Baru</h3>
                <div className="c" style={{ padding: 22 }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Drop Point</label>
                    <select value={txForm.dp} onChange={e => setTxForm(f => ({ ...f, dp: e.target.value }))}>
                      <option value="">Pilih Drop Point</option>
                      {dropPoints.map(dp => <option key={dp.id} value={dp.id}>{dp.name} ({dp.id})</option>)}
                    </select>
                  </div>

                  <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 6, display: "block" }}>Items</label>
                  {txForm.items.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <select value={item.code} onChange={e => { const items = [...txForm.items]; items[idx].code = e.target.value; setTxForm(f => ({ ...f, items })); }} style={{ flex: 2 }}>
                        <option value="">Pilih item</option>
                        {txFormPrices.map(p => <option key={p.item_code} value={p.item_code}>{p.item_code} — {p.name} ({rp(p.dp_price || p.pelapak_price)}/{p.unit})</option>)}
                      </select>
                      <input type="number" step="0.1" min="0.1" placeholder="Berat (kg)" value={item.weight}
                        onChange={e => { const items = [...txForm.items]; items[idx].weight = e.target.value; setTxForm(f => ({ ...f, items })); }}
                        style={{ flex: 1 }} />
                      {txForm.items.length > 1 && (
                        <button className="bt" onClick={() => setTxForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                          style={{ padding: "8px 12px", background: "rgba(239,68,68,.08)", color: "var(--r)", fontSize: 12, border: "1px solid rgba(239,68,68,.15)" }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button className="bt" onClick={() => setTxForm(f => ({ ...f, items: [...f.items, { code: "", weight: "" }] }))}
                    style={{ padding: "8px 14px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 11, border: "1px solid var(--bdr)", marginBottom: 16 }}>+ Tambah Item</button>

                  {/* Preview total */}
                  {txForm.items.some(i => i.code && i.weight) && (
                    <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.15)", marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: "var(--t2)" }}>Estimasi Total (level DP)</div>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--d)", color: "var(--g)" }}>
                        {rp(txForm.items.reduce((s, it) => {
                          const p = txFormPrices.find(pr => pr.item_code === it.code);
                          return s + (p?.dp_price || p?.pelapak_price || 0) * (parseFloat(it.weight) || 0);
                        }, 0))}
                      </div>
                    </div>
                  )}

                  {/* Photo evidence */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>📸 {lang === "id" ? "Foto Bukti (opsional)" : "Photo Evidence (optional)"}</label>
                    <input ref={txPhotoRef} type="file" accept="image/*" capture="environment" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) { const { preview } = await resizeAndEncode(file); setTxPhoto(preview); }
                      e.target.value = "";
                    }} style={{ display: "none" }} />
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="bt" type="button" onClick={() => txPhotoRef.current?.click()}
                        style={{ padding: "8px 14px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 11, border: "1px solid var(--bdr)" }}>
                        📷 {lang === "id" ? "Ambil Foto" : "Take Photo"}
                      </button>
                      {txPhoto && <img src={txPhoto} alt="preview" style={{ height: 40, borderRadius: 6, border: "1px solid var(--bdr)" }} />}
                      {txPhoto && <button className="bt" onClick={() => setTxPhoto(null)} style={{ padding: "4px 8px", background: "rgba(239,68,68,.08)", color: "var(--r)", fontSize: 10, border: "1px solid rgba(239,68,68,.15)" }}>✕</button>}
                    </div>
                  </div>

                  <button className="bt" onClick={submitTx}
                    style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                    ✅ {t("create_tx")}
                  </button>
                </div>
              </div>
            )}

            {/* ═── KELOLA HARGA TAB (Pelapak) ──═ */}
            {!loading && tab === "kelola" && profile.role === "pelapak" && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>📦 Kelola Harga Pelapak</h3>

                {/* Manual entry form */}
                <div className="c" style={{ padding: 22, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>Tambah / Update Harga Item</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8, marginBottom: 8 }}>
                    <input placeholder="Kode (cth: 1.1)" value={priceForm.item_code} onChange={e => setPriceForm(f => ({ ...f, item_code: e.target.value }))} />
                    <input placeholder="Nama Item" value={priceForm.item_name} onChange={e => setPriceForm(f => ({ ...f, item_name: e.target.value }))} />
                    <select value={priceForm.category} onChange={e => setPriceForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">Kategori</option>
                      {categories.map(c => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8, marginBottom: 10 }}>
                    <input placeholder="Unit" value={priceForm.unit} onChange={e => setPriceForm(f => ({ ...f, unit: e.target.value }))} />
                    <input type="number" placeholder="Harga per kg (Rp)" value={priceForm.price_per_kg} onChange={e => setPriceForm(f => ({ ...f, price_per_kg: e.target.value }))} />
                    <button className="bt" onClick={addPelapakPrice} style={{ padding: "10px 14px", background: "linear-gradient(135deg,#A855F7,#7C3AED)", color: "#fff", fontWeight: 700, fontSize: 12, border: "none" }}>+ Simpan</button>
                  </div>
                </div>

                {/* CSV Upload */}
                <div className="c" style={{ padding: 18, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)" }}>Upload CSV</div>
                      <div style={{ fontSize: 9, color: "var(--t2)", fontFamily: "var(--m)", marginTop: 2 }}>Format: item_code, item_name, category, unit, price_per_kg</div>
                    </div>
                    <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleCsvUpload} style={{ display: "none" }} />
                    <button className="bt" onClick={() => csvInputRef.current?.click()} disabled={csvUploading}
                      style={{ padding: "8px 18px", background: csvUploading ? "rgba(255,255,255,.04)" : "rgba(168,85,247,.12)", color: csvUploading ? "var(--t2)" : "var(--p)", fontWeight: 600, fontSize: 11, border: "1px solid rgba(168,85,247,.2)" }}>
                      {csvUploading ? "⏳ Uploading..." : "📤 Pilih File CSV"}
                    </button>
                  </div>
                </div>

                {/* Current price list */}
                <div className="c" style={{ overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "0.5fr 2fr 1fr 1fr 0.5fr", padding: "8px 16px", background: "rgba(255,255,255,.02)", fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)", fontWeight: 700, letterSpacing: .5 }}>
                    <span>KODE</span><span>NAMA</span><span>KATEGORI</span><span style={{ textAlign: "right" }}>HARGA</span><span></span>
                  </div>
                  {effectivePrices.map(p => (
                    <div key={p.id || p.item_code} style={{ display: "grid", gridTemplateColumns: "0.5fr 2fr 1fr 1fr 0.5fr", padding: "8px 16px", borderTop: "1px solid var(--bdr)", fontSize: 11, alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--m)", fontSize: 9, color: "var(--t2)" }}>{p.item_code}</span>
                      <span style={{ color: "var(--w)" }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: "var(--t2)" }}>{p.category}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--p)" }}>{rp(p.pelapak_price)}/{p.unit}</span>
                      <button className="bt" onClick={() => deletePelapakPrice(p.id)} style={{ padding: "4px 8px", background: "rgba(239,68,68,.08)", color: "var(--r)", fontSize: 9, fontWeight: 600, border: "1px solid rgba(239,68,68,.15)" }}>Hapus</button>
                    </div>
                  ))}
                  {effectivePrices.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--t2)", fontSize: 12 }}>Belum ada harga. Tambah item atau upload CSV.</div>}
                </div>
              </div>
            )}

            {/* ═── SETTINGS TAB (Bank Sampah & Drop Point) ──═ */}
            {!loading && tab === "settings" && ["bank", "dp"].includes(profile.role) && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>⚙️ Pengaturan {profile.role === "bank" ? "Bank Sampah" : "Drop Point"}</h3>

                {!myEntity && (
                  <div className="c" style={{ padding: 20, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--r)", marginBottom: 4 }}>Akun belum terhubung</div>
                    <div style={{ fontSize: 11, color: "var(--t2)" }}>
                      Akun Anda belum terhubung dengan {profile.role === "bank" ? "Bank Sampah" : "Drop Point"} manapun. Hubungi admin untuk menghubungkan akun Anda.
                    </div>
                  </div>
                )}

                {myEntity && profile.role === "bank" && (
                  <div className="c" style={{ padding: 22 }}>
                    {/* Pelapak selector */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Pilih Pelapak Sumber</label>
                      <select value={myEntity.pelapak_id || ""} onChange={e => updateBankPelapak(e.target.value)}>
                        <option value="">-- Pilih Pelapak --</option>
                        {pelapakList.map(pl => <option key={pl.id} value={pl.id}>{pl.name} ({pl.email})</option>)}
                      </select>
                    </div>

                    {/* Margin slider */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: "var(--t2)" }}>Margin Bank Sampah</span>
                        <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: "var(--b)" }}>{Math.round(Number(myEntity.margin) * 100)}%</span>
                      </div>
                      <input type="range" min={0} max={50}
                        value={Math.round(Number(myEntity.margin) * 100)}
                        onChange={e => updateMyMargin(parseInt(e.target.value) / 100)}
                        style={{ accentColor: "var(--b)" }} />
                    </div>

                    {/* Price preview */}
                    {myEntity.pelapak_id && effectivePrices.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>Preview Harga ({effectivePrices.length} item)</div>
                        <div style={{ maxHeight: 200, overflow: "auto" }}>
                          {effectivePrices.slice(0, 15).map(p => (
                            <div key={p.item_code} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--bdr)", fontSize: 10 }}>
                              <span style={{ color: "var(--t)" }}>{p.name}</span>
                              <span style={{ fontFamily: "var(--m)" }}>
                                <span style={{ color: "var(--p)" }}>{rp(p.pelapak_price)}</span>
                                <span style={{ color: "var(--t2)", margin: "0 4px" }}>→</span>
                                <span style={{ color: "var(--b)", fontWeight: 600 }}>{rp(p.bank_price)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {myEntity.pelapak_id && effectivePrices.length === 0 && (
                      <div style={{ padding: 14, textAlign: "center", color: "var(--t2)", fontSize: 11 }}>Pelapak belum menginput harga.</div>
                    )}
                  </div>
                )}

                {myEntity && profile.role === "dp" && (
                  <div className="c" style={{ padding: 22 }}>
                    {/* Bank Sampah selector */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>Pilih Bank Sampah</label>
                      <select value={myEntity.bank_sampah_id || ""} onChange={e => updateDpBank(e.target.value)}>
                        <option value="">-- Pilih Bank Sampah --</option>
                        {bankSampah.filter(bs => bs.pelapak_id).map(bs => <option key={bs.id} value={bs.id}>{bs.name}</option>)}
                      </select>
                    </div>

                    {/* Margin slider */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: "var(--t2)" }}>Margin Drop Point</span>
                        <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: "var(--y)" }}>{Math.round(Number(myEntity.margin) * 100)}%</span>
                      </div>
                      <input type="range" min={0} max={50}
                        value={Math.round(Number(myEntity.margin) * 100)}
                        onChange={e => updateMyMargin(parseInt(e.target.value) / 100)}
                        style={{ accentColor: "var(--y)" }} />
                    </div>

                    {/* Price preview */}
                    {myEntity.bank_sampah_id && effectivePrices.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>Preview Harga ({effectivePrices.length} item)</div>
                        <div style={{ maxHeight: 200, overflow: "auto" }}>
                          {effectivePrices.slice(0, 15).map(p => (
                            <div key={p.item_code} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--bdr)", fontSize: 10 }}>
                              <span style={{ color: "var(--t)" }}>{p.name}</span>
                              <span style={{ fontFamily: "var(--m)" }}>
                                <span style={{ color: "var(--b)" }}>{rp(p.bank_price)}</span>
                                <span style={{ color: "var(--t2)", margin: "0 4px" }}>→</span>
                                <span style={{ color: "var(--y)", fontWeight: 600 }}>{rp(p.dp_price)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {myEntity.bank_sampah_id && effectivePrices.length === 0 && (
                      <div style={{ padding: 14, textAlign: "center", color: "var(--t2)", fontSize: 11 }}>Bank Sampah belum terhubung ke Pelapak atau Pelapak belum menginput harga.</div>
                    )}
                  </div>
                )}

                {/* Inventory Management */}
                {myEntity && inventoryStats && (
                  <div className="c" style={{ padding: 22, marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)" }}>📦 {t("inventory")}</div>
                      <Badge color={inventoryStats.utilization > 80 ? "var(--r)" : inventoryStats.utilization > 50 ? "var(--y)" : "var(--g)"}>
                        {inventoryStats.utilization}% {t("stock_level")}
                      </Badge>
                    </div>
                    {/* Capacity bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--t2)", marginBottom: 4 }}>
                        <span>{inventoryStats.stock.toFixed(0)} kg</span>
                        <span>{inventoryStats.capacity} kg</span>
                      </div>
                      <div style={{ height: 8, background: "var(--bg2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${inventoryStats.utilization}%`, borderRadius: 4, background: inventoryStats.utilization > 80 ? "var(--r)" : inventoryStats.utilization > 50 ? "var(--y)" : "var(--g)", transition: "width .3s" }} />
                      </div>
                      {inventoryStats.utilization > 80 && <div style={{ fontSize: 9, color: "var(--r)", marginTop: 4 }}>⚠️ {t("low_stock")} — {lang === "id" ? "Kapasitas hampir penuh!" : "Approaching capacity!"}</div>}
                    </div>
                    {/* Category breakdown */}
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t2)", marginBottom: 6 }}>{lang === "id" ? "Breakdown Kategori" : "Category Breakdown"}</div>
                    {inventoryStats.categories.slice(0, 8).map((cat, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderTop: i ? "1px solid var(--bdr)" : "none", fontSize: 10 }}>
                        <span style={{ color: "var(--t)" }}>{cat.name}</span>
                        <span style={{ fontFamily: "var(--m)", color: "var(--b)" }}>{cat.weight.toFixed(1)} kg <span style={{ color: "var(--t2)" }}>({cat.count} TX)</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═── PICKUP TAB ──═ */}
            {!loading && tab === "pickup" && (
              <div className="fu">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>🚛 {t("pickup")}</h3>
                  {profile.role === "user" && (
                    <button className="bt" onClick={() => setPickupTab(pickupTab === "request" ? "list" : "request")}
                      style={{ padding: "4px 10px", fontSize: 10, background: pickupTab === "request" ? "rgba(34,197,94,.1)" : "transparent", color: pickupTab === "request" ? "var(--g)" : "var(--t2)", border: `1px solid ${pickupTab === "request" ? "rgba(34,197,94,.25)" : "var(--bdr)"}` }}>
                      {pickupTab === "request" ? `📋 ${lang === "id" ? "Lihat Daftar" : "View List"}` : `➕ ${t("request_pickup")}`}
                    </button>
                  )}
                </div>

                {/* User request pickup form */}
                {profile.role === "user" && pickupTab === "request" && (
                  <div className="c" style={{ padding: 18, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>📋 {t("request_pickup")}</div>
                    <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                      <select value={pickupForm.dp} onChange={e => setPickupForm(f => ({ ...f, dp: e.target.value }))}>
                        <option value="">{t("select_dp")}</option>
                        {dropPoints.map(dp => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
                      </select>
                      <input placeholder={t("pickup_address")} value={pickupForm.address} onChange={e => setPickupForm(f => ({ ...f, address: e.target.value }))} />
                      <input type="number" step="0.1" placeholder={t("estimated_weight") + " (kg)"} value={pickupForm.estimated_kg} onChange={e => setPickupForm(f => ({ ...f, estimated_kg: e.target.value }))} />
                      <input placeholder={lang === "id" ? "Catatan (opsional)" : "Notes (optional)"} value={pickupForm.notes} onChange={e => setPickupForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <button className="bt" onClick={requestPickup} style={{ width: "100%", padding: 12, background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 12 }}>🚛 {t("request_pickup")}</button>
                  </div>
                )}

                {/* Pickup list */}
                {pickups.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--t2)" }}>{t("no_data")}</div>}
                {pickups.map((pk, i) => {
                  const dp = dropPoints.find(d => d.id === pk.drop_point_id);
                  const bs = bankSampah.find(b => b.id === pk.bank_sampah_id);
                  const statusColors = { requested: "var(--y)", scheduled: "var(--c)", in_progress: "var(--b)", completed: "var(--g)", cancelled: "var(--r)" };
                  return (
                    <div key={pk.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <Badge color={statusColors[pk.status] || "var(--t2)"}>{(pk.status || "scheduled").toUpperCase()}</Badge>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginLeft: 8 }}>{new Date(pk.pickup_date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
                          {pk.pickup_time && <span style={{ fontSize: 10, color: "var(--t2)", marginLeft: 4 }}>{pk.pickup_time}</span>}
                        </div>
                        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--t2)" }}>{pk.estimated_kg ? `~${pk.estimated_kg}kg` : ""}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 3 }}>
                        {bs ? `🏦 ${bs.name} → ` : ""}{dp ? `📍 ${dp.name}` : pk.drop_point_id}
                        {pk.address && <span style={{ marginLeft: 6 }}>📍 {pk.address}</span>}
                        {pk.notes && <span style={{ marginLeft: 6, fontStyle: "italic" }}>• {pk.notes}</span>}
                      </div>
                      {/* Operator actions */}
                      {["dp", "bank"].includes(profile.role) && !["completed", "cancelled"].includes(pk.status) && (
                        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                          {pk.status === "requested" && <button className="bt" onClick={() => updatePickupStatus(pk.id, "scheduled")} style={{ padding: "4px 10px", fontSize: 10, background: "rgba(6,182,212,.08)", color: "var(--c)", border: "1px solid rgba(6,182,212,.15)" }}>📅 {t("schedule_pickup")}</button>}
                          {pk.status === "scheduled" && <button className="bt" onClick={() => updatePickupStatus(pk.id, "in_progress")} style={{ padding: "4px 10px", fontSize: 10, background: "rgba(59,130,246,.08)", color: "var(--b)", border: "1px solid rgba(59,130,246,.15)" }}>🚛 {t("start_pickup")}</button>}
                          {pk.status === "in_progress" && <button className="bt" onClick={() => updatePickupStatus(pk.id, "completed")} style={{ padding: "4px 10px", fontSize: 10, background: "rgba(34,197,94,.08)", color: "var(--g)", border: "1px solid rgba(34,197,94,.15)" }}>✅ {t("complete_pickup")}</button>}
                          <button className="bt" onClick={() => updatePickupStatus(pk.id, "cancelled")} style={{ padding: "4px 10px", fontSize: 10, background: "rgba(239,68,68,.08)", color: "var(--r)", border: "1px solid rgba(239,68,68,.15)" }}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═── REPORTS TAB ──═ */}
            {!loading && tab === "reports" && (
              <div className="fu">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>📄 {t("reports")}</h3>
                  <button className="bt" onClick={() => {
                    const rows = [["ID", lang === "id" ? "Tanggal" : "Date", "Status", lang === "id" ? "Pengguna" : "User", "Drop Point", `${t("weight")} (kg)`, `${t("value")} (Rp)`]];
                    const txs = reportRange.from ? transactions.filter(tx => {
                      const d = tx.created_at?.slice(0, 10);
                      return (!reportRange.from || d >= reportRange.from) && (!reportRange.to || d <= reportRange.to);
                    }) : transactions;
                    for (const tx of txs) {
                      const items = txItems.filter(i => i.transaction_id === tx.id);
                      const w = items.reduce((s, it) => s + Number(it.weight_kg), 0);
                      rows.push([tx.id, tx.created_at?.slice(0, 10), tx.status, tx.user_name, tx.drop_point_id, w.toFixed(1), Math.round(getTxTotal(tx.id))]);
                    }
                    downloadCSV(rows, `ecochain-report-${new Date().toISOString().slice(0, 10)}.csv`);
                    flash(`✅ ${t("export_csv")} — ${txs.length} ${t("tx").toLowerCase()}`);
                  }} style={{ padding: "6px 14px", background: "rgba(34,197,94,.12)", color: "var(--g)", fontSize: 11, fontWeight: 600, border: "1px solid rgba(34,197,94,.2)" }}>
                    📥 {t("export_csv")}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input type="date" value={reportRange.from} onChange={e => setReportRange(r => ({ ...r, from: e.target.value }))} style={{ flex: 1, fontSize: 11 }} />
                  <input type="date" value={reportRange.to} onChange={e => setReportRange(r => ({ ...r, to: e.target.value }))} style={{ flex: 1, fontSize: 11 }} />
                </div>

                {/* Monthly summary */}
                {(() => {
                  const months = {};
                  const txs = reportRange.from ? transactions.filter(tx => {
                    const d = tx.created_at?.slice(0, 10);
                    return (!reportRange.from || d >= reportRange.from) && (!reportRange.to || d <= reportRange.to);
                  }) : transactions;
                  for (const tx of txs) {
                    const m = tx.created_at?.slice(0, 7) || "Unknown";
                    if (!months[m]) months[m] = { count: 0, weight: 0, value: 0, done: 0 };
                    months[m].count++;
                    if (tx.status === "done") months[m].done++;
                    const items = txItems.filter(i => i.transaction_id === tx.id);
                    months[m].weight += items.reduce((s, it) => s + Number(it.weight_kg), 0);
                    months[m].value += getTxTotal(tx.id);
                  }
                  const sorted = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]));
                  return (
                    <div className="c" style={{ overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 0.8fr", padding: "8px 16px", background: "rgba(255,255,255,.02)", fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)", fontWeight: 700 }}>
                        <span>{lang === "id" ? "BULAN" : "MONTH"}</span><span>{t("total_tx")}</span><span style={{ textAlign: "right" }}>{t("weight")}</span><span style={{ textAlign: "right" }}>{t("value")}</span><span style={{ textAlign: "right" }}>{t("done")}</span>
                      </div>
                      {sorted.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--t2)", fontSize: 11 }}>{t("no_data")}</div>}
                      {sorted.map(([m, d]) => (
                        <div key={m} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 0.8fr", padding: "8px 16px", borderTop: "1px solid var(--bdr)", fontSize: 11, alignItems: "center" }}>
                          <span style={{ fontFamily: "var(--m)", color: "var(--w)", fontWeight: 600 }}>{m}</span>
                          <span style={{ color: "var(--t2)" }}>{d.count}</span>
                          <span style={{ textAlign: "right", fontFamily: "var(--m)", color: "var(--b)" }}>{d.weight.toFixed(1)} kg</span>
                          <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--g)" }}>{rp(d.value)}</span>
                          <span style={{ textAlign: "right", fontFamily: "var(--m)", color: "var(--t2)" }}>{d.done}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Audit Trail */}
                {["dp", "bank", "pelapak"].includes(profile.role) && auditLogs.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>📋 {t("audit_trail")}</div>
                    <div className="c" style={{ overflow: "hidden" }}>
                      {auditLogs.slice(0, 20).map((log, i) => (
                        <div key={log.id} style={{ display: "flex", gap: 8, padding: "8px 14px", borderTop: i ? "1px solid var(--bdr)" : "none", fontSize: 10 }}>
                          <span style={{ color: "var(--t2)", fontFamily: "var(--m)", whiteSpace: "nowrap" }}>{new Date(log.created_at).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span style={{ color: "var(--w)" }}>
                            <span style={{ fontWeight: 600 }}>{log.action}</span>
                            <span style={{ color: "var(--t2)", marginLeft: 4 }}>{log.entity_type} {log.entity_id && `#${log.entity_id}`}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disputes */}
                {disputes.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>⚠️ {t("dispute")}s ({disputes.length})</div>
                    {disputes.map((d, i) => {
                      const statusC = { open: "var(--y)", investigating: "var(--b)", resolved: "var(--g)", closed: "var(--t2)" };
                      return (
                        <div key={d.id} className="c" style={{ padding: "10px 14px", marginBottom: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--w)", fontFamily: "var(--m)" }}>{d.transaction_id}</span>
                            <Badge color={statusC[d.status] || "var(--t2)"}>{d.status.toUpperCase()}</Badge>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{d.reason}</div>
                          {d.resolution && <div style={{ fontSize: 10, color: "var(--g)", marginTop: 2 }}>✓ {d.resolution}</div>}
                          {["dp", "bank"].includes(profile.role) && d.status === "open" && (
                            <button className="bt" onClick={() => resolveDispute(d.id, lang === "id" ? "Diselesaikan oleh operator" : "Resolved by operator")}
                              style={{ padding: "4px 10px", fontSize: 9, marginTop: 4, background: "rgba(34,197,94,.08)", color: "var(--g)", border: "1px solid rgba(34,197,94,.15)" }}>✓ {t("resolution")}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═── WALLET TAB ──═ */}
            {!loading && tab === "wallet" && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>💳 {t("wallet")}</h3>

                {/* Balance card */}
                <div className="c" style={{ padding: "20px 24px", marginBottom: 14, background: "linear-gradient(135deg, rgba(34,197,94,.08), rgba(6,182,212,.08))", border: "1px solid rgba(34,197,94,.2)" }}>
                  <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "var(--m)" }}>{t("balance")}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--d)", color: "var(--g)" }}>{rp(Number(profile?.wallet_balance || leaderboard.find(u => u.id === profile?.id)?.wallet_balance || 0))}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {[10000, 50000, 100000].map(amt => (
                      <button key={amt} className="bt" onClick={() => walletTopUp(amt)}
                        style={{ padding: "6px 12px", fontSize: 10, fontWeight: 600, background: "rgba(34,197,94,.08)", color: "var(--g)", border: "1px solid rgba(34,197,94,.15)" }}>
                        + {rp(amt)}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 8, color: "var(--t2)", marginTop: 6 }}>{lang === "id" ? "* Saldo otomatis bertambah saat transaksi selesai" : "* Balance auto-credits when transactions complete"}</div>
                </div>

                {/* Wallet history */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 8 }}>📜 {t("wallet_history")}</div>
                {walletTxns.length === 0 && <div className="c" style={{ padding: 20, textAlign: "center", color: "var(--t2)", fontSize: 11 }}>{t("no_data")}</div>}
                <div className="c" style={{ overflow: "hidden" }}>
                  {walletTxns.map((wt, i) => (
                    <div key={wt.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderTop: i ? "1px solid var(--bdr)" : "none", fontSize: 11, alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: 600, color: "var(--w)" }}>{wt.description || (wt.type === "credit" ? t("credit") : t("debit"))}</span>
                        <div style={{ fontSize: 9, color: "var(--t2)", fontFamily: "var(--m)" }}>{new Date(wt.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: wt.type === "credit" ? "var(--g)" : "var(--r)" }}>
                        {wt.type === "credit" ? "+" : "-"}{rp(Number(wt.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═── MARKETPLACE TAB ──═ */}
            {!loading && tab === "marketplace" && (
              <div className="fu">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>🛒 {t("marketplace")}</h3>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["all", ...new Set(products.map(p => p.category))].map(c => (
                      <button key={c} className="bt" onClick={() => setProductFilter(c)}
                        style={{ padding: "4px 8px", fontSize: 9, background: productFilter === c ? "rgba(34,197,94,.1)" : "transparent", color: productFilter === c ? "var(--g)" : "var(--t2)", border: `1px solid ${productFilter === c ? "rgba(34,197,94,.25)" : "var(--bdr)"}` }}>
                        {c === "all" ? (lang === "id" ? "Semua" : "All") : c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add product form (for sellers) */}
                {["pelapak", "bank"].includes(profile.role) && (
                  <div className="c" style={{ padding: 18, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginBottom: 10 }}>➕ {t("list_product")}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <input placeholder={t("product_name")} value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
                      <input type="number" placeholder={`${t("product_price")} (Rp)`} value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <input placeholder={t("product_desc")} value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} />
                      <select value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="">Kategori</option>
                        {categories.map(c => <option key={c.code} value={c.code}>{c.icon} {c.label}</option>)}
                      </select>
                      <input type="number" min="1" placeholder={t("product_stock")} value={productForm.stock} onChange={e => setProductForm(f => ({ ...f, stock: e.target.value }))} />
                    </div>
                    <button className="bt" onClick={addProduct}
                      style={{ padding: "10px 16px", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 12 }}>🛒 {t("list_product")}</button>
                  </div>
                )}

                {/* Product grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {products.filter(p => productFilter === "all" || p.category === productFilter).map((p, i) => {
                    const seller = leaderboard.find(u => u.id === p.seller_id) || pelapakList.find(u => u.id === p.seller_id);
                    return (
                      <div key={p.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <Badge color="var(--c)">{p.category}</Badge>
                          <Badge color="var(--g)">{t("product_stock")}: {p.stock}</Badge>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--w)", fontFamily: "var(--d)" }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{p.description}</div>}
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--d)", color: "var(--g)", marginTop: 6 }}>{rp(Number(p.price))}</div>
                        <div style={{ fontSize: 9, color: "var(--t2)", marginTop: 4 }}>
                          {seller ? `🏪 ${seller.name}` : ""} • {new Date(p.created_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {products.filter(p => productFilter === "all" || p.category === productFilter).length === 0 && (
                  <div className="c" style={{ padding: 30, textAlign: "center", color: "var(--t2)", fontSize: 11 }}>{t("no_data")}</div>
                )}
              </div>
            )}

            {/* ═── COMMUNITY TAB ──═ */}
            {!loading && tab === "community" && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>🌱 {t("community")}</h3>

                {/* Eco Tips */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g)", marginBottom: 8 }}>♻️ {t("tips_title")}</div>
                <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
                  {ECO_TIPS.map((tip, i) => (
                    <div key={i} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 22 }}>{tip.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--w)" }}>{lang === "en" ? tip.en : tip.id}</div>
                        <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{lang === "en" ? tip.body_en : tip.body_id}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Activity (anonymized) */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--c)", marginBottom: 8 }}>📋 {t("recent_activity")}</div>
                {transactions.filter(tx => tx.status === "done").slice(0, 5).map((tx, i) => {
                  const dp = dropPoints.find(d => d.id === tx.drop_point_id);
                  const items = txItems.filter(it => it.transaction_id === tx.id);
                  const totalKg = items.reduce((s, it) => s + Number(it.weight_kg), 0);
                  const anonName = (tx.user_name || "?")[0] + "***";
                  return (
                    <div key={tx.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "10px 14px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "var(--w)", fontWeight: 600 }}>{anonName} → {dp?.name || "?"}</span>
                        <span style={{ color: "var(--g)", fontFamily: "var(--m)", fontWeight: 700 }}>{totalKg.toFixed(1)} kg</span>
                      </div>
                      <div style={{ fontSize: 9, color: "var(--t2)", marginTop: 2 }}>{items.map(it => it.waste_name).join(", ")} • {new Date(tx.created_at).toLocaleDateString("id-ID")}</div>
                    </div>
                  );
                })}
                {transactions.filter(tx => tx.status === "done").length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--t2)", fontSize: 11 }}>{t("no_data")}</div>}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═── PRICE ALERTS PANEL ──═ */}
      {showAlerts && (
        <div style={{ position: "fixed", top: 50, right: 16, zIndex: 9997, width: 300, maxHeight: 400, overflow: "auto" }} className="c fu">
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--bdr)", fontSize: 12, fontWeight: 700, color: "var(--w)", display: "flex", justifyContent: "space-between" }}>
            <span>🔔 {t("alerts")}</span>
            <button className="bt" onClick={() => setShowAlerts(false)} style={{ fontSize: 11, color: "var(--t2)", background: "none", border: "none" }}>✕</button>
          </div>
          {priceAlerts.length === 0 && <div style={{ padding: 16, fontSize: 11, color: "var(--t2)", textAlign: "center" }}>{lang === "id" ? "Tidak ada perubahan harga" : "No price changes"}</div>}
          {priceAlerts.map(a => (
            <div key={a.code} style={{ padding: "8px 16px", borderBottom: "1px solid var(--bdr)", fontSize: 11 }}>
              <div style={{ color: "var(--w)", fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontFamily: "var(--m)", fontSize: 10 }}>
                <span style={{ color: "var(--t2)" }}>{rp(a.prev)}</span>
                <span style={{ margin: "0 4px" }}>→</span>
                <span style={{ color: a.up ? "var(--g)" : "var(--r)", fontWeight: 700 }}>{rp(a.curr)} {a.up ? "↑" : "↓"}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: "8px 16px", fontSize: 9, color: "var(--t2)" }}>
            {lang === "id" ? `${watchedItems.length} item dipantau` : `${watchedItems.length} items watched`}
          </div>
        </div>
      )}

      {/* ═── PROFILE MODAL ──═ */}
      {showProfile && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowProfile(false)}>
          <div className="c fu" style={{ padding: 28, maxWidth: 400, width: "90%", background: "var(--bg3)" }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg,${roleColor[profile.role]},${roleColor[profile.role]}88)`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "var(--d)" }}>
                {(profile.name || "?")[0].toUpperCase()}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: "var(--w)", fontFamily: "var(--d)" }}>{profile.name}</div>
              <div style={{ fontSize: 11, color: "var(--t2)" }}>{profile.email}</div>
              <Badge color={roleColor[profile.role]}>{roleIcon[profile.role]} {roleLabel[profile.role]}</Badge>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>{t("name")}</label>
              <input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: "var(--t2)", marginBottom: 4, display: "block" }}>{t("new_pw")} ({lang === "id" ? "kosongkan jika tidak ubah" : "leave blank to keep"})</label>
              <input type="password" value={profileForm.newPassword} onChange={e => setProfileForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="••••••••" minLength={6} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="bt" onClick={saveProfile} style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 13 }}>{t("save_profile")}</button>
              <button className="bt" onClick={() => setShowProfile(false)} style={{ padding: "12px 18px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 13, border: "1px solid var(--bdr)" }}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═── PWA INSTALL BANNER ──═ */}
      {installPrompt && (
        <div style={{ position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "10px 20px", borderRadius: 12, background: "rgba(34,197,94,.92)", color: "#fff", fontWeight: 600, fontSize: 12, backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,.4)", display: "flex", alignItems: "center", gap: 12, animation: "pop .25s ease" }}>
          <span>📲 {t("install_app")}</span>
          <button className="bt" onClick={async () => { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}
            style={{ padding: "6px 14px", background: "#fff", color: "#16A34A", fontWeight: 700, fontSize: 11, border: "none" }}>Install</button>
          <button className="bt" onClick={() => setInstallPrompt(null)} style={{ background: "none", color: "rgba(255,255,255,.7)", border: "none", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000, padding: "6px 16px", background: "rgba(245,158,11,.92)", color: "#fff", fontSize: 11, fontWeight: 600, textAlign: "center" }}>
          📴 {t("offline_mode")} — {t("cached_data")}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowReviewModal(false)}>
          <div className="c" style={{ padding: 24, width: "100%", maxWidth: 360, animation: "pop .2s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--w)", marginBottom: 14 }}>⭐ {t("rate")}</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className="bt" onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                  style={{ fontSize: 24, padding: 4, background: "none", border: "none", opacity: n <= reviewForm.rating ? 1 : 0.3, filter: n <= reviewForm.rating ? "none" : "grayscale(1)" }}>⭐</button>
              ))}
            </div>
            <textarea placeholder={t("review_placeholder")} value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
              rows={3} style={{ width: "100%", marginBottom: 12, background: "var(--bg2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: 10, color: "var(--t)", fontSize: 12, fontFamily: "var(--f)", resize: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="bt" onClick={submitReview} style={{ flex: 1, padding: 10, background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#fff", fontWeight: 700, fontSize: 12 }}>{t("submit")}</button>
              <button className="bt" onClick={() => setShowReviewModal(false)} style={{ padding: "10px 16px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 12, border: "1px solid var(--bdr)" }}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowDisputeModal(false)}>
          <div className="c" style={{ padding: 24, width: "100%", maxWidth: 360, animation: "pop .2s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--w)", marginBottom: 6 }}>⚠️ {t("raise_dispute")}</div>
            <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 12 }}>TX: {disputeForm.txId}</div>
            <textarea placeholder={t("dispute_reason")} value={disputeForm.reason} onChange={e => setDisputeForm(f => ({ ...f, reason: e.target.value }))}
              rows={4} style={{ width: "100%", marginBottom: 12, background: "var(--bg2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: 10, color: "var(--t)", fontSize: 12, fontFamily: "var(--f)", resize: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="bt" onClick={raiseDispute} style={{ flex: 1, padding: 10, background: "linear-gradient(135deg,#EF4444,#DC2626)", color: "#fff", fontWeight: 700, fontSize: 12 }}>{t("raise_dispute")}</button>
              <button className="bt" onClick={() => setShowDisputeModal(false)} style={{ padding: "10px 16px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 12, border: "1px solid var(--bdr)" }}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Print Div (hidden, shown only during print) */}
      {printTx && (() => {
        const tx = transactions.find(t2 => t2.id === printTx);
        if (!tx) return null;
        const dp = dropPoints.find(d => d.id === tx.drop_point_id);
        const items = txItems.filter(i => i.transaction_id === tx.id);
        return (
          <div id="invoice-print" style={{ fontFamily: "Arial, sans-serif", color: "#000", padding: 20 }}>
            <h2 style={{ textAlign: "center", marginBottom: 4 }}>EcoChain AI Marketplace</h2>
            <p style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: 16 }}>Struk Transaksi</p>
            <table style={{ width: "100%", fontSize: 12, marginBottom: 8 }}>
              <tbody>
                <tr><td style={{ fontWeight: "bold" }}>TX ID</td><td>{tx.id}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Tanggal</td><td>{new Date(tx.created_at).toLocaleString("id-ID")}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>User</td><td>{tx.user_name}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Drop Point</td><td>{dp?.name || tx.drop_point_id}</td></tr>
                <tr><td style={{ fontWeight: "bold" }}>Status</td><td>{tx.status.toUpperCase()}</td></tr>
              </tbody>
            </table>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 12 }}>
              <thead><tr style={{ borderBottom: "2px solid #000" }}><th style={{ textAlign: "left", padding: 4 }}>Item</th><th style={{ textAlign: "right", padding: 4 }}>Berat</th><th style={{ textAlign: "right", padding: 4 }}>Harga</th><th style={{ textAlign: "right", padding: 4 }}>Subtotal</th></tr></thead>
              <tbody>
                {items.map(it => {
                  const p = effectivePrices.find(pr => pr.item_code === it.waste_code);
                  const price = p?.dp_price || p?.pelapak_price || 0;
                  return (
                    <tr key={it.id} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: 4 }}>{it.waste_name}</td>
                      <td style={{ textAlign: "right", padding: 4 }}>{Number(it.weight_kg).toFixed(1)} kg</td>
                      <td style={{ textAlign: "right", padding: 4 }}>{rp(price)}</td>
                      <td style={{ textAlign: "right", padding: 4, fontWeight: "bold" }}>{rp(price * Number(it.weight_kg))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ textAlign: "right", fontSize: 16, fontWeight: "bold", marginBottom: 16 }}>Total: {rp(getTxTotal(tx.id))}</div>
            <div style={{ textAlign: "center", fontSize: 10, color: "#999" }}>EcoChain AI Marketplace • ecochain-ai-marketplace.sopian-hadianto.workers.dev</div>
          </div>
        );
      })()}

      {/* Onboarding Overlay */}
      {showOnboard && onboardStep >= 1 && onboardStep <= ONBOARD_STEPS.length && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,.75)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="c" style={{ padding: 24, maxWidth: 340, textAlign: "center", animation: "pop .2s ease" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{["💰", "📷", "🤖", "📊"][onboardStep - 1]}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--w)", marginBottom: 6 }}>{lang === "id" ? `Langkah ${onboardStep}/${ONBOARD_STEPS.length}` : `Step ${onboardStep}/${ONBOARD_STEPS.length}`}</div>
            <div style={{ fontSize: 12, color: "var(--t)", marginBottom: 16 }}>{lang === "en" ? ONBOARD_STEPS[onboardStep - 1].text_en : ONBOARD_STEPS[onboardStep - 1].text_id}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {onboardStep < ONBOARD_STEPS.length ? (
                <button className="bt" onClick={() => { setTab(ONBOARD_STEPS[onboardStep - 1].tab); setOnboardStep(s => s + 1); }}
                  style={{ padding: "8px 20px", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 12 }}>{t("onboard_next")} →</button>
              ) : (
                <button className="bt" onClick={() => { setShowOnboard(false); localStorage.setItem("eco_onboard_done", "1"); setTab("dashboard"); }}
                  style={{ padding: "8px 20px", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 12 }}>🎉 {t("onboard_done")}</button>
              )}
              <button className="bt" onClick={() => { setShowOnboard(false); localStorage.setItem("eco_onboard_done", "1"); }}
                style={{ padding: "8px 16px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 11, border: "1px solid var(--bdr)" }}>{t("onboard_skip")}</button>
            </div>
          </div>
        </div>
      )}

      <footer style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid var(--bdr)", fontSize: 9, color: "var(--t2)", fontFamily: "var(--m)", lineHeight: 1.8 }}>
        EcoChain AI Marketplace • Supabase Connected • Per-Entity Pricing
        <br />Network: Pondok Aren & Serpong Utara, Tangerang Selatan
      </footer>
    </div>
  );
}
