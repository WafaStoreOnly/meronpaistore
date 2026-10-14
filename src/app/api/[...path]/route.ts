import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { sb, genDynamicQRIS, validateVoucher, QRIS_STATIC, getSettings } from "@/lib/lib";

const isAdmin = (r: NextRequest) => r.headers.get("x-admin-key") === process.env.ADMIN_KEY;

// ============ GET ============
export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const p = params.path || [];
  const route = p.join("/");
  const url = new URL(req.url);

  // GET /api/settings
  if (route === "settings") {
    const s = await getSettings();
    return NextResponse.json({ settings: s });
  }

  // GET /api/leaderboard
  if (route === "leaderboard") {
    const { data } = await sb.from("orders").select("username, robux_amount").in("status", ["paid", "delivered"]);
    const map = new Map<string, any>();
    for (const o of data || []) {
      const k = o.username.toLowerCase();
      const c = map.get(k) || { username: o.username, total_robux: 0, total_orders: 0 };
      c.total_robux += o.robux_amount;
      c.total_orders += 1;
      map.set(k, c);
    }
    const top = Array.from(map.values())
      .sort((a, b) => b.total_robux - a.total_robux)
      .slice(0, 10);
    return NextResponse.json({ leaderboard: top });
  }

  // GET /api/voucher/active
  if (route === "voucher/active") {
    const now = new Date().toISOString();
    const { data } = await sb
      .from("vouchers")
      .select("*")
      .eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false });
    return NextResponse.json({ vouchers: data || [] });
  }

  // GET /api/order/[invoice]
  if (p[0] === "order" && p[1]) {
    const { data } = await sb.from("orders").select("*").eq("invoice", p[1]).single();
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ order: data });
  }

  // GET /api/orders-by-username?username=xxx
  if (route === "orders-by-username") {
    const u = url.searchParams.get("username");
    if (!u) return NextResponse.json({ error: "username wajib" }, { status: 400 });
    const { data } = await sb
      .from("orders")
      .select("*")
      .ilike("username", u)
      .order("created_at", { ascending: false })
      .limit(50);
    return NextResponse.json({ orders: data || [] });
  }

  // GET /api/qris/[invoice]
  if (p[0] === "qris" && p[1]) {
    const { data: o } = await sb
      .from("orders")
      .select("total_amount, price, invoice")
      .eq("invoice", p[1])
      .single();
    if (!o) return new NextResponse("Not found", { status: 404 });

    const amount = o.total_amount || o.price;
    const dynamic = genDynamicQRIS(QRIS_STATIC, amount);

    const buf = await QRCode.toBuffer(dynamic, {
      type: "png",
      width: 700,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    return new NextResponse(buf as any, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // GET /api/chat/messages?session=xxx
  if (route === "chat/messages") {
    const s = url.searchParams.get("session");
    if (!s) return NextResponse.json({ error: "session wajib" }, { status: 400 });
    const { data } = await sb
      .from("chats")
      .select("*")
      .eq("session_id", s)
      .order("created_at");
    await sb
      .from("chats")
      .update({ read: true })
      .eq("session_id", s)
      .eq("direction", "out")
      .eq("read", false);
    return NextResponse.json({ messages: data || [] });
  }

  // GET /api/chat/unread-count
  if (route === "chat/unread-count") {
    if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { count } = await sb
      .from("chats")
      .select("*", { count: "exact", head: true })
      .eq("direction", "in")
      .eq("read", false);
    return NextResponse.json({ count: count || 0 });
  }

  // GET /api/admin/orders
  if (route === "admin/orders") {
    if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data } = await sb
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return NextResponse.json({ orders: data || [] });
  }

  // GET /api/admin/voucher
  if (route === "admin/voucher") {
    if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data } = await sb
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false });
    return NextResponse.json({ vouchers: data || [] });
  }

  // GET /api/admin/chat atau ?session=xxx
  if (route === "admin/chat") {
    if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const s = url.searchParams.get("session");
    if (s) {
      const { data } = await sb
        .from("chats")
        .select("*")
        .eq("session_id", s)
        .order("created_at");
      await sb
        .from("chats")
        .update({ read: true })
        .eq("session_id", s)
        .eq("direction", "in")
        .eq("read", false);
      return NextResponse.json({ messages: data || [] });
    }
    const { data } = await sb
      .from("chats")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    const map = new Map<string, any>();
    for (const c of data || []) {
      if (!map.has(c.session_id)) {
        map.set(c.session_id, {
          session_id: c.session_id,
          username: c.username,
          last_message: c.message || "📷 Gambar",
          last_direction: c.direction,
          last_at: c.created_at,
          unread: 0,
        });
      }
      if (c.direction === "in" && !c.read) map.get(c.session_id).unread += 1;
    }
    return NextResponse.json({ sessions: Array.from(map.values()) });
  }

  return NextResponse.json({ error: "Not found", route }, { status: 404 });
}

// ============ POST ============
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const route = (params.path || []).join("/");

  // POST /api/order
  if (route === "order") {
    const b = await req.json();
    if (!b.username || !b.robuxAmount || !b.price || !b.method)
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });

    let discount = 0;
    let finalPrice = b.price;
    let usedVoucher: string | null = null;

    if (b.voucherCode) {
      const r = await validateVoucher(b.voucherCode, b.price);
      if (!r.valid) return NextResponse.json({ error: r.error }, { status: 400 });
      discount = r.discount!;
      finalPrice = Math.max(0, b.price - discount);
      usedVoucher = r.code!;
    }

    const invoice = `MRP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const { data: order, error } = await sb
      .from("orders")
      .insert({
        invoice,
        method: b.method,
        username: b.username,
        robux_amount: b.robuxAmount,
        original_price: b.price,
        discount,
        price: finalPrice,
        unique_code: 0,
        total_amount: finalPrice,
        voucher_code: usedVoucher,
        gamepass_link: b.gamepassLink || null,
        item_name: b.itemName || null,
        private_server_link: b.privateServerLink || null,
        status: "pending",
      })
      .select()
      .single();

    if (error || !order)
      return NextResponse.json({ error: error?.message || "Gagal simpan" }, { status: 500 });

    if (usedVoucher) {
      const { data: v } = await sb.from("vouchers").select("id, used_count").eq("code", usedVoucher).single();
      if (v)
        await sb
          .from("vouchers")
          .update({ used_count: (v.used_count || 0) + 1 })
          .eq("id", v.id);
    }

    return NextResponse.json({ invoice, id: order.id });
  }

  // POST /api/voucher/validate
  if (route === "voucher/validate") {
    const { code, price } = await req.json();
    const r = await validateVoucher(code, price);
    return NextResponse.json(r);
  }

  // POST /api/upload — bukti transfer
  if (route === "upload") {
    const fd = await req.formData();
    const file = fd.get("file") as File;
    const invoice = fd.get("invoice") as string;
    if (!file || !invoice) return NextResponse.json({ error: "Data kurang" }, { status: 400 });

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${invoice}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error } = await sb.storage
      .from("proofs")
      .upload(filename, buf, { contentType: file.type, upsert: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: u } = sb.storage.from("proofs").getPublicUrl(filename);
    await sb
      .from("orders")
      .update({ proof_url: u.publicUrl, status: "waiting_verification" })
      .eq("invoice", invoice);

    return NextResponse.json({ proofUrl: u.publicUrl });
  }

  // POST /api/chat/send
  if (route === "chat/send") {
    const { sessionId, username, message } = await req.json();
    if (!sessionId || !message)
      return NextResponse.json({ error: "Data kurang" }, { status: 400 });
    const { data } = await sb
      .from("chats")
      .insert({
        session_id: sessionId,
        username: username || null,
        direction: "in",
        message,
      })
      .select()
      .single();
    return NextResponse.json({ ok: true, message: data });
  }

  // POST /api/chat/upload — gambar di chat
  if (route === "chat/upload") {
    const fd = await req.formData();
    const file = fd.get("file") as File;
    const sessionId = fd.get("sessionId") as string;
    const username = fd.get("username") as string;
    const admin = fd.get("isAdmin") === "true";
    if (admin && !isAdmin(req))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!file || !sessionId)
      return NextResponse.json({ error: "Data kurang" }, { status: 400 });

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `chat/${sessionId}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    await sb.storage.from("chat-images").upload(filename, buf, { contentType: file.type });
    const { data: u } = sb.storage.from("chat-images").getPublicUrl(filename);

    const { data } = await sb
      .from("chats")
      .insert({
        session_id: sessionId,
        username: admin ? null : username || null,
        direction: admin ? "out" : "in",
        message: "",
        attachment_url: u.publicUrl,
        attachment_type: "image",
      })
      .select()
      .single();
    return NextResponse.json({ ok: true, message: data });
  }

  // POST /api/admin/chat — balas admin
  if (route === "admin/chat") {
    if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { sessionId, message } = await req.json();
    if (!sessionId || !message)
      return NextResponse.json({ error: "Data kurang" }, { status: 400 });
    await sb.from("chats").insert({ session_id: sessionId, direction: "out", message });
    return NextResponse.json({ ok: true });
  }

  // POST /api/admin/voucher — bikin voucher
  if (route === "admin/voucher") {
    if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const b = await req.json();
    const { error } = await sb.from("vouchers").insert({
      code: b.code.toUpperCase(),
      discount_type: b.discount_type,
      discount_value: parseInt(b.discount_value),
      min_purchase: parseInt(b.min_purchase) || 0,
      max_uses: b.max_uses ? parseInt(b.max_uses) : null,
      expires_at: b.expires_at || null,
      active: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found", route }, { status: 404 });
}

// ============ PATCH ============
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const route = (params.path || []).join("/");
  const b = await req.json();

  if (route === "admin/orders") {
    const updates: any = { status: b.status };
    if (b.status === "paid") updates.paid_at = new Date().toISOString();
    if (b.status === "delivered") updates.delivered_at = new Date().toISOString();
    await sb.from("orders").update(updates).eq("invoice", b.invoice);
    return NextResponse.json({ ok: true });
  }

  if (route === "admin/voucher") {
    await sb.from("vouchers").update({ active: b.active }).eq("id", b.id);
    return NextResponse.json({ ok: true });
  }

  if (route === "settings") {
    const rows = Object.entries(b).map(([k, v]) => ({
      key: k,
      value: String(v),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await sb.from("settings").upsert(rows, { onConflict: "key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found", route }, { status: 404 });
}

// ============ DELETE ============
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  await sb.from("vouchers").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
