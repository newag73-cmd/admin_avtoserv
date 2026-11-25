"use client";
import {useState,type FormEvent} from "react";

export default function PasswordForm(){
  const [current,setCurrent]=useState(""),[next,setNext]=useState(""),[repeat,setRepeat]=useState(""),[message,setMessage]=useState(""),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault();setMessage("");
    if(next!==repeat){setMessage("Повтор нового пароля не совпадает.");return;}
    setBusy(true);
    try{const response=await fetch("/api/admin/password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({currentPassword:current,newPassword:next})});const data=await response.json().catch(()=>null);if(!response.ok){setMessage(data?.error??"Не удалось изменить пароль. Проверьте журнал сервера.");return;}setCurrent("");setNext("");setRepeat("");setDone(true);setMessage(data?.message??"Пароль изменён. Войдите заново.");}catch{setMessage("Нет связи с сервером. Попробуйте снова.");}finally{setBusy(false);}
  }
  return <section className="card stack"><h2>Сменить пароль администратора</h2>{done?<p role="status">{message} <a href="/admin/login">Войти снова</a></p>:<form className="stack" onSubmit={submit} autoComplete="off"><label className="field">Текущий пароль<input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></label><label className="field">Новый пароль<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={next} onChange={e=>setNext(e.target.value)}/></label><label className="field">Повтор нового пароля<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={repeat} onChange={e=>setRepeat(e.target.value)}/></label><small className="muted">Не менее 12 символов. После смены пароля потребуется войти заново.</small>{message&&<p className="error" role="alert">{message}</p>}<button className="primary" type="submit" disabled={busy}>{busy?"Сохраняем…":"Изменить пароль"}</button></form>}</section>;
}
