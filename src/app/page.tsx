import Link from "next/link";
import Widget from "@/components/Widget";
import { getBusinessConfig } from "@/lib/config";
export const dynamic = "force-dynamic";

const days=[
  ["mon","Понедельник"],["tue","Вторник"],["wed","Среда"],["thu","Четверг"],
  ["fri","Пятница"],["sat","Суббота"],["sun","Воскресенье"],
] as const;
const hoursText=(hours:{open:string;close:string}|"closed")=>hours==="closed"?"Выходной":`с ${hours.open} до ${hours.close}`;

export default async function Home(){
  const c=await getBusinessConfig(),services=c.services.filter(s=>s.active),currency=c.ui.currency==="RUB"?"₽":c.ui.currency;
  const showAdminLink=process.env.NODE_ENV!=="production";
  return <main className="home-shell">
    <header className="home-nav"><Link className="home-brand" href="/">{c.business.name}</Link><nav><a href="#services">Услуги</a><a href="#contacts">Контакты</a>{showAdminLink&&<Link className="admin-link" href="/admin/login">Вход в админку <span aria-hidden="true">↗</span></Link>}</nav></header>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">Сервис и забота о вашем автомобиле</span><h1>{c.business.name}</h1><p>Профессиональный уход за автомобилем. Посмотрите услуги и цены, узнайте график работы или запишитесь онлайн.</p><div className="hero-actions"><Link className="home-primary" href="/widget">Записаться онлайн</Link><a className="home-secondary" href="#services">Посмотреть услуги</a></div><div className="hero-facts"><div><span>Адрес</span><b>{c.business.address||"Уточните у администратора"}</b></div><div><span>Телефон</span><b>{c.business.phone||"Не указан"}</b></div></div></div>
      <figure className="hero-image"><img src="/auto-workshop.jpg" alt="Мастер проверяет автомобиль в современном автосервисе"/><figcaption><a href="https://unsplash.com/photos/mechanic-working-on-a-car-engine-in-a-workshop-XP8o9_Arwqg" target="_blank" rel="noreferrer">Фото Dextar Studio / Unsplash</a></figcaption></figure>
    </section>
    <section id="services" className="home-section"><div className="section-heading"><div><span className="eyebrow">Чем поможем</span><h2>Услуги и цены</h2></div><p>Стоимость указана в конфигурации сервиса. Если цена зависит от осмотра, уточним её до начала работ.</p></div><div className="service-grid">{services.map(s=><article className="home-service" key={s.id}><div className="service-mark" aria-hidden="true">✳</div><h3>{s.name}</h3>{s.description&&<p>{s.description}</p>}<div className="service-price">{s.price===null?"Цена по запросу":<>{new Intl.NumberFormat(c.ui.locale).format(s.price)} {currency}</>}{s.price_note&&<small>{s.price_note}</small>}</div></article>)}</div></section>
    <section id="contacts" className="contact-section"><div><span className="eyebrow">Будем рады помочь</span><h2>Приезжайте к нам</h2><p>{c.business.address||"Адрес уточните у администратора"}</p>{c.business.phone&&<a className="contact-phone" href={`tel:${c.business.phone.replace(/[^+\d]/g,"")}`}>{c.business.phone}</a>}{c.business.email&&<a className="contact-email" href={`mailto:${c.business.email}`}>{c.business.email}</a>}</div><div className="hours-card"><h3>Режим работы</h3>{days.map(([key,label])=><div className="hours-line" key={key}><span>{label}</span><b>{hoursText(c.hours[key])}</b></div>)}<small>Время указано по часовому поясу {c.timezone}.</small></div></section>
    <footer className="home-footer"><span>© {new Date().getFullYear()} {c.business.name}</span>{showAdminLink&&<Link href="/admin/login">Вход в админку</Link>}</footer>
    <Widget />
  </main>;
}
