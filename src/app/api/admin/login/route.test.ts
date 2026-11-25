import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { POST } from "./route";

describe("admin login cookie", () => {
  let dataDir = "";
  const previous = {
    dataDir: process.env.DATA_DIR,
    password: process.env.ADMIN_PASSWORD,
    username: process.env.ADMIN_USERNAME,
  };

  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
    if (previous.dataDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous.dataDir;
    if (previous.password === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous.password;
    if (previous.username === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = previous.username;
  });

  it("allows the session cookie over the LAN HTTP address", async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "admin-login-http-"));
    process.env.DATA_DIR = dataDir;
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "test-admin-password";
    const request = new NextRequest("http://192.168.1.50:3000/api/admin/login", {
      method: "POST",
      headers: { origin: "http://192.168.1.50:3000", host: "192.168.1.50:3000", "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "test-admin-password" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("admin_session=");
    expect(response.headers.get("set-cookie")?.toLowerCase()).not.toContain("secure");
  });

  it("keeps the session cookie secure behind the Tailscale HTTPS proxy", async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "admin-login-https-"));
    process.env.DATA_DIR = dataDir;
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "test-admin-password";
    const request = new NextRequest("http://localhost:3000/api/admin/login", {
      method: "POST",
      headers: { origin: "https://nas.tailb7a359.ts.net:8443", host: "localhost:3000", "x-forwarded-host": "nas.tailb7a359.ts.net:8443", "x-forwarded-proto": "https", "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "test-admin-password" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("secure");
  });
});
