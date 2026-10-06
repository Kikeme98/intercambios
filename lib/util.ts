/** Solo rutas internas: evita redirecciones abiertas tipo //otro-sitio.com */
export function rutaSegura(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Evita que el servidor haga fetch a la red interna (SSRF). */
export function urlPublica(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // ponytail: filtro por nombre, no resuelve DNS; basta para un grupo de amigos autenticados.
    if (/^(localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/i.test(u.hostname) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Lee og:title, og:image y precio de una página (Amazon, Mercado Libre, Liverpool...). */
export function leerMeta(html: string) {
  const meta = (prop: string) =>
    (html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']+)`, "i")) ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`, "i")))?.[1];
  const precio = Number(meta("product:price:amount") ?? meta("og:price:amount") ?? meta("price"));
  return {
    titulo: meta("og:title")?.replace(/&amp;/g, "&").replace(/&quot;/g, '"'),
    imagen: meta("og:image"),
    precio: Number.isFinite(precio) && precio > 0 ? precio : null,
  };
}

export const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export const fecha = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });

/** Días que faltan para una fecha (YYYY-MM-DD) en hora del centro de México. */
export function diasPara(d: string, ahora = Date.now()) {
  return Math.ceil((Date.parse(d + "T00:00:00-06:00") - ahora) / 86_400_000) + 0; // + 0 evita -0
}

export const ESTADOS = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Ciudad de México",
  "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán",
  "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
  "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
];

export type Direccion = {
  recibe: string; calle: string; colonia: string; cp: string;
  ciudad: string; estado: string; telefono: string; referencias: string | null;
};

/** Deja solo los 10 dígitos de un teléfono mexicano (quita espacios, guiones y lada +52). */
export function telefono10(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("52") ? d.slice(2) : d;
}

/** Dirección como la pide una paquetería, lista para copiar. */
export function formatoDireccion(d: Direccion) {
  const tel = d.telefono.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3");
  return [
    d.recibe,
    `${d.calle}, Col. ${d.colonia}`,
    `CP ${d.cp}, ${d.ciudad}, ${d.estado}`,
    `Tel. ${tel}`,
    d.referencias && `Referencias: ${d.referencias}`,
  ].filter(Boolean).join("\n");
}
