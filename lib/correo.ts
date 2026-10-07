import "server-only";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// Variables de entorno (solo servidor, sin NEXT_PUBLIC_): ver README.
const { GMAIL_USER, GMAIL_APP_PASSWORD, SUPABASE_SECRET_KEY } = process.env;

const transporte =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, "") } })
    : null;

/** Llave secreta: salta RLS. Solo para leer correos y saber a quién avisar; nunca llega al navegador. */
const admin = () =>
  SUPABASE_SECRET_KEY ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SECRET_KEY, { auth: { persistSession: false } }) : null;

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Correo con el estilo Noche. Tablas y estilos en línea: es lo único que respetan todos los clientes de correo. */
function plantilla(origen: string, titulo: string, cuerpo: string, boton: string, url: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head><body style="margin:0;background:#08090a;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#16171a;border:1px solid #2a2b2f;border-radius:28px">
<tr><td style="padding:32px 28px 8px"><img src="${origen}/icono-192.png" width="44" height="44" alt="Intercambio GS" style="display:block;border-radius:12px"></td></tr>
<tr><td style="padding:16px 28px 0;color:#ededef;font-size:26px;line-height:1.15;font-weight:600;letter-spacing:-0.02em">${titulo}</td></tr>
<tr><td style="padding:12px 28px 0;color:#9a9ba1;font-size:15px;line-height:1.55">${cuerpo}</td></tr>
<tr><td style="padding:28px 28px 32px"><a href="${url}" style="display:inline-block;background:#ededef;color:#08090a;text-decoration:none;font-weight:600;font-size:15px;padding:15px 26px;border-radius:999px">${boton}</a></td></tr>
</table>
<p style="max-width:440px;margin:16px auto 0;color:#6b6c72;font-size:12px;line-height:1.5;text-align:center">Aviso automático del Intercambio GS. No contestes a este correo: entra a la app.</p>
</td></tr></table></body></html>`;
}

/** Un correo por persona (nadie ve los correos de los demás). Sin Gmail configurado, solo lo anota en el log. */
async function enviar(para: string[], asunto: string, html: string, texto: string) {
  if (!para.length) return;
  if (!transporte) {
    console.log(`[correo] sin Gmail configurado; se habría enviado "${asunto}" a ${para.length} persona(s)`);
    return;
  }
  const resultados = await Promise.allSettled(
    para.map((to) => transporte.sendMail({ from: `"Intercambio GS" <${GMAIL_USER}>`, to, subject: asunto, html, text: texto })),
  );
  const fallidos = resultados.filter((r) => r.status === "rejected").length;
  if (fallidos) console.error(`[correo] fallaron ${fallidos} de ${para.length} envíos de "${asunto}"`);
}

async function correosDe(db: NonNullable<ReturnType<typeof admin>>, ids: string[]) {
  const usuarios = await Promise.all(ids.map((id) => db.auth.admin.getUserById(id)));
  return usuarios.map((u) => u.data.user?.email).filter((e): e is string => !!e);
}

/** "Ya se hizo el sorteo" a todo el intercambio. Sin el nombre de su persona: saldría en la vista previa del celular. */
export async function avisarSorteo(intercambioId: string, origen: string) {
  const db = admin();
  if (!db) return console.log("[correo] falta SUPABASE_SECRET_KEY; no se avisa del sorteo");
  const [{ data: i }, { data: gente }] = await Promise.all([
    db.from("intercambio").select("nombre").eq("id", intercambioId).single(),
    db.from("participante").select("usuario_id").eq("intercambio_id", intercambioId),
  ]);
  if (!i || !gente) return;
  const nombre = escapar(i.nombre);
  const url = `${origen}/i/${intercambioId}`;
  await enviar(
    await correosDe(db, gente.map((p) => p.usuario_id)),
    `Ya se hizo el sorteo de ${i.nombre}`,
    plantilla(origen, "Ya se hizo el sorteo.", `Ya hay papelitos en <b style="color:#ededef">${nombre}</b>. Entra a ver a quién te tocó y qué pidió. Deja presionado para ver el nombre.`, "Ver a quién me tocó", url),
    `Ya se hizo el sorteo de ${i.nombre}. Entra a ver a quién te tocó: ${url}`,
  );
}

const PAUSA_AVISOS = 30 * 60 * 1000; // en una conversación seguida, un solo correo cada 30 min

/**
 * Aviso de mensaje nuevo en el chat anónimo. A quien recibe: "Tu santa te escribió";
 * a la santa: "Tu persona te respondió". Sin el texto del mensaje.
 */
export async function avisarMensaje(intercambioId: string, receptorId: string, deSanta: boolean, origen: string) {
  const db = admin();
  if (!db) return console.log("[correo] falta SUPABASE_SECRET_KEY; no se avisa del mensaje");
  const { data: ultimos } = await db
    .from("mensaje")
    .select("creado")
    .match({ intercambio_id: intercambioId, receptor_id: receptorId, de_santa: deSanta })
    .order("id", { ascending: false })
    .limit(2);
  if (!ultimos?.length) return;
  if (ultimos[1] && Date.parse(ultimos[0].creado) - Date.parse(ultimos[1].creado) < PAUSA_AVISOS) return;

  let destinatario = receptorId;
  if (!deSanta) {
    const { data: a } = await db.from("asignacion").select("santa_id").match({ intercambio_id: intercambioId, receptor_id: receptorId }).single();
    if (!a) return;
    destinatario = a.santa_id;
  }
  const { data: i } = await db.from("intercambio").select("nombre").eq("id", intercambioId).single();
  const nombre = escapar(i?.nombre ?? "el intercambio");
  const chat = `${origen}/i/${intercambioId}/chat/${deSanta ? "santa" : "persona"}`;
  const [titulo, cuerpo, asunto] = deSanta
    ? ["Tu santa te escribió.", `Alguien de <b style="color:#ededef">${nombre}</b> que te va a regalar te mandó un mensaje. No sabes quién es, pero te está leyendo.`, "Tu santa te escribió"]
    : ["Tu persona te respondió.", `La persona a la que le regalas en <b style="color:#ededef">${nombre}</b> contestó tu mensaje. Sigue sin saber que eres tú.`, "Tu persona te respondió"];
  await enviar(await correosDe(db, [destinatario]), asunto, plantilla(origen, titulo, cuerpo, "Abrir el chat", chat), `${titulo} Abre el chat: ${chat}`);
}
