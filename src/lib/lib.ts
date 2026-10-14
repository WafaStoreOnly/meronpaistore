import { createClient } from "@supabase/supabase-js";

// ============ SUPABASE ============
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
export const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// ============ QRIS STATIC (dari Meronpai store) ============
export const QRIS_STATIC =
  process.env.QRIS_STATIC_STRING ||
  "00020101021126570011ID.DANA.WWW011893600915303219960802090321996080303UMI51440014ID.CO.QRIS.WWW0215ID10265309928030303UMI5204594553033605802ID5914Meronpai store6013Kab. Wonogiri61055765263043D23";

// ============ PRICING ============
export const PRICE = { username: 180, gamepass: 160, gift: 100 } as const;
export const PRESET = [100, 200, 300, 500, 800, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];
export const calcPrice = (m: keyof typeof PRICE, r: number) => Math.round(r * PRICE[m]);
export const calcGpAmount = (r: number) => Math.ceil(r / 0.7);

// ============ QRIS DINAMIS ============
function parseTLV(s: string) {
  const r: { tag: string; value: string }[] = [];
  let i = 0;
  while (i < s.length - 4) {
    const t = s.substring(i, i + 2);
    const l = parseInt(s.substring(i + 2, i + 4), 10);
    if (isNaN(l)) break;
    r.push({ tag: t, value: s.substring(i + 4, i + 4 + l) });
    i += 4 + l;
  }
  return r;
}

function buildTLV(t: string, v: string) {
  return `${t}${v.length.toString().padStart(2, "0")}${v}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function genDynamicQRIS(staticQRIS: string, amount: number): string {
  const clean = staticQRIS.trim();
  const idx = clean.lastIndexOf("6304");
  const base = idx > 0 ? clean.substring(0, idx) : clean;
  const parsed = parseTLV(base);

  let has01 = false;
  const updated = parsed.map((x) => {
    if (x.tag === "01") {
      has01 = true;
      return { tag: "01", value: "12" };
    }
    return x;
  });
  if (!has01) updated.unshift({ tag: "01", value: "12" });

  const without54 = updated.filter((x) => x.tag !== "54");
  const amountTLV = buildTLV("54", amount.toString());

  const result: string[] = [];
  let inserted = false;
  for (const x of without54) {
    if (!inserted && ["58", "59", "60", "61", "62", "63"].includes(x.tag)) {
      result.push(amountTLV);
      inserted = true;
    }
    result.push(buildTLV(x.tag, x.value));
  }
  if (!inserted) result.push(amountTLV);

  const withoutCRC = result.join("") + "6304";
  return withoutCRC + crc16(withoutCRC);
}

// ============ VOUCHER ============
export async function validateVoucher(code: string, price: number) {
  if (!code) return { valid: false as const, error: "Kode kosong" };
  try {
    const { data: v } = await sb.from("vouchers").select("*").eq("code", code.toUpperCase()).single();
    if (!v) return { valid: false as const, error: "Voucher tidak ditemukan" };
    if (!v.active) return { valid: false as const, error: "Voucher tidak aktif" };
    if (v.expires_at && new Date(v.expires_at) < new Date())
      return { valid: false as const, error: "Voucher kadaluarsa" };
    if (v.max_uses !== null && v.used_count >= v.max_uses)
      return { valid: false as const, error: "Voucher habis" };
    if (price < v.min_purchase)
      return { valid: false as const, error: `Min belanja Rp${v.min_purchase.toLocaleString("id-ID")}` };
    let disc = v.discount_type === "percent" ? Math.round((price * v.discount_value) / 100) : v.discount_value;
    disc = Math.min(disc, price);
    return { valid: true as const, discount: disc, code: v.code as string };
  } catch (e: any) {
    return { valid: false as const, error: e.message };
  }
}

// ============ SETTINGS ============
export const DEFAULT_SETTINGS = {
  store_name: "MeronpaiStore",
  hero_title: "Top Up Robux Murah & Cepat",
  hero_subtitle: "Pilih metode, isi form, bayar via QRIS. Robux langsung masuk.",
  bg_image_url: "/bg-home.png",
  bg_opacity: "15",
};

export async function getSettings() {
  try {
    const { data } = await sb.from("settings").select("*");
    if (!data || data.length === 0) return DEFAULT_SETTINGS;
    const m: any = {};
    for (const r of data) m[r.key] = r.value;
    return { ...DEFAULT_SETTINGS, ...m };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ============ CHAT HELPERS (client-side) ============
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let s = localStorage.getItem("chat_session");
  if (!s) {
    s = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("chat_session", s);
  }
  return s;
}

export function getSavedUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("chat_username") || "";
}

export function saveUsername(u: string) {
  if (typeof window !== "undefined") localStorage.setItem("chat_username", u);
}

export function playNotif() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = f;
      o.type = "sine";
      const t = ctx.currentTime + i * 0.15;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t);
      o.stop(t + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {}
}
