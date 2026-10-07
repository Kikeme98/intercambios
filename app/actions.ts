"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { avisarMensaje, avisarSorteo } from "@/lib/correo";
import { db, sesion } from "@/lib/supabase";
import { leerMeta, PAISES, rutaSegura, telefono10, urlPublica, type Pais } from "@/lib/util";

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

export async function editarIntercambio(f: FormData) {
  const id = txt(f, "id");
  const nombre = txt(f, "nombre").slice(0, 80);
  if (!nombre) fallar(`/i/${id}`, "El intercambio necesita un nombre.");
  const { supabase } = await sesion();
  // RLS: solo quien organiza; y solo nombre, fecha y presupuesto (ver migración 003).
  const { error } = await supabase
    .from("intercambio")
    .update({ nombre, fecha: txt(f, "fecha") || null, presupuesto: Number(txt(f, "presupuesto")) || null })
    .eq("id", id);
  if (error) fallar(`/i/${id}`, "No se pudo guardar el cambio. Intenta otra vez.");
  revalidatePath(`/i/${id}`);
  revalidatePath("/");
}

export async function deshacerSorteo(f: FormData) {
  const id = txt(f, "id");
  if (txt(f, "confirmo") !== "si") fallar(`/i/${id}`, "Marca la casilla para confirmar.");
  const { supabase } = await sesion();
  const { error } = await supabase.rpc("deshacer_sorteo", { i: id });
  if (error) fallar(`/i/${id}`, error.message);
  revalidatePath(`/i/${id}`);
  revalidatePath("/");
}

export async function borrarIntercambio(f: FormData) {
  const id = txt(f, "id");
  if (txt(f, "confirmo") !== "si") fallar(`/i/${id}`, "Marca la casilla para confirmar.");
  const { supabase } = await sesion();
  // RLS: solo quien organiza. Participantes, listas, chats y direcciones se borran en cascada.
  const { data } = await supabase.from("intercambio").delete().eq("id", id).select("id");
  if (!data?.length) fallar(`/i/${id}`, "No se pudo borrar el intercambio.");
  revalidatePath("/");
  redirect("/");
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
  const base = await origen();
  after(() => avisarSorteo(id, base)); // los correos salen después de responder: el sorteo no se hace más lento
  revalidatePath(`/i/${id}`);
}

/**
 * El chat inserta el mensaje desde el navegador; esto solo programa el aviso por correo.
 * Se verifica que quien llama sea parte de ese hilo (para que nadie dispare correos a otros).
 */
export async function avisarMensajeNuevo(intercambioId: string, receptorId: string, deSanta: boolean) {
  const { supabase, user } = await sesion();
  if (deSanta) {
    // RLS: solo regresa la asignación si quien llama es la santa de ese receptor.
    const { data } = await supabase.from("asignacion").select("receptor_id").match({ intercambio_id: intercambioId, receptor_id: receptorId }).maybeSingle();
    if (!data) return;
  } else if (receptorId !== user.id) return;
  const base = await origen();
  after(() => avisarMensaje(intercambioId, receptorId, deSanta, base));
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
  const pais: Pais = txt(f, "pais") === "US" ? "US" : "MX";
  const d = {
    pais,
    recibe: txt(f, "recibe").slice(0, 80),
    calle: txt(f, "calle").slice(0, 120),
    colonia: pais === "MX" ? txt(f, "colonia").slice(0, 80) : null, // en USA no hay colonia
    cp: txt(f, "cp").replace(/\s/g, ""),
    ciudad: txt(f, "ciudad").slice(0, 80),
    estado: txt(f, "estado"),
    telefono: telefono10(txt(f, "telefono"), pais),
    referencias: txt(f, "referencias").slice(0, 200) || null,
  };
  const volver = `/i/${id}`;
  if (!d.recibe || !d.calle || !d.ciudad || (pais === "MX" && !d.colonia)) fallar(volver, "Te faltó algún dato de la dirección.");
  if (pais === "MX" && !/^\d{5}$/.test(d.cp)) fallar(volver, "El código postal son 5 números.");
  if (pais === "US" && !/^\d{5}(-\d{4})?$/.test(d.cp)) fallar(volver, "El ZIP code son 5 números (o 5 y 4, como 78701-1234).");
  if (!PAISES[pais].estados.includes(d.estado)) fallar(volver, "Elige tu estado de la lista.");
  if (!/^\d{10}$/.test(d.telefono)) fallar(volver, "El teléfono son 10 números, para que la paquetería te pueda llamar.");

  const { supabase } = await sesion();
  const { error } = await supabase.from("direccion").upsert({ intercambio_id: id, ...d });
  if (error) fallar(volver, "No se pudo guardar tu dirección. Intenta otra vez.");
  revalidatePath(volver);
}
