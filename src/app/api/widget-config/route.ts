import { getBusinessConfig } from "@/lib/config";
import {NextRequest} from "next/server";
import {widgetCors} from "@/lib/widget-origin";
export async function GET(req:NextRequest) { const origin=req.headers.get("origin"),cors=widgetCors(req);if(origin&&!Object.keys(cors).length)return Response.json({error:"Origin is not allowed"},{status:403});const c = await getBusinessConfig(); return Response.json({ widget: c.widget, enabled:c.assistant_settings.widget_enabled,locale: c.ui.locale,currency:c.ui.currency,timezone:c.timezone, services: c.services.filter(s => s.active && !s.requires_human_quote && s.parallel_capacity>0).map(({id,name,price,price_note}) => ({id,name,price,price_note})) }, { headers: { "cache-control": "no-store",...cors } }); }
