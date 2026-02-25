import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
    return r.json();
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
    grouped[p.category].push(`${p.item_code}=${p.name}`);
  }
  let codes = "";
  for (const [cat, items] of Object.entries(grouped)) {
    codes += `${cat.toUpperCase()}: ${items.join(", ")}\n`;
  }
  return `Kamu adalah AI waste sorting assistant untuk Bank Sampah di Indonesia.
Analisis foto ini dan identifikasi semua item sampah yang bisa dijual/didaur ulang.

Klasifikasikan setiap item ke SALAH SATU kode berikut:
${codes}
Untuk setiap item berikan:
- item: deskripsi singkat apa yang terlihat
- code: kode dari daftar di atas (HARUS tepat cocok)
- cat: kategori key (${Object.keys(grouped).join("/")})
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

const callGeminiVision = async (base64, prompt) => {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: "image/jpeg", data: base64 } },
        { text: prompt },
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}`);
  return res.json();
};

const parseGeminiResponse = (apiRes, prices) => {
  const text = apiRes?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const data = JSON.parse(text);
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

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function EcoChain() {
  // ─── AUTH STATE ───
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "", role: "user" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ─── DATA STATE ───
  const [prices, setPrices] = useState([]);
  const [dropPoints, setDropPoints] = useState([]);
  const [bankSampah, setBankSampah] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txItems, setTxItems] = useState([]);
  const [margins, setMargins] = useState(null);
  const [pickups, setPickups] = useState([]);
  const [categories, setCategories] = useState([]);

  // ─── UI STATE ───
  const [tab, setTab] = useState("prices");
  const [catFilter, setCatFilter] = useState("");
  const [notif, setNotif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dpDetail, setDpDetail] = useState(null);

  // New Transaction form
  const [txForm, setTxForm] = useState({ dp: "", items: [{ code: "", weight: "" }] });

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

  const flash = useCallback((msg, type = "ok") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  // ─── RESTORE SESSION ───
  useEffect(() => {
    const saved = localStorage.getItem("eco_session");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setToken(s.token);
        setUser(s.user);
        setProfile(s.profile);
      } catch { /* ignore */ }
    }
  }, []);

  // ─── LOAD DATA ───
  const loadData = useCallback(async (t) => {
    const tk = t || token;
    setLoading(true);
    try {
      const [pr, dp, bs, mc, cat] = await Promise.all([
        sb.query("v_prices", "order=category.asc,item_code.asc", tk),
        sb.query("drop_points", "order=id.asc", tk),
        sb.query("bank_sampah", "order=id.asc", tk),
        sb.query("margin_config", "id=eq.1", tk),
        sb.query("waste_categories", "order=sort_order.asc", tk),
      ]);
      setPrices(pr || []);
      setDropPoints(dp || []);
      setBankSampah(bs || []);
      setMargins(mc?.[0] || null);
      setCategories(cat || []);
      if (!catFilter && cat?.length) setCatFilter(cat[0].code);

      // Load transactions + items if authenticated
      if (tk && tk !== SUPABASE_ANON_KEY) {
        const [tx, ti, pk] = await Promise.all([
          sb.query("transactions", "order=created_at.desc&limit=30", tk),
          sb.query("transaction_items", "order=id.asc", tk),
          sb.query("pickup_schedules", "order=pickup_date.asc", tk).catch(() => []),
        ]);
        setTransactions(tx || []);
        setTxItems(ti || []);
        setPickups(pk || []);
      }
    } catch (e) {
      console.error("Load error:", e);
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
          const [pr, dp, bs, cat] = await Promise.all([
            sb.query("v_prices", "order=category.asc,item_code.asc"),
            sb.query("drop_points", "order=id.asc"),
            sb.query("bank_sampah", "order=id.asc"),
            sb.query("waste_categories", "order=sort_order.asc"),
          ]);
          setPrices(pr || []);
          setDropPoints(dp || []);
          setBankSampah(bs || []);
          setCategories(cat || []);
          if (!catFilter && cat?.length) setCatFilter(cat[0].code);
        } catch (e) { console.error(e); }
        setLoading(false);
      })();
    }
  }, [token]);

  // ─── AUTH HANDLERS ───
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        const res = await sb.signUp(authForm.email, authForm.password, {
          name: authForm.name, role: authForm.role,
        });
        if (res.error) throw new Error(res.error.message || res.msg || "Registrasi gagal");
        if (res.access_token) {
          const u = res.user || (await sb.getUser(res.access_token));
          const p = await sb.query("profiles", `id=eq.${u.id}`, res.access_token);
          setToken(res.access_token);
          setUser(u);
          setProfile(p?.[0] || null);
          localStorage.setItem("eco_session", JSON.stringify({ token: res.access_token, user: u, profile: p?.[0] }));
          loadData(res.access_token);
          flash("✅ Registrasi berhasil! Selamat datang.");
        } else {
          flash("📧 Cek email untuk verifikasi akun.", "info");
          setAuthMode("login");
        }
      } else {
        const res = await sb.signIn(authForm.email, authForm.password);
        if (res.error) throw new Error(res.error_description || res.error.message || "Login gagal");
        const u = res.user || (await sb.getUser(res.access_token));
        const p = await sb.query("profiles", `id=eq.${u.id}`, res.access_token);
        setToken(res.access_token);
        setUser(u);
        setProfile(p?.[0] || null);
        localStorage.setItem("eco_session", JSON.stringify({ token: res.access_token, user: u, profile: p?.[0] }));
        loadData(res.access_token);
        flash(`✅ Selamat datang, ${p?.[0]?.name || "User"}!`);
      }
    } catch (err) {
      setAuthError(err.message);
    }
    setAuthLoading(false);
  };

  const logout = () => {
    setUser(null); setProfile(null); setToken(null);
    setTransactions([]); setTxItems([]); setPickups([]);
    localStorage.removeItem("eco_session");
    flash("👋 Berhasil keluar.");
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
        const found = prices.find(p => p.item_code === item.code);
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

  // ─── UPDATE MARGIN ───
  const updateMargin = async (key, val) => {
    if (!margins) return;
    try {
      await sb.update("margin_config", { id: 1 }, {
        [key]: val, updated_at: new Date().toISOString(), updated_by: user?.id,
      }, token);
      setMargins(prev => ({ ...prev, [key]: val }));
      loadData(); // reload cascading prices
      flash("✅ Margin updated — harga cascade di-refresh!");
    } catch (e) {
      flash(`❌ ${e.message}`, "err");
    }
  };

  // ─── UPDATE TX STATUS ───
  const updateTxStatus = async (txId, status) => {
    try {
      await sb.update("transactions", { id: txId }, { status }, token);
      flash(`✅ ${txId} → ${status === "done" ? "SELESAI" : status.toUpperCase()}`);
      loadData();
    } catch (e) { flash(`❌ ${e.message}`, "err"); }
  };

  // ─── SCAN HANDLER ───
  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanResults(null);
    setScanning(true);
    try {
      const { base64, preview } = await resizeAndEncode(file);
      setScanPhoto(preview);
      if (!GEMINI_API_KEY) {
        // Demo fallback
        await new Promise(r => setTimeout(r, 1500));
        const demoItems = prices.slice(0, 3).map((p, i) => ({
          item: p.name, code: p.item_code, cat: p.category,
          weight: [2.5, 1.8, 3.2][i] || 1.0,
          tip: i === 0 ? "💡 Pisahkan per kategori untuk harga maksimal." : null,
        }));
        setScanResults({ label: "Demo Scan (tanpa API key)", results: demoItems });
      } else {
        const prompt = buildWastePrompt(prices);
        const apiRes = await callGeminiVision(base64, prompt);
        const parsed = parseGeminiResponse(apiRes, prices);
        setScanResults(parsed || { label: "Tidak terdeteksi", results: [] });
      }
    } catch (err) {
      flash(`❌ Scan error: ${err.message}`, "err");
      setScanResults(null);
    }
    setScanning(false);
    e.target.value = "";
  };

  // ─── CHAT SYSTEM PROMPT ───
  const buildChatSystemPrompt = useCallback(() => {
    let priceSummary = "";
    const grouped = {};
    for (const p of prices) {
      if (!grouped[p.category]) grouped[p.category] = { icon: "", label: p.category, items: [] };
      grouped[p.category].items.push(`${p.name} Rp${Math.round(p.pelapak_price).toLocaleString("id-ID")}${p.unit !== "kg" ? `/${p.unit}` : "/kg"}`);
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

    const m = margins || { pelapak_to_bank: 0.15, bank_to_drop_point: 0.20, drop_point_to_user: 0.25 };
    const cascadeInfo = `Model Harga Cascade (4 level):
- Pelapak (harga dasar/pasar)
- Bank Sampah: Pelapak × ${((1 - Number(m.pelapak_to_bank)) * 100).toFixed(0)}% (margin ${(Number(m.pelapak_to_bank) * 100).toFixed(0)}%)
- Drop Point: Bank × ${((1 - Number(m.bank_to_drop_point)) * 100).toFixed(0)}% (margin ${(Number(m.bank_to_drop_point) * 100).toFixed(0)}%)
- End User: DP × ${((1 - Number(m.drop_point_to_user)) * 100).toFixed(0)}% (margin ${(Number(m.drop_point_to_user) * 100).toFixed(0)}%)`;

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

DROP POINT AKTIF:
${dpList || "Belum ada data"}

BANK SAMPAH:
${bsList || "Belum ada data"}

TIPS PENTING:
- Botol plastik bersih (lepas label) harga lebih tinggi dari kotor — selisih besar!
- Tembaga adalah item paling bernilai
- Minyak jelantah harus disaring, jangan campur air
- Pisahkan sampah per kategori untuk harga maksimal

Jawab pertanyaan user berdasarkan data di atas. Jika user tanya harga, selalu tampilkan harga level USER (setelah cascade), bukan harga pelapak, kecuali diminta spesifik.`;
  }, [prices, dropPoints, bankSampah, margins, categories]);

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
        const sample = prices.slice(0, 5).map(p => `${p.name}: ${rp(p.user_price)}/${p.unit}`).join("\n");
        reply = `Berikut beberapa harga sampah terkini (level User):\n${sample}\n\nMau tanya harga item spesifik? 😊`;
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

  // ─── COMPUTED ───
  const filteredPrices = useMemo(() =>
    catFilter ? prices.filter(p => p.category === catFilter) : prices
    , [prices, catFilter]);

  const getTxTotal = (txId) => {
    const items = txItems.filter(i => i.transaction_id === txId);
    return items.reduce((sum, it) => {
      const p = prices.find(pr => pr.item_code === it.waste_code);
      const price = profile?.role === "user" ? (p?.user_price || 0)
        : profile?.role === "dp" ? (p?.dp_price || 0)
          : profile?.role === "bank" ? (p?.bank_price || 0)
            : (p?.pelapak_price || 0);
      return sum + price * Number(it.weight_kg);
    }, 0);
  };

  const roleLabel = { user: "End User", dp: "Drop Point", bank: "Bank Sampah", pelapak: "Pelapak" };
  const roleIcon = { user: "👤", dp: "📍", bank: "🏦", pelapak: "🏭" };
  const roleColor = { user: "#22C55E", dp: "#F59E0B", bank: "#3B82F6", pelapak: "#A855F7" };

  // ─── CSS ───
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,700;9..144,800&display=swap');
    :root{--bg:#080C14;--bg2:#0D1420;--bg3:#131B2B;--bdr:rgba(255,255,255,0.06);--bdr2:rgba(255,255,255,0.1);--t:#CBD5E1;--t2:#64748B;--w:#F1F5F9;--g:#22C55E;--y:#F59E0B;--b:#3B82F6;--p:#A855F7;--r:#EF4444;--c:#06B6D4;--f:'Sora',sans-serif;--m:'JetBrains Mono',monospace;--d:'Fraunces',serif}
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pop{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    .fu{animation:fu .4s ease both}.fu1{animation:fu .4s .05s ease both}.fu2{animation:fu .4s .1s ease both}.fu3{animation:fu .4s .15s ease both}.fu4{animation:fu .4s .2s ease both}
    .c{background:var(--bg3);border:1px solid var(--bdr);border-radius:14px;transition:all .2s}
    .c:hover{border-color:var(--bdr2);box-shadow:0 4px 20px rgba(0,0,0,.25)}
    .bt{border:none;cursor:pointer;font-family:var(--f);transition:all .15s;border-radius:10px}
    .bt:hover{filter:brightness(1.1);transform:scale(1.01)}
    .bt:active{transform:scale(.98)}
    .pl{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:7px;font-size:10px;font-weight:600}
    input,select{font-family:var(--f);background:rgba(255,255,255,.03);border:1px solid var(--bdr);border-radius:10px;padding:10px 14px;color:var(--w);font-size:13px;outline:none;width:100%;transition:border .2s}
    input:focus,select:focus{border-color:var(--g)}
    select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
    select option{background:#1a2332;color:#fff}
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
      <header style={{ padding: "10px 20px", background: "rgba(8,12,20,.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--bdr)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#22C55E,#06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, fontFamily: "var(--d)", color: "#000" }}>♻</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--d)", color: "var(--w)" }}>Eco<span style={{ color: "var(--g)" }}>Chain</span><span style={{ color: "var(--c)", fontSize: 11, fontStyle: "italic" }}> AI</span></div>
              <div style={{ fontSize: 7, fontFamily: "var(--m)", color: "var(--t2)", letterSpacing: 1.5 }}>MARKETPLACE EKONOMI SIRKULAR SAMPAH</div>
            </div>
          </div>
          {profile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge color={roleColor[profile.role]}>{roleIcon[profile.role]} {roleLabel[profile.role]}</Badge>
              <span style={{ fontSize: 12, color: "var(--w)", fontWeight: 600 }}>{profile.name}</span>
              <button className="bt" onClick={logout} style={{ padding: "6px 14px", background: "rgba(239,68,68,.12)", color: "var(--r)", fontSize: 11, fontWeight: 600, border: "1px solid rgba(239,68,68,.2)" }}>Keluar</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--t2)" }}>Belum login</div>
          )}
        </div>
      </header>

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
                    <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: "var(--g)" }}>{rp(p.user_price)}<span style={{ fontSize: 9, color: "var(--t2)", fontWeight: 400 }}>/{p.unit}</span></span>
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
                { id: "prices", label: "💰 Harga", show: true },
                { id: "scan", label: "📷 Scan", show: profile.role === "user" },
                { id: "chat", label: "🤖 Chat AI", show: true },
                { id: "network", label: "📍 Network", show: true },
                { id: "tx", label: "📋 Transaksi", show: !!token },
                { id: "newtx", label: "➕ Buat TX", show: ["dp", "bank"].includes(profile.role) },
                { id: "margins", label: "⚙️ Margin", show: ["bank", "pelapak"].includes(profile.role) },
                { id: "pickup", label: "🚛 Pickup", show: ["dp", "bank"].includes(profile.role) },
              ].filter(t => t.show).map(t => (
                <button key={t.id} className="bt" onClick={() => setTab(t.id)} style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, background: tab === t.id ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.02)", color: tab === t.id ? "var(--g)" : "var(--t2)", border: `1px solid ${tab === t.id ? "rgba(34,197,94,.25)" : "var(--bdr)"}`, whiteSpace: "nowrap" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--t2)" }}>⏳ Memuat data...</div>}

            {/* ═── PRICES TAB ──═ */}
            {!loading && tab === "prices" && (
              <div className="fu">
                <div style={{ display: "flex", gap: 4, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
                  {categories.map(c => (
                    <button key={c.code} className="bt" onClick={() => setCatFilter(c.code)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: catFilter === c.code ? `${c.accent}20` : "rgba(255,255,255,.02)", color: catFilter === c.code ? c.accent : "var(--t2)", border: `1px solid ${catFilter === c.code ? `${c.accent}30` : "var(--bdr)"}` }}>
                      {c.icon} {c.label} <span style={{ fontSize: 9, opacity: .6 }}>({prices.filter(p => p.category === c.code).length})</span>
                    </button>
                  ))}
                </div>

                <div className="c" style={{ overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr", padding: "8px 16px", background: "rgba(255,255,255,.02)", fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)", fontWeight: 700, letterSpacing: .5 }}>
                    <span>ITEM</span>
                    <span style={{ textAlign: "right", color: "var(--p)" }}>🏭 PELAPAK</span>
                    <span style={{ textAlign: "right", color: "var(--b)" }}>🏦 BANK</span>
                    <span style={{ textAlign: "right", color: "var(--y)" }}>📍 DP</span>
                    <span style={{ textAlign: "right", color: "var(--g)" }}>👤 USER</span>
                  </div>
                  {filteredPrices.map((p, i) => (
                    <div key={p.item_code} style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr 1fr", padding: "8px 16px", borderTop: "1px solid var(--bdr)", fontSize: 11, alignItems: "center" }}>
                      <span><span style={{ fontFamily: "var(--m)", fontSize: 9, color: "var(--t2)", marginRight: 6 }}>{p.item_code}</span><span style={{ color: "var(--w)" }}>{p.name}</span>{p.unit !== "kg" && <span style={{ fontSize: 8, color: "var(--t2)", marginLeft: 4 }}>/{p.unit}</span>}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--p)" }}>{rp(p.pelapak_price)}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--b)" }}>{rp(p.bank_price)}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--y)" }}>{rp(p.dp_price)}</span>
                      <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 600, color: "var(--g)" }}>{rp(p.user_price)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: "var(--t2)", fontFamily: "var(--m)" }}>
                  {prices.length} items • Margin: {margins ? `${(margins.pelapak_to_bank * 100).toFixed(0)}% / ${(margins.bank_to_drop_point * 100).toFixed(0)}% / ${(margins.drop_point_to_user * 100).toFixed(0)}%` : "..."}
                  • Harga dari v_prices (live cascade)
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
                      const p = prices.find(pr => pr.item_code === r.code);
                      return (
                        <div key={i} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontWeight: 600, color: "var(--w)", fontSize: 12 }}>{r.item}</span>
                              <span style={{ fontFamily: "var(--m)", fontSize: 9, color: "var(--t2)", marginLeft: 8 }}>{r.code}</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "var(--m)", fontWeight: 700, color: "var(--g)", fontSize: 13 }}>{p ? rp(p.user_price * r.weight) : "-"}</div>
                              <div style={{ fontSize: 9, color: "var(--t2)" }}>{r.weight} kg × {p ? rp(p.user_price) : "?"}/{p?.unit || "kg"}</div>
                            </div>
                          </div>
                          {r.tip && <div style={{ fontSize: 10, color: "var(--y)", marginTop: 4 }}>{r.tip}</div>}
                        </div>
                      );
                    })}
                    {scanResults.results.length > 0 && (
                      <div className="c" style={{ padding: "14px 18px", marginTop: 8, background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.15)" }}>
                        <div style={{ fontSize: 10, color: "var(--t2)" }}>Estimasi Total (level User)</div>
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--d)", color: "var(--g)" }}>
                          {rp(scanResults.results.reduce((sum, r) => {
                            const p = prices.find(pr => pr.item_code === r.code);
                            return sum + (p?.user_price || 0) * r.weight;
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

            {/* ═── NETWORK TAB ──═ */}
            {!loading && tab === "network" && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--y)", marginBottom: 10 }}>📍 Drop Points ({dropPoints.length})</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginBottom: 22 }}>
                  {dropPoints.map((dp, i) => (
                    <div key={dp.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "16px 18px", cursor: "pointer" }} onClick={() => setDpDetail(dpDetail === dp.id ? null : dp.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <Badge color={dp.status === "active" ? "var(--g)" : "var(--r)"}>{dp.status === "active" ? "● AKTIF" : "NONAKTIF"}</Badge>
                        <span style={{ fontSize: 9, fontFamily: "var(--m)", color: "var(--t2)" }}>{dp.id}</span>
                      </div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--w)", fontFamily: "var(--d)", marginBottom: 2 }}>{dp.name}</h4>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 6 }}>{dp.address}</div>
                      <div style={{ fontSize: 10, color: "var(--t2)" }}>👤 {dp.operator_name || "-"} • {dp.type}</div>
                      {/* Stock bar */}
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--t2)", marginBottom: 2 }}>
                          <span>Stok</span>
                          <span style={{ fontFamily: "var(--m)" }}>{Number(dp.current_stock_kg).toFixed(0)}/{Number(dp.capacity_kg).toFixed(0)} kg</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.04)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 2, width: `${Math.min((dp.current_stock_kg / dp.capacity_kg) * 100, 100)}%`, background: dp.current_stock_kg / dp.capacity_kg > .8 ? "linear-gradient(90deg,var(--y),var(--r))" : "linear-gradient(90deg,var(--g),var(--c))", transition: "width .5s" }} />
                        </div>
                      </div>
                      {dpDetail === dp.id && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--bdr)", animation: "fu .3s ease", fontSize: 10, fontFamily: "var(--m)", color: "var(--t2)" }}>
                          📐 {dp.lat?.toFixed(6)}, {dp.lng?.toFixed(6)}
                          <br />
                          <a href={`https://www.google.com/maps?q=${dp.lat},${dp.lng}`} target="_blank" rel="noreferrer" style={{ color: "var(--c)", textDecoration: "none" }}>🗺️ Buka di Google Maps →</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--b)", marginBottom: 10 }}>🏦 Bank Sampah ({bankSampah.length})</h3>
                {bankSampah.map((bs, i) => (
                  <div key={bs.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "14px 18px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--w)", fontFamily: "var(--d)" }}>{bs.name}
                          {bs.rating && <Badge color="var(--y)"> ⭐ {bs.rating}</Badge>}
                        </h4>
                        <div style={{ fontSize: 10, color: "var(--t2)" }}>{bs.address}</div>
                        <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>
                          ⏰ {bs.operating_hours || "-"} • 📞 {bs.phone || "-"}
                          {bs.website && <> • <a href={`https://${bs.website}`} target="_blank" rel="noreferrer" style={{ color: "var(--c)" }}>🌐 {bs.website}</a></>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 10, fontFamily: "var(--m)", color: "var(--t2)" }}>
                        {bs.monthly_capacity_kg && <div>Cap: {bs.monthly_capacity_kg} kg/bln</div>}
                      </div>
                    </div>
                    {bs.specialty && <div style={{ marginTop: 6 }}><Badge color="var(--c)" outline>{bs.specialty}</Badge></div>}
                  </div>
                ))}
              </div>
            )}

            {/* ═── TRANSACTIONS TAB ──═ */}
            {!loading && tab === "tx" && (
              <div className="fu">
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)" }}>📋 Transaksi ({transactions.length})</h3>
                  <button className="bt" onClick={loadData} style={{ padding: "6px 14px", background: "rgba(255,255,255,.04)", color: "var(--t2)", fontSize: 11, border: "1px solid var(--bdr)" }}>🔄 Refresh</button>
                </div>
                {transactions.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--t2)" }}>Belum ada transaksi.</div>}
                {transactions.map((tx, i) => {
                  const items = txItems.filter(ti => ti.transaction_id === tx.id);
                  const total = getTxTotal(tx.id);
                  return (
                    <div key={tx.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "var(--m)", fontSize: 11, fontWeight: 600, color: "var(--w)" }}>{tx.id}</span>
                          <Badge color={tx.status === "done" ? "var(--g)" : tx.status === "cancelled" ? "var(--r)" : "var(--y)"}>
                            {tx.status === "done" ? "✓ DONE" : tx.status === "cancelled" ? "✕ BATAL" : "⏳ PENDING"}
                          </Badge>
                        </div>
                        <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: roleColor[profile.role], fontSize: 13 }}>{rp(total)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 3 }}>
                        👤 {tx.user_name} → 📍 {tx.drop_point_id} • {new Date(tx.created_at).toLocaleDateString("id-ID")}
                      </div>
                      {items.length > 0 && (
                        <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 2 }}>
                          {items.map(it => `${it.waste_name} (${Number(it.weight_kg).toFixed(1)}kg)`).join(" + ")}
                        </div>
                      )}
                      {/* Action buttons for DP/Bank */}
                      {tx.status === "pending" && ["dp", "bank"].includes(profile.role) && (
                        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                          <button className="bt" onClick={() => updateTxStatus(tx.id, "done")} style={{ padding: "6px 14px", background: "rgba(34,197,94,.12)", color: "var(--g)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(34,197,94,.2)" }}>✓ Selesai</button>
                          <button className="bt" onClick={() => updateTxStatus(tx.id, "cancelled")} style={{ padding: "6px 14px", background: "rgba(239,68,68,.08)", color: "var(--r)", fontSize: 10, fontWeight: 600, border: "1px solid rgba(239,68,68,.15)" }}>✕ Batal</button>
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
                        {prices.map(p => <option key={p.item_code} value={p.item_code}>{p.item_code} — {p.name} ({rp(p.dp_price)}/{p.unit})</option>)}
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
                          const p = prices.find(pr => pr.item_code === it.code);
                          return s + (p?.dp_price || 0) * (parseFloat(it.weight) || 0);
                        }, 0))}
                      </div>
                    </div>
                  )}

                  <button className="bt" onClick={submitTx}
                    style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                    ✅ Buat Transaksi
                  </button>
                </div>
              </div>
            )}

            {/* ═── MARGIN TAB ──═ */}
            {!loading && tab === "margins" && margins && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>⚙️ Margin Manager — Cascading Price Control</h3>
                <div className="c" style={{ padding: 24 }}>
                  {/* Cascade visual */}
                  {(() => {
                    const ex = prices.find(p => p.item_code === "3.1") || prices[0]; // Alumunium
                    if (!ex) return null;
                    return (
                      <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 10, fontFamily: "var(--m)", color: "var(--t2)", marginBottom: 10 }}>
                          LIVE CASCADE — {ex.name} ({rp(ex.pelapak_price)}/{ex.unit})
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {[
                            { l: "🏭 Pelapak", v: ex.pelapak_price, c: "var(--p)" },
                            { l: "🏦 Bank", v: ex.bank_price, c: "var(--b)" },
                            { l: "📍 DP", v: ex.dp_price, c: "var(--y)" },
                            { l: "👤 User", v: ex.user_price, c: "var(--g)" },
                          ].map((lv, i) => (
                            <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ flex: 1, padding: "12px 4px", borderRadius: 10, textAlign: "center", background: `${lv.c}10`, border: `1px solid ${lv.c}22` }}>
                                <div style={{ fontSize: 12 }}>{lv.l.split(" ")[0]}</div>
                                <div style={{ fontSize: 9, color: "var(--t2)", marginTop: 1 }}>{lv.l.split(" ").slice(1).join(" ")}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--m)", color: lv.c, marginTop: 3 }}>{rp(lv.v)}</div>
                              </div>
                              {i < 3 && <span style={{ color: "var(--t2)", fontSize: 10 }}>→</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sliders */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                    {[
                      { key: "pelapak_to_bank", label: "🏭→🏦 Pelapak → Bank", c: "var(--b)" },
                      { key: "bank_to_drop_point", label: "🏦→📍 Bank → DP", c: "var(--y)" },
                      { key: "drop_point_to_user", label: "📍→👤 DP → User", c: "var(--g)" },
                    ].map(s => (
                      <div key={s.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 10 }}>
                          <span style={{ color: "var(--t2)" }}>{s.label}</span>
                          <span style={{ fontFamily: "var(--m)", fontWeight: 700, color: s.c }}>{Math.round(Number(margins[s.key]) * 100)}%</span>
                        </div>
                        <input type="range" min={5} max={40}
                          value={Math.round(Number(margins[s.key]) * 100)}
                          onChange={e => updateMargin(s.key, parseInt(e.target.value) / 100)}
                          style={{ accentColor: s.c }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 10, fontFamily: "var(--m)", color: "var(--t2)" }}>
                    ⚡ Perubahan margin langsung update v_prices secara realtime di seluruh network.
                  </div>
                </div>
              </div>
            )}

            {/* ═── PICKUP TAB ──═ */}
            {!loading && tab === "pickup" && (
              <div className="fu">
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--d)", color: "var(--w)", marginBottom: 14 }}>🚛 Jadwal Pickup ({pickups.length})</h3>
                {pickups.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--t2)" }}>Belum ada jadwal pickup.</div>}
                {pickups.map((pk, i) => {
                  const dp = dropPoints.find(d => d.id === pk.drop_point_id);
                  const bs = bankSampah.find(b => b.id === pk.bank_sampah_id);
                  return (
                    <div key={pk.id} className={`c fu${Math.min(i + 1, 4)}`} style={{ padding: "12px 16px", marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <Badge color={pk.status === "completed" ? "var(--g)" : pk.status === "in_progress" ? "var(--y)" : "var(--c)"}>{pk.status.toUpperCase()}</Badge>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--w)", marginLeft: 8 }}>{new Date(pk.pickup_date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</span>
                          {pk.pickup_time && <span style={{ fontSize: 10, color: "var(--t2)", marginLeft: 4 }}>{pk.pickup_time}</span>}
                        </div>
                        <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--t2)" }}>{pk.estimated_kg ? `~${pk.estimated_kg}kg` : ""}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 3 }}>
                        🏦 {bs?.name || pk.bank_sampah_id} → 📍 {dp?.name || pk.drop_point_id}
                        {pk.notes && <span style={{ marginLeft: 6, fontStyle: "italic" }}>• {pk.notes}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid var(--bdr)", fontSize: 9, color: "var(--t2)", fontFamily: "var(--m)", lineHeight: 1.8 }}>
        EcoChain AI Marketplace • Supabase Connected • Live Cascading Prices
        <br />Harga berlaku 02 Jan 2026 • Network: Pondok Aren & Serpong Utara, Tangerang Selatan
      </footer>
    </div>
  );
}
