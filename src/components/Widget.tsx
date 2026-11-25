"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import MessageBody from "./MessageBody";
import {widgetText} from "@/lib/i18n";
type Msg = { role: "assistant" | "user"; content: string };
type WidgetConfig = { title: string; button_label: string; accent_color: string; position:string; currency?:string; avatar_url?:string; greeting: string; quick_replies: string[] };
type Service = { id: string; name: string; price: number | null; price_note?: string | null };
type Slot = { start: string; end: string };
function businessDate(timezone:string,daysAhead:number){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(Date.now()+daysAhead*86400000));return `${parts.find(p=>p.type==="year")?.value}-${parts.find(p=>p.type==="month")?.value}-${parts.find(p=>p.type==="day")?.value}`;}
function createSessionId(){return globalThis.crypto?.randomUUID?.()??`session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}

export default function Widget({ embedded = false }: { embedded?: boolean }) {
  const [config,setConfig]=useState<WidgetConfig|null>(null),[enabled,setEnabled]=useState(true),[locale,setLocale]=useState("ru-RU"),[timezone,setTimezone]=useState("Europe/Moscow"),[services,setServices]=useState<Service[]>([]);
  const [open,setOpen]=useState(embedded),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[session,setSession]=useState(""),[messages,setMessages]=useState<Msg[]>([]);
  const [bookingOpen,setBookingOpen]=useState(false),[serviceId,setServiceId]=useState(""),[date,setDate]=useState(""),[slots,setSlots]=useState<Slot[]>([]),[slotsLoading,setSlotsLoading]=useState(false),[slot,setSlot]=useState(""),[clientName,setClientName]=useState(""),[clientPhone,setClientPhone]=useState(""),[clientEmail,setClientEmail]=useState(""),[bookingMessage,setBookingMessage]=useState("");
  const [bookingConfirmation,setBookingConfirmation]=useState<{id:string;text:string}|null>(null);
  const [slotsError,setSlotsError]=useState(false),[slotsRetry,setSlotsRetry]=useState(0);
  const [serviceMenuOpen,setServiceMenuOpen]=useState(false);
  const [lookupOpen,setLookupOpen]=useState(false),[lookupPhone,setLookupPhone]=useState(""),[lookupId,setLookupId]=useState(""),[lookupMessage,setLookupMessage]=useState("");
  const end=useRef<HTMLDivElement>(null),field=useRef<HTMLTextAreaElement>(null),bookingField=useRef<HTMLButtonElement>(null),lookupField=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const storageKey=new URLSearchParams(window.location.search).get("admin_test")==="1"?"ai-admin-test-session":"ai-admin-session";
    const sid=localStorage.getItem(storageKey)??createSessionId();localStorage.setItem(storageKey,sid);setSession(sid);
    const stored=localStorage.getItem(`ai-admin-history:${sid}`);if(stored){try{setMessages(JSON.parse(stored));}catch{localStorage.removeItem(`ai-admin-history:${sid}`);}}
    fetch("/api/widget-config").then(r=>r.json()).then(d=>{const tz=d.timezone??"Europe/Moscow";setConfig({...d.widget,currency:d.currency});setLocale(d.locale??"ru-RU");setTimezone(tz);setDate(businessDate(tz,1));setEnabled(d.enabled!==false);setServices(d.services??[]);setServiceId(d.services?.[0]?.id??"");}).catch(()=>setConfig({title:"Администратор",button_label:"Задать вопрос",accent_color:"#7845bd",position:"bottom-right",currency:"RUB",greeting:"Здравствуйте! Чем могу помочь?",quick_replies:[]}));
  },[]);
  useEffect(()=>{if(session&&messages.length)localStorage.setItem(`ai-admin-history:${session}`,JSON.stringify(messages));end.current?.scrollIntoView({behavior:"smooth"});},[messages,session]);
  useEffect(()=>{if(!open)return;if(bookingOpen)bookingField.current?.focus();else if(lookupOpen)lookupField.current?.focus();else field.current?.focus();},[open,bookingOpen,lookupOpen]);
  function close(){if(embedded&&window.parent!==window)window.parent.postMessage({type:"ai-business-widget-close"},"*");else setOpen(false);}
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[embedded]);
  useEffect(()=>{
    if(!bookingOpen||!serviceId||!date)return;
    const controller=new AbortController();
    setSlot("");setSlots([]);setSlotsError(false);setSlotsLoading(true);
    async function loadSlots(){
      for(let attempt=0;attempt<2;attempt++){
        try{
          const response=await fetch(`/api/booking?service_id=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,{signal:controller.signal,cache:"no-store"});
          if(!response.ok)throw new Error(`Slots request failed: ${response.status}`);
          const data=await response.json();
          if(!Array.isArray(data.slots))throw new Error("Invalid slots response");
          if(!controller.signal.aborted){setSlots(data.slots);setSlotsError(false);}
          break;
        }catch{
          if(controller.signal.aborted)break;
          if(attempt===0){await new Promise(resolve=>setTimeout(resolve,800));continue;}
          setSlotsError(true);
        }
      }
      if(!controller.signal.aborted)setSlotsLoading(false);
    }
    void loadSlots();
    return()=>controller.abort();
  },[bookingOpen,serviceId,date,slotsRetry]);
  async function send(text=input){if(!text.trim()||busy||!session)return;setInput("");setError("");if(/запиши|запишите|записаться|записать|запись на|заброн|брон/i.test(text)){setBookingOpen(true);setLookupOpen(false);if(/завтра/i.test(text))setDate(businessDate(timezone,1));else if(/сегодня/i.test(text))setDate(businessDate(timezone,0));const words=text.toLocaleLowerCase().match(/\p{L}{5,}/gu)??[];const ranked=services.map(s=>({service:s,score:words.filter(w=>(s.name.toLocaleLowerCase().match(/\p{L}{5,}/gu)??[]).some(sw=>sw.slice(0,5)===w.slice(0,5))).length})).sort((a,b)=>b.score-a.score);if(ranked[0]?.score)setServiceId(ranked[0].service.id);}setMessages(prev=>[...prev,{role:"user",content:text},{role:"assistant",content:""}]);setBusy(true);let answer="";
    try{const res=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:session,message:text})});if(!res.ok){const d=await res.json();throw new Error([d.error,d.contact_message].filter(Boolean).join(" ")||"Не удалось отправить сообщение");}if(res.headers.get("content-type")?.includes("application/json")){const d=await res.json();answer=typeof d.answer==="string"?d.answer:typeof d.error==="string"?d.error:"";if(!answer)throw new Error("Пустой ответ сервера");setMessages(prev=>{const next=[...prev];next[next.length-1]={role:"assistant",content:answer};return next;});return;}const reader=res.body?.getReader();if(!reader)throw new Error("Пустой ответ сервера");while(true){const {done,value}=await reader.read();if(done)break;answer+=new TextDecoder().decode(value);setMessages(prev=>{const next=[...prev];next[next.length-1]={role:"assistant",content:answer};return next;});}}
    catch(e){setError(e instanceof Error?e.message:t.networkError);setMessages(prev=>prev.slice(0,-1));}finally{setBusy(false);}
  }
  async function submitBooking(e:FormEvent){e.preventDefault();setBookingMessage("");if(clientPhone.replace(/\D/g,"").length<7){setBookingMessage("Укажите телефон с кодом города или страны.");return;}try{const res=await fetch("/api/booking",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({service_id:serviceId,slot,client_name:clientName,client_phone:clientPhone,client_email:clientEmail||null,session_id:session})});const data=await res.json();if(!res.ok){setBookingMessage(res.status===409?"Это время уже занято. Выберите другое свободное время.":data.error??"Не удалось создать запись");if(res.status===409){const latest=await fetch(`/api/booking?service_id=${encodeURIComponent(serviceId)}&date=${date}`).then(r=>r.json());setSlots(latest.slots??[]);setSlot("");}return;}setBookingConfirmation({id:data.booking.id,text:data.confirmation_text});setBookingOpen(false);setClientName("");setClientPhone("");setClientEmail("");setSlot("");}catch{setBookingMessage("Ошибка сети. Повторите создание записи.");}}
  async function lookupBooking(e:FormEvent){e.preventDefault();setLookupMessage("");const res=await fetch("/api/booking/status",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({booking_id:lookupId||undefined,client_phone:lookupPhone||undefined})}),data=await res.json();if(!res.ok){setLookupMessage(data.error??"Запись не найдена");return;}setLookupMessage(data.bookings.map((b:any)=>`${b.service} — ${b.slot}, статус: ${b.status}`).join("\n"));}
  if(!config||!enabled)return null;
  const t=widgetText(locale);
  return <div className="widget-wrap" data-open={open?"true":"false"} style={{"--accent":config.accent_color} as React.CSSProperties}>
    {open&&<section className="chat-window" data-position={config.position} data-form-open={bookingOpen||lookupOpen?"true":undefined} aria-label={config.title}>
      <header className="chat-header">{config.avatar_url&&<img src={config.avatar_url} alt="" width={28} height={28} style={{objectFit:"cover",borderRadius:"50%",verticalAlign:"middle",marginRight:8}}/>}<b>{config.title}</b><button aria-label={t.close} onClick={close} style={{float:"right",background:"transparent",border:0,color:"white"}}>✕</button></header>
      {!bookingOpen&&!lookupOpen&&<div className="chat-greeting" aria-live="polite">{config.greeting}</div>}
      <div className="chat-body" aria-live="polite">{messages.map((m,i)=><div key={i} className={`bubble ${m.role}`}>{m.content?(m.role==="assistant"?<MessageBody text={m.content}/>:m.content):(busy?t.typing:"")}</div>)}{error&&<div className="chat-error" role="alert"><span>{error}</span><button type="button" onClick={()=>send(messages.filter(m=>m.role==="user").at(-1)?.content??"")}>{t.retry}</button></div>}{messages.length===0&&!bookingOpen&&!lookupOpen&&<div className="row chat-quick-replies">{config.quick_replies.map(q=><button className="quick" key={q} onClick={()=>send(q)}>{q}</button>)}</div>}<div ref={end}/></div>
      <div className="chat-form">
        {bookingConfirmation&&<div className="booking-confirmation" role="status"><strong>Запись создана</strong><p>{bookingConfirmation.text}</p><small>Номер: {bookingConfirmation.id}</small></div>}
        <div className="row widget-actions"><button type="button" onClick={()=>{setBookingOpen(v=>!v);setLookupOpen(false);setBookingMessage("");setBookingConfirmation(null);}}>{bookingOpen?t.hideForm:t.book}</button><button type="button" onClick={()=>{setLookupOpen(v=>!v);setBookingOpen(false);setLookupMessage("");setBookingConfirmation(null);}}>{lookupOpen?t.hideForm:t.checkBooking}</button></div>
        {lookupOpen&&<form className="stack widget-panel" onSubmit={lookupBooking}><strong>{t.bookingStatus}</strong><input ref={lookupField} aria-label={t.phone} type="tel" maxLength={20} placeholder={t.phone} value={lookupPhone} onChange={e=>setLookupPhone(e.target.value)}/><input aria-label={t.bookingId} maxLength={100} placeholder={t.bookingId} value={lookupId} onChange={e=>setLookupId(e.target.value)}/><button className="primary">{t.checkStatus}</button>{lookupMessage&&<small role="status">{lookupMessage}</small>}</form>}
        {bookingOpen&&<form className="stack widget-panel" onSubmit={submitBooking}>
          <strong>{t.bookingForm}</strong>
          <fieldset className="widget-service-picker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setServiceMenuOpen(false);}} onKeyDown={e=>{if(e.key==="Escape"&&serviceMenuOpen){e.preventDefault();e.stopPropagation();setServiceMenuOpen(false);bookingField.current?.focus();}}}>
            <legend>{t.service}</legend>
            <button ref={bookingField} type="button" aria-expanded={serviceMenuOpen} aria-controls="widget-service-options" onClick={()=>setServiceMenuOpen(v=>!v)}>
              <span>{services.find(s=>s.id===serviceId)?.name??t.service}{services.find(s=>s.id===serviceId)?.price!=null?` — ${services.find(s=>s.id===serviceId)?.price} ${config.currency==="RUB"?"₽":config.currency??""}`:""}</span><span aria-hidden="true">{serviceMenuOpen?"▴":"▾"}</span>
            </button>
            {serviceMenuOpen&&<div id="widget-service-options" className="widget-service-options">{services.map(s=><button key={s.id} type="button" aria-pressed={serviceId===s.id} onClick={()=>{if(serviceId!==s.id){setServiceId(s.id);setSlot("");}setBookingMessage("");setServiceMenuOpen(false);bookingField.current?.focus();}}><span>{s.name}</span>{s.price!==null&&<b>{s.price} {config.currency==="RUB"?"₽":config.currency??""}</b>}</button>)}</div>}
          </fieldset>
          <input aria-label={t.date} type="date" min={businessDate(timezone,0)} value={date} onChange={e=>setDate(e.target.value)}/><select aria-label={t.time} required value={slot} onChange={e=>setSlot(e.target.value)}><option value="">{t.chooseTime}</option>{slots.slice(0,3).map(s=><option key={s.start} value={s.start}>{new Intl.DateTimeFormat(locale,{timeZone:timezone,dateStyle:"short",timeStyle:"short"}).format(new Date(s.start))}</option>)}</select>
          {slotsLoading?<small>Проверяем свободное время…</small>:slotsError?<small role="alert">Не удалось загрузить свободное время. <button type="button" onClick={()=>setSlotsRetry(v=>v+1)}>Повторить</button></small>:!slots.length&&<small role="status">{date===businessDate(timezone,0)?"На сегодня запись уже недоступна или свободного времени нет. Выберите другой день.":t.noSlots}</small>}<input aria-label={t.name} placeholder={t.name} maxLength={100} required value={clientName} onChange={e=>setClientName(e.target.value)}/><input aria-label={t.phone} type="tel" placeholder={t.phone} maxLength={20} required value={clientPhone} onChange={e=>setClientPhone(e.target.value)}/><input aria-label={t.email} type="email" placeholder={t.email} maxLength={254} value={clientEmail} onChange={e=>setClientEmail(e.target.value)}/>
          {bookingMessage&&<p className="error" role="alert">{bookingMessage}</p>}<button className="primary" disabled={!slot}>{t.createBooking}</button>
        </form>}
        {!bookingOpen&&!lookupOpen&&<form onSubmit={e=>{e.preventDefault();send();}}><textarea ref={field} aria-label={t.message} rows={2} maxLength={1000} value={input} onChange={e=>setInput(e.target.value)} placeholder={`${t.message}…`}/><div className="row" style={{justifyContent:"space-between",marginTop:6}}><small>{t.counter(input.length)}</small><button className="primary" disabled={busy}>{t.send}</button></div></form>}
        {!bookingOpen&&!lookupOpen&&<button style={{marginTop:6}} onClick={()=>{localStorage.removeItem(`ai-admin-history:${session}`);setMessages([]);}}>{t.startOver}</button>}
      </div>
    </section>}
    {!embedded&&<button className="launcher" data-position={config.position} style={{right:config.position.endsWith("right")?20:"auto",left:config.position.endsWith("left")?20:"auto",bottom:config.position.startsWith("bottom")?20:"auto",top:config.position.startsWith("top")?20:"auto"}} onClick={()=>setOpen(v=>!v)}>{config.button_label}</button>}
  </div>;
}
