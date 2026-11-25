import CancelBooking from "@/components/CancelBooking";
export default async function CancelPage({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <main className="shell"><section className="card"><h1>Отмена записи</h1><p>Подтвердите отмену записи по ссылке из письма.</p><CancelBooking token={token??""}/></section></main>;}
