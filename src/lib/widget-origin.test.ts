import { afterEach, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { widgetCors } from "./widget-origin";
const previous=process.env.ALLOWED_ORIGINS;
afterEach(()=>{if(previous===undefined)delete process.env.ALLOWED_ORIGINS;else process.env.ALLOWED_ORIGINS=previous;});
it("accepts same-origin Tailscale HTTPS requests behind the proxy",()=>{
  process.env.ALLOWED_ORIGINS="http://localhost:3000";
  const req=new NextRequest("http://localhost:3000/api/chat",{headers:{origin:"https://nas.tailb7a359.ts.net:8443",host:"nas.tailb7a359.ts.net:8443","x-forwarded-proto":"https"}});
  expect(widgetCors(req)["access-control-allow-origin"]).toBe("https://nas.tailb7a359.ts.net:8443");
});
it("accepts the same instance via its Tailscale IP",()=>{
  process.env.ALLOWED_ORIGINS="http://localhost:3000";
  const req=new NextRequest("http://100.127.230.93:3000/api/chat",{headers:{origin:"http://100.127.230.93:3000",host:"100.127.230.93:3000"}});
  expect(widgetCors(req)["access-control-allow-origin"]).toBe("http://100.127.230.93:3000");
});
it("denies unrelated external embedding domains",()=>{
  process.env.ALLOWED_ORIGINS="http://localhost:3000";
  const req=new NextRequest("http://localhost:3000/api/chat",{headers:{origin:"https://untrusted.example",host:"localhost:3000"}});
  expect(widgetCors(req)).toEqual({});
});
