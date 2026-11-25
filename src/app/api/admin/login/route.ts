import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, makeSession } from "@/lib/auth";
import { sameOriginMutation } from "@/lib/csrf";
const attempts = new Map<string, { count: number; since: number }>();
export async function POST(req: NextRequest) {
  if(!sameOriginMutation(req))return Response.json({error:"Cross-origin request denied"},{status:403});
  const data = z.object({ username: z.string(), password: z.string() }).safeParse(await req.json().catch(() => null)); if (!data.success) return Response.json({ error: "Введите логин и пароль" }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for") ?? "local", a = attempts.get(ip), now = Date.now(); if (a && a.count >= 5 && now - a.since < 900000) return Response.json({ error: "Слишком много попыток. Повторите через 15 минут." }, { status: 429 });
  if (!await authenticate(data.data.username, data.data.password)) { const active=a&&now-a.since<900000; attempts.set(ip, { count: (active ? a.count : 0) + 1, since: active ? a.since : now }); return Response.json({ error: "Неверный логин или пароль" }, { status: 401 }); }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  const forwardedProtocol = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProtocol ? forwardedProtocol === "https" : req.nextUrl.protocol === "https:";
  res.cookies.set("admin_session", await makeSession(), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 28800 });
  return res;
}
