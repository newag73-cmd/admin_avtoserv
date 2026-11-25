import {afterEach,describe,expect,it,vi} from "vitest";
import {completeWithTools,resetProviderCircuitForTests} from "./llm";

const messages=[{role:"system" as const,content:"system"},{role:"user" as const,content:"hello"}];
const ok=()=>new Response("data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\ndata: [DONE]\n\n",{status:200});
describe("provider retry and circuit breaker",()=>{
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();resetProviderCircuitForTests();process.env.LLM_PROVIDER="mock";});
  it("retries once after 429 and then returns the model response",async()=>{vi.useFakeTimers();process.env.LLM_PROVIDER="openai";process.env.LLM_API_KEY="test";const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response("",{status:429})).mockImplementationOnce(async()=>ok());const pending=completeWithTools(messages,[]);await vi.advanceTimersByTimeAsync(1000);await expect(pending).resolves.toMatchObject({content:"ok"});expect(fetcher).toHaveBeenCalledTimes(2);});
  it("opens a one-minute cooldown after repeated provider failures",async()=>{vi.useFakeTimers();process.env.LLM_PROVIDER="openai";process.env.LLM_API_KEY="test";const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("",{status:503}));const pending=completeWithTools(messages,[]);const assertion=expect(pending).rejects.toThrow("PROVIDER_NETWORK_UNAVAILABLE");await vi.advanceTimersByTimeAsync(1000);await assertion;await expect(completeWithTools(messages,[])).rejects.toThrow("PROVIDER_COOLDOWN");expect(fetcher).toHaveBeenCalledTimes(2);});
});
