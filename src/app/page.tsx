"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRICE, PRESET, calcPrice, calcGpAmount,
  getSessionId, getSavedUsername, saveUsername, playNotif,
} from "../lib/lib";

type Tab = "username" | "gamepass" | "gift" | "login";
type Panel = "order" | "chat" | "voucher" | "riwayat" | "cek";

export default function Home() {
  const router = useRouter();
  const [settings, setSettings] = useState<any>({});
  const [panel, setPanel] = useState<Panel>("order");
  const [tab, setTab] = useState<Tab>("username");
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [robux, setRobux] = useState(100);
  const [gpLink, setGpLink] = useState("");
  const [itemName, setItemName] = useState("");
  const [psLink, setPsLink] = useState("");
  const [voucherIn, setVoucherIn] = useState("");
  const [voucher, setVoucher] = useState<{ code: string; discount: number } | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings || {}));
  }, []);

  const basePrice = tab === "login" ? 0 : calcPrice(tab as any, robux);
  const finalPrice = Math.max(0, basePrice - (voucher?.discount || 0));
  const gpAmount = tab === "gamepass" ? calcGpAmount(robux) : 0;
  const bgOp = (parseInt(settings.bg_opacity) || 15) / 100;

  async function applyVoucher() {
    if (!voucherIn.trim()) return;
    const r = await fetch("/api/voucher/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: voucherIn.trim(), price: basePrice }),
    }).then((x) => x.json());
    if (!r.valid) return alert(r.error);
    setVoucher({ code: r.code, discount: r.discount });
  }

  async function checkout() {
    if (!username.trim()) return alert("Isi username");
    if (robux <= 0) return alert("Robux > 0");
    if (tab === "gamepass" && !gpLink.trim()) return alert("Isi link gamepass");
    if (tab === "gift" && !itemName.trim()) return alert("Isi nama item");
    if (tab === "gift" && !psLink.trim()) return alert("Isi link private server");

    setLoading(true);
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: tab,
          username,
          robuxAmount: robux,
          price: basePrice,
          gamepassLink: tab === "gamepass" ? gpLink : undefined,
          itemName: tab === "gift" ? itemName : undefined,
          privateServerLink: tab === "gift" ? psLink : undefined,
          voucherCode: voucher?.code,
        }),
      }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      router.push(`/bayar?invoice=${r.invoice}`);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-brand-50 to-white overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{
          backgroundImage: settings.bg_image_url ? `url(${settings.bg_image_url})` : undefined,
          opacity: bgOp,
        }}
      />

      <div className="relative z-10">
        <header className="bg-white/80 backdrop-blur-sm border-b border-brand-100 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold">
                {(settings.store_name || "M").charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-lg">{settings.store_name || "MeronpaiStore"}</span>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2 text-sm">
              {(["order", "chat", "voucher", "riwayat", "cek"] as Panel[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPanel(p)}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    panel === p ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-brand-50"
                  }`}
                >
                  {p === "order" ? "🛒" : p === "chat" ? "💬" : p === "voucher" ? "🎟️" : p === "riwayat" ? "📜" : "🔍"}
                  <span className="hidden sm:inline ml-1 capitalize">{p}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        {panel === "order" && (
          <>
            <section className="max-w-4xl mx-auto px-4 pt-10 pb-6 text-center">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                {settings.hero_title || "Top Up Robux Murah & Cepat"}
              </h1>
              <p className="text-gray-700">{settings.hero_subtitle}</p>
            </section>

            <section className="max-w-4xl mx-auto px-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/90 backdrop-blur p-2 rounded-xl border border-brand-100 shadow-sm">
                {([
                  { key: "username", label: "Via Username", e: "👤" },
                  { key: "gamepass", label: "Via Gamepass", e: "🎮" },
                  { key: "gift", label: "Gift In Game", e: "🎁" },
                  { key: "login", label: "Via Login", e: "🔒" },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setTab(t.key); setVoucher(null); }}
                    className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition ${
                      tab === t.key ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-brand-50"
                    }`}
                  >
                    {t.e} {t.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="max-w-2xl mx-auto px-4 py-8">
              <div className="bg-white/95 backdrop-blur rounded-2xl border border-brand-100 p-6">
                {tab === "login" ? (
                  <div className="text-center py-10">
                    <div className="text-5xl mb-4">🔒</div>
                    <h2 className="text-xl font-bold">Coming Soon</h2>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-6">
                      {tab === "username" ? "Top Up Via Username"
                        : tab === "gamepass" ? "Top Up Via Gamepass"
                        : "Gift In Game"}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Username Roblox</label>
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Meronpai123"
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>

                      {tab === "gift" && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Nama Item</label>
                          <input
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            placeholder="VIP Fish It"
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-2">Jumlah Robux</label>
                        <input
                          type="number"
                          value={robux || ""}
                          onChange={(e) => { setRobux(parseInt(e.target.value) || 0); setVoucher(null); }}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none"
                        />
                      </div>

                      {tab !== "gift" && (
                        <div className="grid grid-cols-4 gap-2">
                          {PRESET.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => { setRobux(p); setVoucher(null); }}
                              className={`py-2 rounded-lg text-xs font-semibold border ${
                                robux === p ? "bg-brand-600 text-white border-brand-600" : "bg-white border-gray-200"
                              }`}
                            >
                              {p.toLocaleString("id-ID")}
                            </button>
                          ))}
                        </div>
                      )}

                      {tab === "gamepass" && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Link Gamepass</label>
                          <input
                            value={gpLink}
                            onChange={(e) => setGpLink(e.target.value)}
                            placeholder="https://roblox.com/game-pass/..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none"
                          />
                        </div>
                      )}

                      {tab === "gift" && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Link Private Server</label>
                          <input
                            value={psLink}
                            onChange={(e) => setPsLink(e.target.value)}
                            placeholder="https://roblox.com/games/..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg outline-none"
                          />
                        </div>
                      )}

                      {tab === "gamepass" && robux > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                          ℹ️ Gamepass yang harus dibuat: <strong>{gpAmount.toLocaleString("id-ID")} Robux</strong>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-2">🎟️ Voucher</label>
                        {voucher ? (
                          <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                            <span className="text-green-800 font-semibold text-sm">
                              {voucher.code} • -Rp{voucher.discount.toLocaleString("id-ID")}
                            </span>
                            <button
                              onClick={() => { setVoucher(null); setVoucherIn(""); }}
                              className="text-xs text-red-600"
                            >
                              Hapus
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              value={voucherIn}
                              onChange={(e) => setVoucherIn(e.target.value.toUpperCase())}
                              placeholder="MERONPAI10"
                              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg outline-none font-mono uppercase"
                            />
                            <button
                              onClick={applyVoucher}
                              className="bg-brand-100 text-brand-700 font-semibold px-5 rounded-lg text-sm"
                            >
                              Pakai
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="bg-brand-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Harga per Robux</span>
                          <span>Rp{PRICE[tab as any].toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Jumlah</span>
                          <span>{robux.toLocaleString("id-ID")}</span>
                        </div>
                        {voucher && (
                          <div className="flex justify-between text-green-600">
                            <span>Diskon</span>
                            <span>-Rp{voucher.discount.toLocaleString("id-ID")}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-brand-100 font-bold">
                          <span>Total</span>
                          <span className="text-brand-600 text-lg">Rp{finalPrice.toLocaleString("id-ID")}</span>
                        </div>
                      </div>

                      <button
                        onClick={checkout}
                        disabled={loading}
                        className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition"
                      >
                        {loading ? "Memproses..." : `Lanjut Bayar Rp${finalPrice.toLocaleString("id-ID")}`}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8">
                <Leaderboard />
              </div>
            </section>
          </>
        )}

        {panel === "chat" && <ChatPanel />}
        {panel === "voucher" && <VoucherPanel />}
        {panel === "riwayat" && <RiwayatPanel />}
        {panel === "cek" && <CekPanel />}

        <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {settings.store_name || "MeronpaiStore"}
        </footer>
      </div>
    </main>
  );
}

function Leaderboard() {
  const [leaders, setLeaders] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/leaderboard").then((r) => r.json()).then((d) => setLeaders(d.leaderboard || []));
  }, []);
  if (!leaders.length)
    return (
      <div className="bg-white/95 rounded-2xl border border-brand-100 p-6 text-center text-sm text-gray-500">
        🏆 Belum ada transaksi
      </div>
    );
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="bg-white/95 rounded-2xl border border-brand-100 overflow-hidden">
      <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-5 py-3">
        <h3 className="font-bold">🏆 Leaderboard Top Buyer</h3>
      </div>
      {leaders.map((l, i) => (
        <div key={l.username} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50">
          <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm rounded-full ${
            i < 3 ? "bg-brand-100 text-brand-700" : "bg-gray-100"
          }`}>
            {i < 3 ? medals[i] : i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{l.username}</p>
            <p className="text-[11px] text-gray-500">{l.total_orders} transaksi</p>
          </div>
          <p className="font-bold text-brand-600 text-sm">{l.total_robux.toLocaleString("id-ID")}</p>
        </div>
      ))}
    </div>
  );
}

function ChatPanel() {
  const [sid, setSid] = useState("");
  const [username, setUsername] = useState("");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);
  const initRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSid(getSessionId());
    const u = getSavedUsername();
    if (u) { setUsername(u); setStarted(true); }
  }, []);

  useEffect(() => {
    if (!started || !sid) return;
    const load = async () => {
      const d = await fetch(`/api/chat/messages?session=${sid}`).then((r) => r.json());
      const msgs = d.messages || [];
      const latest = msgs.filter((m: any) => m.direction === "out").pop();
      if (latest && latest.id !== lastRef.current) {
        if (initRef.current && lastRef.current) playNotif();
        lastRef.current = latest.id;
      }
      setMessages(msgs);
      initRef.current = true;
    };
    load();
    const i = setInterval(load, 3000);
    return () => clearInterval(i);
  }, [started, sid]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || sending) return;
    setSending(true);
    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, username, message: input.trim() }),
    });
    setInput("");
    const d = await fetch(`/api/chat/messages?session=${sid}`).then((r) => r.json());
    setMessages(d.messages || []);
    setSending(false);
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    fd.append("sessionId", sid);
    fd.append("username", username);
    fd.append("isAdmin", "false");
    await fetch("/api/chat/upload", { method: "POST", body: fd });
    const d = await fetch(`/api/chat/messages?session=${sid}`).then((r) => r.json());
    setMessages(d.messages || []);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!started) {
    return (
      <section className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-brand-100 p-8 text-center">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="text-xl font-bold mb-4">Chat Admin</h2>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username Roblox"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg mb-3 outline-none"
          />
          <button
            onClick={() => {
              if (!username.trim()) return alert("Isi username");
              saveUsername(username.trim());
              setStarted(true);
            }}
            className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl"
          >
            Mulai Chat
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-white rounded-2xl border border-brand-100 overflow-hidden flex flex-col" style={{ height: "70vh" }}>
        <div className="p-4 border-b border-brand-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold">A</div>
          <div>
            <p className="font-bold text-sm">Admin MeronpaiStore</p>
            <p className="text-xs text-green-600">● Online</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Halo {username}! Ada yang bisa dibantu?</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === "in" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl overflow-hidden text-sm ${
                m.direction === "in" ? "bg-brand-600 text-white" : "bg-gray-100"
              }`}>
                {m.attachment_url && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer">
                    <img src={m.attachment_url} className="max-w-[250px]" />
                  </a>
                )}
                {m.message && <p className="px-4 py-2 whitespace-pre-wrap">{m.message}</p>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="p-3 border-t flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadImage} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="w-11 h-11 bg-gray-100 rounded-xl text-lg">📎</button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ketik pesan..."
            className="flex-1 px-4 border border-gray-200 rounded-xl outline-none"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="bg-brand-600 text-white font-semibold px-5 rounded-xl disabled:bg-gray-300"
          >
            Kirim
          </button>
        </div>
      </div>
    </section>
  );
}

function VoucherPanel() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    fetch("/api/voucher/active").then((r) => r.json()).then((d) => setVouchers(d.vouchers || []));
  }, []);
  return (
    <section className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">🎟️ Voucher Aktif</h2>
      {vouchers.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Belum ada voucher</p>
      ) : (
        vouchers.map((v) => (
          <div key={v.code} className="bg-white rounded-xl border border-brand-100 overflow-hidden mb-3 flex">
            <div className="bg-brand-600 text-white p-4 flex flex-col items-center justify-center min-w-[100px]">
              <p className="text-2xl font-bold">
                {v.discount_type === "percent" ? `${v.discount_value}%` : `Rp${v.discount_value / 1000}k`}
              </p>
              <p className="text-[10px] uppercase">Diskon</p>
            </div>
            <div className="flex-1 p-4">
              <div className="flex justify-between mb-1">
                <p className="font-mono font-bold text-brand-600">{v.code}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(v.code);
                    setCopied(v.code);
                    setTimeout(() => setCopied(""), 1500);
                  }}
                  className="text-xs bg-brand-50 text-brand-600 px-2 py-1 rounded"
                >
                  {copied === v.code ? "✓" : "Copy"}
                </button>
              </div>
              {v.min_purchase > 0 && (
                <p className="text-xs text-gray-500">Min Rp{v.min_purchase.toLocaleString("id-ID")}</p>
              )}
              {v.max_uses && <p className="text-xs text-gray-500">Sisa: {v.max_uses - v.used_count}</p>}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function RiwayatPanel() {
  const [username, setUsername] = useState("");
  const [orders, setOrders] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!username.trim()) return alert("Isi username");
    setLoading(true);
    const d = await fetch(`/api/orders-by-username?username=${encodeURIComponent(username.trim())}`).then((r) => r.json());
    setOrders(d.orders || []);
    setLoading(false);
  }

  const colors: any = {
    pending: "bg-yellow-100",
    waiting_verification: "bg-blue-100",
    paid: "bg-green-100",
    delivered: "bg-emerald-100",
    failed: "bg-red-100",
  };

  return (
    <section className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">📜 Riwayat Pesanan</h2>
      <div className="flex gap-2 mb-6">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Username Roblox"
          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg outline-none"
        />
        <button onClick={search} disabled={loading} className="bg-brand-600 text-white px-6 rounded-lg font-semibold">
          {loading ? "..." : "Cari"}
        </button>
      </div>
      {orders?.length === 0 && <p className="text-center text-gray-500 py-12">Tidak ada pesanan</p>}
      {orders?.map((o) => (
        <a
          key={o.id}
          href={`/bayar?invoice=${o.invoice}`}
          className="block bg-white rounded-xl border border-brand-100 p-4 mb-2"
        >
          <div className="flex justify-between mb-2">
            <p className="font-mono font-semibold text-sm">{o.invoice}</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors[o.status]}`}>
              {o.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {o.robux_amount.toLocaleString("id-ID")} Robux • Rp{o.price.toLocaleString("id-ID")}
          </p>
        </a>
      ))}
    </section>
  );
}

function CekPanel() {
  const [invoice, setInvoice] = useState("");
  const router = useRouter();
  return (
    <section className="max-w-md mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold mb-6">🔍 Cek Pesanan</h2>
      <input
        value={invoice}
        onChange={(e) => setInvoice(e.target.value)}
        placeholder="MRP-..."
        className="w-full px-4 py-3 border rounded-lg mb-4 font-mono outline-none"
      />
      <button
        onClick={() => invoice.trim() && router.push(`/bayar?invoice=${invoice.trim()}`)}
        className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl"
      >
        Cari
      </button>
    </section>
  );
}
