import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import AdminPanel from "@/components/AdminPanel";
export const dynamic = "force-dynamic";
export default async function Admin() { if (!await isAdmin((await cookies()).get("admin_session")?.value)) redirect("/admin/login"); return <AdminPanel/>; }
