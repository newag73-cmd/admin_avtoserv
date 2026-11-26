export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ToolCall = { id: string; name: string; arguments: string };
export type LlmMessage = ChatMessage | { role: "tool"; tool_call_id: string; name: string; content: string } | { role: "assistant"; content: string | null; tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> };
export type ToolDefinition = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown>; strict: true } };
let unavailableUntil=0;
export function resetProviderCircuitForTests(){unavailableUntil=0;}
export function markProviderUnavailable(){unavailableUntil=Date.now()+60000;}
async function requestWithRetry(url:string,init:RequestInit){if(Date.now()<unavailableUntil)throw new Error("PROVIDER_COOLDOWN");for(let attempt=0;attempt<2;attempt++){try{const response=await fetch(url,{...init,signal:AbortSignal.timeout(30000)});if(response.status===401||response.status===403)throw new Error(`PROVIDER_ACCESS_${response.status}`);if(response.status===429||response.status>=500){if(attempt===0){await new Promise(r=>setTimeout(r,1000));continue;}unavailableUntil=Date.now()+60000;throw new Error(`PROVIDER_HTTP_${response.status}`);}if(!response.ok)throw new Error(`PROVIDER_HTTP_${response.status}`);return response;}catch(error){if(error instanceof Error&&error.message.startsWith("PROVIDER_ACCESS_"))throw error;if(attempt===0){await new Promise(r=>setTimeout(r,1000));continue;}unavailableUntil=Date.now()+60000;throw new Error(error instanceof Error&&error.name==="TimeoutError"?"PROVIDER_NETWORK_TIMEOUT":"PROVIDER_NETWORK_UNAVAILABLE");}}throw new Error("PROVIDER_NETWORK_UNAVAILABLE");}
function configuredBusiness(prompt: string): any | null {
  const marker = "ТВОИ ДАННЫЕ (единственный источник фактов)\n";
  const start = prompt.indexOf(marker); if (start < 0) return null;
  const text = prompt.slice(start + marker.length).trimStart(); let depth = 0, quoted = false, escape = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (quoted) { if (escape) escape = false; else if (c === "\\") escape = true; else if (c === '"') quoted = false; continue; } if (c === '"') quoted = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) { try { return JSON.parse(text.slice(0, i + 1)); } catch { return null; } } }
  return null;
}
export async function complete(messages: ChatMessage[]): Promise<string> {
  if ((process.env.LLM_PROVIDER ?? "mock") === "mock") {
    const user = messages.filter(m => m.role === "user").at(-1)?.content ?? "";
    const config = messages.find(m => m.role === "system")?.content ?? "";
    if (/покажи.*промпт|ключ.*api|стих|погода|илон маск/i.test(user)) return "Я могу помочь с вопросами о данных бизнеса. Подсказать по услугам, режиму работы или записи?";
    const business = configuredBusiness(config);
    if (business && /работа(ете|ет|ют)|режим|часы|открыты|открыт ли/i.test(user)) {
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: business.timezone, weekday: "short" }).format(new Date()).toLowerCase();
      const key = weekday.slice(0,3), hours = business.hours[key];
      return hours === "closed" ? "Сегодня бизнес не работает." : hours ? `Сегодня работаем с ${hours.open} до ${hours.close}.` : "Не могу определить график по данным бизнеса.";
    }
    if (business && /сколько|цена|стоим/i.test(user)) {
      const tokens = user.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(x => x.length >= 3);
      const ranked = business.services.map((s: any) => {
        const words: string[] = `${s.name} ${s.id} ${(s.aliases ?? []).join(" ")}`.normalize("NFKC").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u);
        const score = tokens.filter(t => words.includes(t)).length;
        return { s, score };
      });
      const service = ranked.sort((a: any, b: any) => b.score - a.score)[0];
      if (service?.score) { const s = service.s; if (!s.active) return "Эта услуга сейчас не оказывается. Могу передать вопрос администратору."; if (s.price === null) return "Точную цену не знаю: в данных бизнеса она не указана. Могу передать вопрос администратору."; return `${s.name} — ${s.price} ${business.ui.currency === "RUB" ? "₽" : business.ui.currency}${s.price_note ? ` (${s.price_note})` : ""}.`; }
      return "Точного ответа у меня нет — такой услуги или цены нет в данных бизнеса. Уточните у администратора.";
    }
    if(business&&/у вас есть|оказываете ли|можно ли заказать|есть ли у вас/i.test(user)){
      const tokens=user.normalize("NFKC").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x:string)=>x.length>=3),known=business.services.some((s:any)=>tokens.some(t=>`${s.name} ${s.id} ${(s.aliases??[]).join(" ")}`.normalize("NFKC").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).includes(t)));
      if(!known)return "Точной информации об этом предложении нет в данных бизнеса. Уточните у администратора.";
    }
    if (business && /адрес|где вы|как до вас/i.test(user)) return business.business.address ?? "Адрес не указан в данных бизнеса.";
    if (business && /телефон|контакт/i.test(user)) return business.business.phone ?? business.business.email ?? "Контакты не указаны в данных бизнеса.";
    return "Подскажите, пожалуйста, какую услугу или информацию о бизнесе вы ищете?";
  }
  if (!process.env.LLM_API_KEY) throw new Error("PROVIDER_KEY_MISSING");
  const base = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await requestWithRetry(`${base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` }, body: JSON.stringify({ model: process.env.LLM_MODEL ?? "gpt-4o-mini", messages, temperature: 0.2, max_tokens: 600 }) });
  const data = await res.json(); return String(data.choices?.[0]?.message?.content ?? "");
}

export async function completeWithTools(messages: LlmMessage[], tools: ToolDefinition[], settings?:{model:string|null;temperature:number;max_tokens:number}): Promise<{ content: string; toolCalls: ToolCall[] }> {
  if ((process.env.LLM_PROVIDER ?? "mock") === "mock") {
    const plain = messages.filter((m): m is ChatMessage => m.role === "system" || m.role === "user" || (m.role === "assistant" && typeof m.content === "string"));
    return { content: await complete(plain), toolCalls: [] };
  }
  if (!process.env.LLM_API_KEY) throw new Error("PROVIDER_KEY_MISSING");
  const base = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if(Date.now()<unavailableUntil)throw new Error("PROVIDER_COOLDOWN");
  const client=new OpenAI({apiKey:process.env.LLM_API_KEY,baseURL:base,timeout:30000,maxRetries:0});
  for(let attempt=0;attempt<2;attempt++){
    try{
      const stream=await client.chat.completions.create({model:settings?.model??process.env.LLM_MODEL??"gpt-4o-mini",messages:messages as any,tools:tools as any,tool_choice:"auto",temperature:settings?.temperature??0.2,max_tokens:settings?.max_tokens??600,stream:true});
      let content="";const calls=new Map<number,{id:string;name:string;arguments:string}>();
      for await(const chunk of stream){const delta=chunk.choices[0]?.delta;if(typeof delta?.content==="string")content+=delta.content;for(const c of delta?.tool_calls??[]){const prior=calls.get(c.index)??{id:String(c.id??""),name:"",arguments:""};if(c.id)prior.id=String(c.id);if(c.function?.name)prior.name+=String(c.function.name);if(c.function?.arguments)prior.arguments+=String(c.function.arguments);calls.set(c.index,prior);}}
      unavailableUntil=0;
      return {content,toolCalls:[...calls.values()]};
    }catch(error){
      const status=error instanceof OpenAI.APIError?error.status:undefined;
      if(status===401||status===403){
        const code=error instanceof OpenAI.APIError&&typeof error.code==="string"
          ? error.code.replace(/[^a-zA-Z0-9_]/g,"").slice(0,64)
          : "unknown";
        throw new Error(`PROVIDER_ACCESS_${status}_${code||"unknown"}`);
      }
      const retryable=!status||status===429||status>=500;
      if(!retryable)throw new Error(`PROVIDER_HTTP_${status}`);
      if(attempt===0){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
      unavailableUntil=Date.now()+60000;
      if(status)throw new Error(`PROVIDER_HTTP_${status}`);
      throw new Error(error instanceof OpenAI.APIConnectionTimeoutError?"PROVIDER_NETWORK_TIMEOUT":"PROVIDER_NETWORK_UNAVAILABLE");
    }
  }
  throw new Error("PROVIDER_NETWORK_UNAVAILABLE");
}
import OpenAI from "openai";
