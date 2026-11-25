import { NextRequest } from "next/server";
import { z } from "zod";
import { completeWithTools, markProviderUnavailable, type LlmMessage } from "@/lib/llm";
import { db } from "@/lib/db";
import { fallbackMessage, getBusinessConfig, getSystemPrompt } from "@/lib/config";
import { buildSystemPrompt } from "@/lib/prompt";
import { executeTool, toolDefinitions } from "@/lib/tools";
import { rateLimited } from "@/lib/rate-limit";
import { widgetCors } from "@/lib/widget-origin";

const words=(value:string)=>value.normalize("NFKC").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word=>word.length>=3);
function matchedService<T extends {name:string;id:string;aliases:string[]}>(message:string,services:T[]):T|null{
  const terms=words(message),vocabulary=services.map(s=>new Set(words(`${s.name} ${(s.aliases??[]).join(" ")}`)));
  const frequency=new Map<string,number>();for(const set of vocabulary)for(const word of set)frequency.set(word,(frequency.get(word)??0)+1);
  const ranked=services.map((service,index)=>({service,score:terms.filter(word=>vocabulary[index].has(word)&&frequency.get(word)===1).length})).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score?ranked[0].service:null;
}

const bodySchema = z.object({ sessionId: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/, "ID сессии: только латиница, цифры, дефис и подчёркивание"), message: z.string().min(1).max(1000) });
const maskPhones = (s: string) => s.replace(/(?:\+?\d[\s().-]*){10,15}/g, value => `${"*".repeat(Math.max(0, value.replace(/\D/g, "").length - 4))}${value.replace(/\D/g, "").slice(-4)}`);
export async function OPTIONS(req: NextRequest) { const headers = widgetCors(req); return new Response(null, { status: Object.keys(headers).length ? 204 : 403, headers: { ...headers, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } }); }
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin"), corsHeaders = widgetCors(req);
  if (origin && !Object.keys(corsHeaders).length) return Response.json({ error: "Origin is not allowed" }, { status: 403 });
  const raw=await req.json().catch(()=>null);const parsed = bodySchema.safeParse(raw); if (!parsed.success) return Response.json({ error: typeof raw?.sessionId==="string"&&!/^[A-Za-z0-9_-]{8,100}$/.test(raw.sessionId)?"Недопустимый ID сессии: используйте латиницу, цифры, дефис и подчёркивание.":"Некорректное сообщение" }, { status: 400,headers:corsHeaders });
  const { sessionId, message } = parsed.data, ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (rateLimited(`s:${sessionId}`,20,60000) || rateLimited(`i:${ip}`,20,60000)) return Response.json({ error: "Слишком много сообщений. Попробуйте через минуту." }, { status: 429,headers:corsHeaders });
  try {
    const config = await getBusinessConfig(), template = await getSystemPrompt();
    const conversation = await db.conversation.upsert({ where: { sessionId }, create: { sessionId }, update: {} });
    await db.message.create({ data: { conversationId: conversation.id, role: "user", content: maskPhones(message) } });
    const previous = await db.message.findMany({ where: { conversationId: conversation.id, role: { in: ["user", "assistant"] } }, orderBy: { createdAt: "desc" }, take: config.assistant_settings.context_messages });
    const system = buildSystemPrompt(template, config);
    const llmMessages:LlmMessage[]=[{role:"system",content:system},...previous.reverse().map(m=>({role:m.role as "user"|"assistant",content:m.content}))];
    let answer="", refusal=false, iterations=0, toolCount=0;
    if(config.assistant_settings.escalation_only){answer=fallbackMessage(config);refusal=true;await db.lead.create({data:{reason:"client_request",summary:maskPhones(message).slice(0,500)}});await db.conversation.update({where:{id:conversation.id},data:{escalated:true}});}
    while(!answer&&iterations<5){
      iterations++;
      let result;try{result=await completeWithTools(llmMessages,toolDefinitions,config.assistant_settings);}catch(error){console.error("model_unavailable",error instanceof Error?error.message:"unknown");answer=offlineAnswer(message,config);refusal=true;await db.lead.create({data:{reason:"no_data",summary:maskPhones(message).slice(0,500)}});await db.conversation.update({where:{id:conversation.id},data:{escalated:true}});break;}
      if(!result.toolCalls.length){answer=result.content;break;}
      const calls=result.toolCalls.slice(0,5-toolCount);toolCount+=calls.length;
      const assistantToolMessage={role:"assistant" as const,content:result.content||null,tool_calls:calls.map(c=>({id:c.id,type:"function" as const,function:{name:c.name,arguments:c.arguments}}))};
      llmMessages.push(assistantToolMessage);
      for(const call of calls){
        let content:string;
        try{content=JSON.stringify(await executeTool(call.name,call.arguments));}
        catch(e){content=JSON.stringify({error:e instanceof Error?e.message:"Tool execution failed"});}
        await db.message.create({data:{conversationId:conversation.id,role:"tool",toolName:call.name,content:content.slice(0,5000)}});
        if(call.name==="escalate"&&!content.includes('"error"')){try{const args=JSON.parse(call.arguments);if(args.reason!=="out_of_scope")await db.conversation.update({where:{id:conversation.id},data:{escalated:true}});}catch{}}
        llmMessages.push({role:"tool",tool_call_id:call.id,name:call.name,content});
      }
      if(toolCount>=5)break;
    }
    if (!answer.trim()) { console.error("model_empty_response");markProviderUnavailable();answer = offlineAnswer(message,config); refusal = true; await db.lead.create({data:{reason:"no_data",summary:maskPhones(message).slice(0,500)}});await db.conversation.update({where:{id:conversation.id},data:{escalated:true}}); }
    else if (/не могу помочь|нет данных|не знаю|не располагаю|точного ответа нет|точной информации|я могу помочь с вопросами о данных бизнеса/i.test(answer)) { const hasNoData=/не могу помочь|нет данных|не знаю|не располагаю|точного ответа нет|точной информации/i.test(answer);answer = fallbackMessage(config); refusal = true;if(hasNoData){await db.lead.create({data:{reason:"no_data",summary:maskPhones(message).slice(0,500)}});await db.conversation.update({where:{id:conversation.id},data:{escalated:true}});} }
    if (/скидк|гаранти|претензи|юридическ|сч[её]т/i.test(message) || config.escalation.always_human.some(term => message.toLowerCase().includes(term.toLowerCase()))) {
      answer = fallbackMessage(config); refusal = true;
      await db.lead.create({ data: { reason: "no_data", summary: maskPhones(message).slice(0, 500) } }); await db.conversation.update({ where: { id: conversation.id }, data: { escalated: true } });
    }
    if (/покажи.*(промпт|настройк)|ключ.*api/i.test(message)) { answer = "Не могу раскрывать внутренние настройки. Могу помочь с вопросами об услугах, часах работы и записи."; refusal = true; }
    if (answer.includes("<script") || /api_key|sk-[a-z0-9]{10,}/i.test(answer) || answer.includes(template.trim()) || (process.env.LLM_API_KEY&&answer.includes(process.env.LLM_API_KEY))) { answer = fallbackMessage(config); refusal = true; }
    const requested=/сколько|цена|стоим/i.test(message)?matchedService(message,config.services):null;
    if(/сколько|цена|стоим/i.test(message)&&!requested){answer=fallbackMessage(config);refusal=true;}
    const mentioned=config.services.find(s=>answer.toLocaleLowerCase().includes(s.name.toLocaleLowerCase())||message.toLocaleLowerCase().includes(s.name.toLocaleLowerCase()));
    if(requested&&mentioned&&requested.id!==mentioned.id){answer=fallbackMessage(config);refusal=true;}
    const amounts=[...answer.matchAll(/(?:\d[\d\s]*)(?:₽|руб(?:\.|лей)?)/gi)].map(m=>Number(m[0].replace(/\D/g,"")));
    if(mentioned&&amounts.length&&(mentioned.price===null||amounts.some(n=>n!==mentioned.price))){
      if(mentioned.price===null){answer=fallbackMessage(config);refusal=true;}
      else answer=`${mentioned.name} — ${mentioned.price} ₽${mentioned.price_note?` (${mentioned.price_note})`:""}.`;
      await db.message.create({data:{conversationId:conversation.id,role:"tool",toolName:"price_mismatch",content:"A model price was corrected against the business configuration."}});
    }
    await db.message.create({ data: { conversationId: conversation.id, role: "assistant", content: answer, refusal } });
    const stream = new ReadableStream({ async start(controller) { const encoder = new TextEncoder(); for (let i = 0; i < answer.length; i += 24) { controller.enqueue(encoder.encode(answer.slice(i, i + 24)));if(i+24<answer.length)await new Promise(resolve=>setTimeout(resolve,18)); } controller.close(); } });
    return new Response(stream, { headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering":"no", "x-session-id": sessionId } });
  } catch (e) { console.error("chat request failed", e instanceof Error ? e.message : "unknown");const config=await getBusinessConfig().catch(()=>null);return Response.json({ error: config?fallbackMessage(config):"Свяжитесь с администратором бизнеса." }, { status: 200, headers: corsHeaders }); }
}
function offlineAnswer(message:string,c:any):string{const q=message.normalize("NFKC").toLocaleLowerCase();if(/сколько|цена|стоим/i.test(q)){const s=matchedService(message,c.services as Array<{name:string;id:string;aliases:string[];active:boolean;price:number|null;price_note?:string|null}>);if(!s||!s.active||s.price===null)return fallbackMessage(c);return `${s.name} — ${s.price} ₽${s.price_note?` (${s.price_note})`:""}.`;}if(/адрес|где вы|как до вас/i.test(q)&&c.business.address)return c.business.address;if(/телефон|контакт/i.test(q)&&(c.business.phone||c.business.email))return [c.business.phone,c.business.email].filter(Boolean).join(", ");if(/работа|режим|часы|открыт/i.test(q)){const day=new Intl.DateTimeFormat("en-US",{timeZone:c.timezone,weekday:"short"}).format(new Date()).toLowerCase().slice(0,3),h=c.hours[day];return h==="closed"?"Сегодня не работаем.":h?`Сегодня работаем с ${h.open} до ${h.close}.`:fallbackMessage(c);}return fallbackMessage(c);}
