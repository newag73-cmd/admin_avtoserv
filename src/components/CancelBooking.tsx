"use client";
import {useState} from "react";
export default function CancelBooking({token}:{token:string}){const [state,setState]=useState("");return <div><button className="primary" disabled={!token} onClick={async()=>{const r=await fetch("/api/booking/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});const d=await r.json();setState(r.ok?"Запись отменена.":d.error??"Не удалось отменить запись.");}}>{state?"Готово":"Подтвердить отмену"}</button>{state&&<p role="status">{state}</p>}</div>;}
