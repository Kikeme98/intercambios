import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { rutaSegura } from "@/lib/util";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) await (await db()).auth.exchangeCodeForSession(code);
  // request.url puede traer "localhost" aunque entraste por otro host; el header host es el real.
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return NextResponse.redirect(`${proto}://${request.headers.get("host")}${rutaSegura(searchParams.get("next"))}`);
}
