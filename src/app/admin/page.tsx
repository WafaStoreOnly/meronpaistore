"use client";

import { useEffect, useRef, useState } from "react";
import { playNotif } from "@/lib/lib";

type Tab = "orders" | "chat" | "voucher" | "settings";

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const k = localStorage.getItem("admin_key");
    if (k) {
      setKey(k);
      verify(k);
    }
  }, []);

  async function verify(k: string) {
    setLoading(true);
    const r = await fetch("/api/admin/orders", { headers: { "x-admin-key": k } });
    if (r.ok) {
      setAuthed(true);
      localStorage.setItem("admin_key", k);
    } else {
      localStorage.removeItem("admin_key");
      alert("Key salah");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!authed) return;
    const check = async () => {
      const d = await fetch("/api/chat/unread-count", { headers: { "x-admin-key": key } }).then((r) => r.json());
      setUnread(d.count || 0);
    };
    check();
    const i = setInterval(check, 10000);
    return () => clearInterval(i);
  }, [authed, key]);

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl border border-brand-100 p-8">
          <h1 className="text-2xl font-bold mb-4">Admin MeronpaiStore</h1>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Admin key"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg mb-4 outline-none"
          />
          <button
            onClick={() => verify(key)}
            disabled={loading || !key}
            className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl disabled:bg-gray-300"
          >
            {loading ? "..." : "Masuk"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard Admin</h1>
          <button
            onClick={() => {
              localStorage.removeItem("admin_key");
              setAuthed(false);
            }}
            className="text-sm text-red-600"
          >
            Logout
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(["orders", "chat", "voucher", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition relative whitespace-nowrap ${
                tab === t ? "bg-brand-600 text-white" : "bg-white border border-gray-200"
              }`}
            >
              {t === "orders" ? "📦 Order" : t === "chat" ? "💬 Chat" : t === "voucher" ? "🎟️ Voucher" : "⚙️ Setting"}
              {t === "chat" && unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "orders" && <OrdersTab adminKey={key} />}
        {tab === "chat" && <ChatTab adminKey={key} />}
        {tab === "voucher" && <VoucherTab adminKey={key} />}
        {tab === "settings" && <SettingsTab adminKey={key} />}
      </div>
    </main>
  );
}

function OrdersTab({ adminKey }: { adminKey: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    const d = await fetch("/api/admin/orders", { headers: { "x-admin-key": adminKey } }).then((r) => r.json());
    setOrders(d.orders || []);
  };
  useEffect(() => { load(); }, []);

  async function update(invoice: string, status: string) {
    if (!confirm(`Ubah ke "${status}"?`)) return;
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ invoice, status }),
    });
    load();
  }

  const filtered = (filter === "all" ? orders : orders.filter((o) => o.status === filter)).filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.invoice.toLowerCase().includes(q) || o.username.toLowerCase().includes(q);
  });

  const counts: any = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    waiting_verification: orders.filter((o) => o.status === "waiting_verification").length,
    paid: orders.filter((o) => o.status === "paid").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "waiting_verification", "paid", "delivered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              filter === f ? "bg-brand-600 text-white" : "bg-white border border-gray-200"
            }`}
          >
            {f === "all" ? "Semua" : f === "pending" ? "Belum Bayar" : f === "waiting_verification" ? "Perlu Verif" : f === "paid" ? "Dibayar" : "Selesai"} ({counts[f]})
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Cari invoice/username"
        className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4 outline-none"
      />

      <div className="space-y-3">
        {filtered.map((o) => (
          <div key={o.id} className="bg-white rounded-xl border border-brand-100 p-4">
            <div className="flex justify-between mb-2">
              <div>
                <p className="font-mono font-semibold text-sm">{o.invoice}</p>
                <p className="text-xs text-gray-500">
                  {new Date(o.created_at).toLocaleString("id-ID")}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
              <div>
                <p className="text-xs text-gray-500">Metode</p>
                <p className="capitalize">{o.method}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Username</p>
                <p>{o.username}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Robux</p>
                <p>{o.robux_amount.toLocaleString("id-ID")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="font-semibold">Rp{o.price.toLocaleString("id-ID")}</p>
              </div>
            </div>
            {o.gamepass_link && (
              <p className="text-xs text-gray-500 mb-1">
                Gamepass:{" "}
                <a href={o.gamepass_link} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                  Link
                </a>
              </p>
            )}
            {o.item_name && (
              <p className="text-xs text-gray-500 mb-1">
                Item: <strong>{o.item_name}</strong>
              </p>
            )}
            {o.private_server_link && (
              <p className="text-xs text-gray-500 mb-1">
                Private:{" "}
                <a href={o.private_server_link} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                  Link
                </a>
              </p>
            )}
            {o.proof_url && <img src={o.proof_url} className="max-h-48 rounded-lg mb-3 mt-2" />}
            <div className="flex gap-2 flex-wrap">
              {o.status === "waiting_verification" && (
                <>
                  <button
                    onClick={() => update(o.invoice, "paid")}
                    className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg font-semibold"
                  >
                    ✓ Verifikasi
                  </button>
                  <button
                    onClick={() => update(o.invoice, "failed")}
                    className="bg-red-100 text-red-700 text-sm px-4 py-2 rounded-lg font-semibold"
                  >
                    ✕ Tolak
                  </button>
                </>
              )}
              {o.status === "paid" && (
                <button
                  onClick={() => update(o.invoice, "delivered")}
                  className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg font-semibold"
                >
                  📦 Selesai
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-500 py-8">Tidak ada order</p>}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c: any = {
    pending: "bg-yellow-100 text-yellow-800",
    waiting_verification: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    delivered: "bg-emerald-100 text-emerald-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold self-start ${c[status]}`}>
      {status.toUpperCase()}
    </span>
  );
}

function ChatTab({ adminKey }: { adminKey: string }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sound, setSound] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef(0);
  const initRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = localStorage.getItem("chat_sound");
    if (s === "off") setSound(false);
  }, []);

  async function loadSessions() {
    const d = await fetch("/api/admin/chat", { headers: { "x-admin-key": adminKey } }).then((r) => r.json());
    const s = d.sessions || [];
    const total = s.reduce((x: number, y: any) => x + y.unread, 0);
    if (initRef.current && sound && total > unreadRef.current) playNotif();
    unreadRef.current = total;
    setSessions(s);
    initRef.current = true;
  }

  async function loadMessages(sid: string) {
    const d = await fetch(`/api/admin/chat?session=${sid}`, { headers: { "x-admin-key": adminKey } }).then((r) => r.json());
    setMessages(d.messages || []);
  }

  useEffect(() => {
    loadSessions();
    const i = setInterval(loadSessions, 5000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!active) return;
    loadMessages(active);
    const i = setInterval(() => loadMessages(active), 3000);
    return () => clearInterval(i);
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || !active) return;
    await fetch("/api/admin/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ sessionId: active, message: input.trim() }),
    });
    setInput("");
    loadMessages(active);
    loadSessions();
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !active) return;
    const fd = new FormData();
    fd.append("file", f);
    fd.append("sessionId", active);
    fd.append("isAdmin", "true");
    await fetch("/api/chat/upload", { method: "POST", headers: { "x-admin-key": adminKey }, body: fd });
    loadMessages(active);
    loadSessions();
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex gap-3 h-[70vh]">
      <div className="w-72 bg-white rounded-2xl border border-brand-100 overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.session_id}
            onClick={() => setActive(s.session_id)}
            className={`w-full text-left p-3 border-b hover:bg-gray-50 ${
              active === s.session_id ? "bg-brand-50" : ""
            }`}
          >
            <div className="flex justify-between mb-1">
              <p className="font-semibold text-sm truncate">{s.username || "Anon"}</p>
              {s.unread > 0 && (
                <span className="bg-brand-600 text-white text-[10px] px-1.5 rounded-full">{s.unread}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{s.last_message}</p>
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="p-6 text-center text-gray-500 text-sm">Belum ada chat</p>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-brand-100 flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Pilih chat</div>
        ) : (
          <>
            <div className="p-3 border-b flex justify-between items-center">
              <p className="font-semibold text-sm">
                {sessions.find((s) => s.session_id === active)?.username || "Anonymous"}
              </p>
              <button
                onClick={() => {
                  const n = !sound;
                  setSound(n);
                  localStorage.setItem("chat_sound", n ? "on" : "off");
                }}
                className="text-lg"
              >
                {sound ? "🔔" : "🔕"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-2xl overflow-hidden text-sm ${
                      m.direction === "out" ? "bg-brand-600 text-white" : "bg-gray-100"
                    }`}
                  >
                    {m.attachment_url && (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer">
                        <img src={m.attachment_url} className="max-w-[250px]" />
                      </a>
                    )}
                    {m.message && <p className="px-3 py-2 whitespace-pre-wrap">{m.message}</p>}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={uploadImage} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="w-10 h-10 bg-gray-100 rounded-lg">
                📎
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Balas..."
                className="flex-1 px-3 border rounded-lg outline-none text-sm"
              />
              <button onClick={send} className="bg-brand-600 text-white px-4 rounded-lg font-semibold text-sm">
                Kirim
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VoucherTab({ adminKey }: { adminKey: string }) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [f, setF] = useState({
    code: "",
    discount_type: "percent",
    discount_value: "",
    min_purchase: "",
    max_uses: "",
  });

  async function load() {
    const d = await fetch("/api/admin/voucher", { headers: { "x-admin-key": adminKey } }).then((r) => r.json());
    setVouchers(d.vouchers || []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!f.code || !f.discount_value) return alert("Isi kode & nilai");
    const r = await fetch("/api/admin/voucher", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(f),
    });
    if (r.ok) {
      alert("Dibuat!");
      setF({ code: "", discount_type: "percent", discount_value: "", min_purchase: "", max_uses: "" });
      load();
    }
  }

  async function toggle(id: string, active: boolean) {
    await fetch("/api/admin/voucher", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ id, active: !active }),
    });
    load();
  }

  async function del(id: string) {
    if (!confirm("Hapus?")) return;
    await fetch(`/api/admin/voucher?id=${id}`, { method: "DELETE", headers: { "x-admin-key": adminKey } });
    load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-brand-100 p-4">
        <h3 className="font-bold mb-3">Buat Voucher</h3>
        <div className="space-y-3">
          <input
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            placeholder="KODE"
            className="w-full px-3 py-2 border rounded-lg outline-none font-mono"
          />
          <select
            value={f.discount_type}
            onChange={(e) => setF({ ...f, discount_type: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="percent">Persen (%)</option>
            <option value="fixed">Nominal (Rp)</option>
          </select>
          <input
            type="number"
            value={f.discount_value}
            onChange={(e) => setF({ ...f, discount_value: e.target.value })}
            placeholder="Nilai diskon"
            className="w-full px-3 py-2 border rounded-lg"
          />
          <input
            type="number"
            value={f.min_purchase}
            onChange={(e) => setF({ ...f, min_purchase: e.target.value })}
            placeholder="Min belanja (opsional)"
            className="w-full px-3 py-2 border rounded-lg"
          />
          <input
            type="number"
            value={f.max_uses}
            onChange={(e) => setF({ ...f, max_uses: e.target.value })}
            placeholder="Max pakai (kosong = ∞)"
            className="w-full px-3 py-2 border rounded-lg"
          />
          <button onClick={create} className="w-full bg-brand-600 text-white py-2 rounded-lg font-semibold">
            + Buat
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {vouchers.map((v) => (
          <div key={v.id} className="bg-white rounded-xl border border-brand-100 p-3">
            <div className="flex justify-between mb-1">
              <p className="font-mono font-bold text-brand-600">{v.code}</p>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  v.active ? "bg-green-100 text-green-800" : "bg-gray-100"
                }`}
              >
                {v.active ? "AKTIF" : "OFF"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {v.discount_type === "percent"
                ? `${v.discount_value}%`
                : `Rp${v.discount_value.toLocaleString("id-ID")}`}{" "}
              • Terpakai: {v.used_count}
              {v.max_uses ? `/${v.max_uses}` : ""}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => toggle(v.id, v.active)}
                className="text-xs bg-gray-100 px-2 py-1 rounded"
              >
                {v.active ? "Nonaktif" : "Aktifkan"}
              </button>
              <button onClick={() => del(v.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded">
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ adminKey }: { adminKey: string }) {
  const [s, setS] = useState<any>({});
  const [saved, setSaved] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings || {}));
  }, []);

  async function save() {
    const r = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(s),
    });
    if (r.ok) {
      setSaved("✓ Tersimpan! Refresh halaman");
      setTimeout(() => setSaved(""), 3000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand-100 p-5 space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium mb-1.5">Nama Toko</label>
        <input
          value={s.store_name || ""}
          onChange={(e) => setS({ ...s, store_name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Judul Hero</label>
        <input
          value={s.hero_title || ""}
          onChange={(e) => setS({ ...s, hero_title: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Subjudul</label>
        <input
          value={s.hero_subtitle || ""}
          onChange={(e) => setS({ ...s, hero_subtitle: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Background URL (taruh di /public)</label>
        <input
          value={s.bg_image_url || ""}
          onChange={(e) => setS({ ...s, bg_image_url: e.target.value })}
          placeholder="/bg-home.png"
          className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Background Opacity: {s.bg_opacity || 15}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={s.bg_opacity || 15}
          onChange={(e) => setS({ ...s, bg_opacity: e.target.value })}
          className="w-full"
        />
      </div>
      {saved && <div className="bg-green-50 text-green-700 text-sm p-2 rounded">{saved}</div>}
      <button onClick={save} className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl">
        Simpan
      </button>
    </div>
  );
}
