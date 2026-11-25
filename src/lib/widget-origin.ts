import type { NextRequest } from "next/server";
import { sameOriginMutation } from "./csrf";

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.origin : null;
  } catch { return null; }
}

export function widgetCors(req: NextRequest): Record<string, string> {
  const raw = req.headers.get("origin");
  if (!raw) return {};
  const origin = normalizeOrigin(raw);
  if (!origin) return {};
  const allowed = [process.env.ALLOWED_ORIGINS ?? "http://localhost:3000", process.env.APP_BASE_URL ?? ""]
    .flatMap(value => value.split(",")).map(value => normalizeOrigin(value.trim()));
  // A widget served by this instance may call its own API through a reverse
  // proxy. External embedding domains still require the explicit allowlist.
  return allowed.includes(origin) || sameOriginMutation(req)
    ? { "access-control-allow-origin": raw, vary: "Origin" } : {};
}
