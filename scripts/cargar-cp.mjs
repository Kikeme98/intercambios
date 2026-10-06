// Carga el catálogo oficial de códigos postales (SEPOMEX) a la tabla codigo_postal.
// Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/cargar-cp.mjs
// La llave secreta (service role) salta RLS; nunca la pongas en variables NEXT_PUBLIC_.
const URL_CATALOGO = "https://www.correosdemexico.gob.mx/datosabiertos/cp/cpdescarga.txt";
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY");

// Nombres oficiales largos -> los de la lista ESTADOS de la app.
const ESTADO = {
  "Coahuila de Zaragoza": "Coahuila",
  "Michoacán de Ocampo": "Michoacán",
  "Veracruz de Ignacio de la Llave": "Veracruz",
  México: "Estado de México",
};

const rest = (path, init) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal", ...init?.headers },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  });

console.log("Descargando catálogo de Correos de México...");
const bytes = await (await fetch(URL_CATALOGO, { headers: { "User-Agent": "Mozilla/5.0" } })).arrayBuffer();
const lineas = new TextDecoder("latin1").decode(bytes).split(/\r?\n/).slice(2).filter(Boolean);

const vistos = new Set();
const filas = [];
for (const l of lineas) {
  const [cp, colonia, , municipio, estado] = l.split("|");
  const llave = `${cp}|${colonia}|${municipio}`;
  if (!/^\d{5}$/.test(cp) || vistos.has(llave)) continue;
  vistos.add(llave);
  filas.push({ cp, colonia, municipio, estado: ESTADO[estado] ?? estado });
}
console.log(`${filas.length} colonias. Reemplazando la tabla...`);

await rest("codigo_postal?id=gt.0", { method: "DELETE" });
for (let i = 0; i < filas.length; i += 5000) {
  await rest("codigo_postal", { method: "POST", body: JSON.stringify(filas.slice(i, i + 5000)) });
  process.stdout.write(`\r${Math.min(i + 5000, filas.length)} / ${filas.length}`);
}
console.log("\nListo.");
