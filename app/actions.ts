"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, sesion } from "@/lib/supabase";
import { ESTADOS, leerMeta, rutaSegura, telefono10, urlPublica } from "@/lib/util";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const origen = async () => {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
};
const fallar = (ruta: string, msg: string): never => redirect(`${ruta}?error=${encodeURIComponent(msg)}`);

// --- Sesión ---

export async function entrarGoogle(f: FormData) {
  const next = rutaSegura(txt(f, "next"));
  const { data, error } = await (await db()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origen()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) fallar("/entrar", error.message);
  redirect(data.url!);
}

export async function entrarCorreo(f: FormData) {
  const next = rutaSegura(txt(f, "next"));
  const { error } = await (await db()).auth.signInWithOtp({
    email: txt(f, "email"),
    options: { emailRedirectTo: `${await origen()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) fallar("/entrar", error.message);
  redirect("/entrar?enviado=1");
}

export async function salir() {
  await (await db()).auth.signOut();
  redirect("/entrar");
}

// --- Intercambios ---

export async function crearIntercambio(f: FormData) {
  const { supabase } = await sesion();
  const { data, error } = await supabase
    .from("intercambio")
    .insert({ nombre: txt(f, "nombre"), fecha: txt(f, "fecha") || null, presupuesto: Number(txt(f, "presupuesto")) || null })
    .select("id")
    .single();
  if (error) fallar("/", "No se pudo crear el intercambio. Intenta otra vez.");
  redirect(`/i/${data!.id}`);
}

export async function unirse(f: FormData) {
  const codigo = txt(f, "codigo");
  const { supabase } = await sesion(`/unirse/${codigo}`);
  const { data, error } = await supabase.rpc("unirse", { cod: codigo, nombre_visible: txt(f, "nombre") });
  if (error) fallar(`/unirse/${codigo}`, error.message);
  redirect(`/i/${data}`);
}

export async function sortear(f: FormData) {
  const id = txt(f, "id");
  const { supabase } = await sesion();
  const { error } = await supabase.rpc("sortear", { i: id });
  if (error) fallar(`/i/${id}`, error.message);
  revalidatePath(`/i/${id}`);
}

export async function quitarParticipante(f: FormData) {
  const id = txt(f, "id");
  const { supabase } = await sesion();
  await supabase.from("participante").delete().match({ intercambio_id: id, usuario_id: txt(f, "usuario") });
  revalidatePath(`/i/${id}`);
}

export async function agregarExclusion(f: FormData) {
  const id = txt(f, "id");
  const [a, b] = [txt(f, "a"), txt(f, "b")];
  if (!a || !b || a === b) fallar(`/i/${id}`, "Elige a dos personas distintas.");
  const { supabase } = await sesion();
  await supabase.from("exclusion").insert({ intercambio_id: id, usuario_a: a, usuario_b: b });
  revalidatePath(`/i/${id}`);
}

export async function borrarExclusion(f: FormData) {
  const id = txt(f, "id");
  const { supabase } = await sesion();
  await supabase.from("exclusion").delete().match({ intercambio_id: id, usuario_a: txt(f, "a"), usuario_b: txt(f, "b") });
  revalidatePath(`/i/${id}`);
}

// --- Lista de deseos ---

async function vistaPrevia(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36", "accept-language": "es-MX" },
      signal: AbortSignal.timeout(4000),
    });
    return leerMeta((await res.text()).slice(0, 500_000));
  } catch {
    return { titulo: undefined, imagen: undefined, precio: null }; // Amazon a veces bloquea; queda solo el link.
  }
}

export async function agregarDeseo(f: FormData) {
  const id = txt(f, "id");
  const raw = txt(f, "url");
  const url = raw ? urlPublica(raw) : null;
  if (raw && !url) fallar(`/i/${id}`, "Ese link no abre. Copia la dirección completa de la tienda.");
  const meta = url ? await vistaPrevia(url) : null;
  const texto = (txt(f, "texto") || meta?.titulo || "").slice(0, 200);
  if (!texto) fallar(`/i/${id}`, "Escribe qué quieres o pega un link.");

  const { supabase } = await sesion();
  await supabase.from("deseo").insert({ intercambio_id: id, texto, url, imagen: meta?.imagen ?? null, precio: meta?.precio ?? null });
  revalidatePath(`/i/${id}`);
}

export async function borrarDeseo(f: FormData) {
  const { supabase } = await sesion();
  await supabase.from("deseo").delete().eq("id", txt(f, "deseo"));
  revalidatePath(`/i/${txt(f, "id")}`);
}

// --- Dirección de envío ---

export async function guardarDireccion(f: FormData) {
  const id = txt(f, "id");
  const d = {
    recibe: txt(f, "recibe").slice(0, 80),
    calle: txt(f, "calle").slice(0, 120),
    colonia: txt(f, "colonia").slice(0, 80),
    cp: txt(f, "cp").replace(/\s/g, ""),
    ciudad: txt(f, "ciudad").slice(0, 80),
    estado: txt(f, "estado"),
    telefono: telefono10(txt(f, "telefono")),
    referencias: txt(f, "referencias").slice(0, 200) || null,
  };
  if (!d.recibe || !d.calle || !d.colonia || !d.ciudad) fallar(`/i/${id}`, "Te faltó algún dato de la dirección.");
  if (!/^\d{5}$/.test(d.cp)) fallar(`/i/${id}`, "El código postal son 5 números.");
  if (!ESTADOS.includes(d.estado)) fallar(`/i/${id}`, "Elige tu estado de la lista.");
  if (!/^\d{10}$/.test(d.telefono)) fallar(`/i/${id}`, "El teléfono son 10 números, para que la paquetería te pueda llamar.");

  const { supabase } = await sesion();
  const { error } = await supabase.from("direccion").upsert({ intercambio_id: id, ...d });
  if (error) fallar(`/i/${id}`, "No se pudo guardar tu dirección. Intenta otra vez.");
  revalidatePath(`/i/${id}`);
}
