"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function BayarPage() {
  const [invoice, setInvoice] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const inv = new URLSearchParams(window.location.search).get("invoice") || "";
    setInvoice(inv);
    if (inv) {
      fetch(`/api/order/${inv}`)
        .then((r) => r.json())
        .then((d) => setOrder(d.order))
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(f);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("invoice", invoice);
    await fetch("/api/upload", { method: "POST", body: fd });
    const d = await fetch(`/api/order/${invoice}`).then((x) => x.json());
    setOrder(d.order);
    setUploading(false);
    alert("Bukti terkirim!");
  }

  if (loading)
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!order)
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p>Order tidak ditemukan</p>
        <Link href="/" className="text-brand-600">← Kembali</Link>
      </div>
    );

  const total = order.total_amount || order.price;
  const isPaid = order.status === "paid" || order.status === "delivered";
  const isWait = order.status === "waiting_verification";

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm text-brand-600 mb-4 inline-block">← Kembali</Link>

        <div className="bg-white rounded-2xl border border-brand-100 p-6">
          <h1 className="text-2xl font-bold mb-1">Pembayaran QRIS</h1>
          <p className="text-gray-600 text-sm mb-6">Scan QR — nominal otomatis terisi</p>

          <div className="bg-brand-50 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500">Invoice</p>
            <p className="font-mono font-semibold">{order.invoice}</p>
          </div>

          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">Total Transfer</p>
            <p className="text-3xl font-bold text-brand-600">Rp{total.toLocaleString("id-ID")}</p>
          </div>

          {!isPaid && (
            <div className="mb-6">
              <div className="bg-white rounded-xl border-2 border-gray-200 p-3">
                <img src={`/api/qris/${invoice}`} alt="QRIS" className="w-full rounded-lg" />
              </div>
              <a
                href={`/api/qris/${invoice}`}
                download={`QRIS-${order.invoice}.png`}
                className="mt-3 block text-center bg-brand-600 text-white font-semibold py-3 rounded-xl"
              >
                📥 Download QR
              </a>
              <p className="text-xs text-gray-500 text-center mt-2">
                Scan pakai e-wallet atau m-banking apapun
              </p>
            </div>
          )}

          {isPaid ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-800 font-semibold">
              ✅ Pembayaran sudah diverifikasi
            </div>
          ) : isWait ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center text-blue-800 font-semibold">
              ⏳ Menunggu verifikasi admin
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm font-medium mb-2">Upload Bukti Transfer</p>
              <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" />
              {preview ? (
                <img src={preview} className="w-full rounded-lg" />
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-brand-500 rounded-xl py-8 text-gray-500"
                >
                  📤 {uploading ? "Uploading..." : "Pilih Gambar"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-brand-100 p-6 mt-4">
          <h2 className="font-bold mb-4">Detail Pesanan</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Metode</span>
              <span className="capitalize">{order.method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Username</span>
              <span>{order.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Robux</span>
              <span>{order.robux_amount.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
