// node --test lib/util.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { diasPara, formatoDireccion, leerMeta, rutaSegura, telefono10, urlPublica } from "./util.ts";

test("rutaSegura", () => {
  assert.equal(rutaSegura("/unirse/abc"), "/unirse/abc");
  assert.equal(rutaSegura("//evil.com"), "/");
  assert.equal(rutaSegura("https://evil.com"), "/");
  assert.equal(rutaSegura(null), "/");
});

test("urlPublica", () => {
  assert.ok(urlPublica("https://articulo.mercadolibre.com.mx/MLM-123"));
  assert.equal(urlPublica("http://localhost:3000"), null);
  assert.equal(urlPublica("http://169.254.169.254/latest"), null);
  assert.equal(urlPublica("file:///etc/passwd"), null);
  assert.equal(urlPublica("no es url"), null);
});

test("leerMeta en ambos órdenes de atributos", () => {
  const html = `<meta property="og:title" content="Audífonos &amp; estuche">
    <meta content="https://img/x.jpg" property="og:image">
    <meta itemprop="price" content="499.00">`;
  assert.deepEqual(leerMeta(html), { titulo: "Audífonos & estuche", imagen: "https://img/x.jpg", precio: 499 });
  assert.deepEqual(leerMeta("<html></html>"), { titulo: undefined, imagen: undefined, precio: null });
});

test("diasPara", () => {
  const ahora = Date.parse("2026-10-05T12:00:00-06:00");
  assert.equal(diasPara("2026-12-19", ahora), 75);
  assert.equal(diasPara("2026-10-05", ahora), 0);
});

test("telefono10", () => {
  assert.equal(telefono10("81 1234-5678"), "8112345678");
  assert.equal(telefono10("+52 81 1234 5678"), "8112345678");
  assert.equal(telefono10("+1 (512) 555-0123", "US"), "5125550123");
  assert.equal(telefono10("1234"), "1234");
});

test("formatoDireccion", () => {
  const d = { pais: "MX" as const, recibe: "Pablo Garza", calle: "Av. Fundidora 501", colonia: "Obrera", cp: "64010", ciudad: "Monterrey", estado: "Nuevo León", telefono: "8112345678", referencias: null };
  assert.equal(formatoDireccion(d), "Pablo Garza\nAv. Fundidora 501, Col. Obrera\nCP 64010, Monterrey, Nuevo León\nMéxico\nTel. +52 81 1234 5678");
  assert.match(formatoDireccion({ ...d, referencias: "Portón negro" }), /\nReferencias: Portón negro$/);
  const us = { pais: "US" as const, recibe: "Mike Turner", calle: "1200 Main St, Apt 4B", colonia: null, cp: "78701", ciudad: "Austin", estado: "Texas", telefono: "5125550123", referencias: null };
  assert.equal(formatoDireccion(us), "Mike Turner\n1200 Main St, Apt 4B\nAustin, Texas 78701\nEstados Unidos\nTel. +1 (512) 555-0123");
});
