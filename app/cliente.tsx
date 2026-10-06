"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { PAISES, type Direccion, type Pais } from "@/lib/util";
import { destellar, gsap, sinMovimiento, useGSAP } from "./motion";
import { Icono } from "./ui";

// Un solo cliente de Supabase en el navegador.
let cliente: SupabaseClient | undefined;
const sb = () => (cliente ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));

/**
 * País, CP/ZIP, colonia, municipio/ciudad, estado y calle.
 * México: al escribir un CP válido se consultan las colonias del catálogo oficial (tabla codigo_postal)
 * y se llenan municipio y estado; la colonia sugiere pero acepta texto libre.
 * Estados Unidos: sin colonia ni autollenado; ZIP de 5 dígitos (o ZIP+4).
 */
export function CamposDireccion({ d }: { d?: Direccion }) {
  const [pais, setPais] = useState<Pais>(d?.pais ?? "MX");
  const [colonias, setColonias] = useState<string[]>([]);
  const [colonia, setColonia] = useState(d?.colonia ?? "");
  const [municipio, setMunicipio] = useState(d?.ciudad ?? "");
  const [estado, setEstado] = useState(d?.estado ?? "");
  const [aviso, setAviso] = useState("");
  const us = pais === "US";

  function cambiarPais(p: Pais) {
    setPais(p);
    setEstado("");
    setColonias([]);
    setAviso("");
  }

  async function buscar(cp: string) {
    if (us || !/^\d{5}$/.test(cp)) return setColonias([]);
    const { data } = await sb().from("codigo_postal").select("colonia, municipio, estado").eq("cp", cp).order("colonia");
    if (!data?.length) {
      setColonias([]);
      return setAviso("No encontramos ese CP. Llena tus datos a mano.");
    }
    setAviso("");
    setColonias([...new Set(data.map((r) => r.colonia))]);
    setMunicipio(data[0].municipio);
    setEstado(data[0].estado);
    setColonia(data.length === 1 ? data[0].colonia : (c) => (data.some((r) => r.colonia === c) ? c : ""));
  }

  return (
    <>
      <fieldset className="space-y-2">
        <legend className="etiqueta mb-2">País</legend>
        <div className="vidrio grid grid-cols-2 gap-1 rounded-full p-1.5">
          {(["MX", "US"] as const).map((p) => (
            <label
              key={p}
              className="grid h-11 cursor-pointer place-items-center rounded-full text-[15px] text-muted transition-colors has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
            >
              <input type="radio" name="pais" value={p} checked={pais === p} onChange={() => cambiarPais(p)} className="sr-only" />
              {PAISES[p].nombre}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-2">
        <span className="etiqueta">{us ? "ZIP code" : "Código postal"}</span>
        <input
          key={pais}
          name="cp"
          required
          inputMode="numeric"
          pattern={us ? "[0-9]{5}(-[0-9]{4})?" : "[0-9]{5}"}
          maxLength={us ? 10 : 5}
          autoComplete="postal-code"
          defaultValue={pais === d?.pais ? d.cp : undefined}
          onChange={(e) => buscar(e.target.value.trim())}
          placeholder={us ? "Ej. 78701" : "Con él llenamos colonia, municipio y estado"}
          className="input"
        />
        {aviso && <span className="block text-xs text-accent-text">{aviso}</span>}
      </label>
      {!us && (
        <label className="block space-y-2">
          <span className="etiqueta">Colonia</span>
          <input
            name="colonia"
            required
            maxLength={80}
            list="colonias-cp"
            autoComplete="address-line2"
            value={colonia}
            onChange={(e) => setColonia(e.target.value)}
            placeholder={colonias.length > 1 ? `Elige entre ${colonias.length} colonias` : undefined}
            className="input"
          />
          <datalist id="colonias-cp">
            {colonias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-2">
          <span className="etiqueta">{us ? "Ciudad" : "Municipio o alcaldía"}</span>
          <input name="ciudad" required maxLength={80} autoComplete="address-level2" value={municipio} onChange={(e) => setMunicipio(e.target.value)} className="input" />
        </label>
        <label className="block space-y-2">
          <span className="etiqueta">Estado</span>
          <select name="estado" required autoComplete="address-level1" value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
            <option value="" disabled>Elige</option>
            {PAISES[pais].estados.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-2">
        <span className="etiqueta">{us ? "Street address (con Apt o Unit)" : "Calle, número e interior"}</span>
        <input name="calle" required maxLength={120} autoComplete="address-line1" defaultValue={d?.calle} placeholder={us ? "Ej. 1200 Main St, Apt 4B" : undefined} className="input" />
      </label>
    </>
  );
}

// "Jingle Bell Rock" (Bobby Helms, sencillo original de 1957) con el reproductor oficial de Spotify. No se aloja el audio (derechos de autor)
// y YouTube no sirve: Universal Music bloquea reproducir su video fuera de YouTube.
// Spotify incrustado: canción completa si la persona tiene sesión de Spotify en el navegador; si no, avance de 30 s.
const JINGLE_BELL_ROCK = "7vQbuQcyTflfCIOu3Uzzya";

/**
 * Botón de música. El reproductor solo se carga tras el toque y vive en el layout, así que la canción sigue al navegar.
 * Se le da play dentro del reproductor: los navegadores no dejan que una página empiece a sonar sola.
 */
export function Musica() {
  const [abierta, setAbierta] = useState(false);
  const enChat = usePathname().includes("/chat/");

  return (
    <>
      {abierta && (
        <div className={`reproductor vidrio fixed right-4 z-20 w-[min(320px,calc(100vw-2rem))] rounded-[28px] p-1.5 ${enChat ? "bottom-40" : "bottom-20"}`}>
          <iframe
            title="Jingle Bell Rock en Spotify"
            src={`https://open.spotify.com/embed/track/${JINGLE_BELL_ROCK}?theme=0`}
            height="152"
            className="block w-full rounded-[22px]"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-pressed={abierta}
        aria-label={abierta ? "Cerrar reproductor de Jingle Bell Rock" : "Abrir reproductor de Jingle Bell Rock"}
        className={`vidrio fixed right-4 z-20 flex h-12 items-center gap-2 rounded-full pl-3.5 pr-4 text-sm ${enChat ? "bottom-24" : "bottom-5"}`}
      >
        <Icono n={abierta ? "x" : "musica"} className="size-[18px] text-[#f4c26b]" />
        {abierta ? "Cerrar música" : "Jingle Bell Rock"}
      </button>
    </>
  );
}

/** Tres puntitos que rebotan: "trabajando" para botones con ícono (no hay espacio para texto). */
export function Puntos() {
  return (
    <span className="puntos" role="status" aria-label="Cargando">
      <i style={{ "--i": 0 } as React.CSSProperties} />
      <i style={{ "--i": 1 } as React.CSSProperties} />
      <i style={{ "--i": 2 } as React.CSSProperties} />
    </span>
  );
}

/**
 * Botón de envío que muestra que está trabajando mientras la acción del servidor corre:
 * se desactiva (sin dobles envíos), le pasa un destello continuo y, si trae `cargando`,
 * cambia su texto y el círculo del ícono pasa a puntitos; si no, el ícono pasa a puntitos.
 */
export function Enviar({ cargando, children, className = "", disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { cargando?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} className={`${className} ${pending ? "enviando" : ""}`} disabled={pending || disabled} aria-busy={pending}>
      {!pending ? (
        children
      ) : cargando ? (
        <>
          {cargando}
          <span className="btn-icono">
            <Puntos />
          </span>
        </>
      ) : (
        <Puntos />
      )}
    </button>
  );
}

/** Renglón fantasma donde va a aparecer el deseo mientras se guarda y se lee el link de la tienda. */
export function DeseoEnCamino() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="flex items-center gap-3" role="status" aria-label="Guardando tu deseo">
      <div className="esqueleto size-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="esqueleto h-3.5 w-3/5 rounded-full" />
        <div className="esqueleto h-2.5 w-2/5 rounded-full" />
      </div>
    </div>
  );
}

export function Copiar({ texto }: { texto: string }) {
  const [listo, setListo] = useState(false);
  return (
    <button
      type="button"
      className="btn w-full"
      onClick={async () => {
        if (navigator.share) return navigator.share({ title: "Súmate al intercambio de la GS", url: texto }).catch(() => {});
        await navigator.clipboard.writeText(texto);
        setListo(true);
        setTimeout(() => setListo(false), 2000);
      }}
    >
      {listo ? "Copiado, pégalo en el grupo" : "Pasar el link al grupo"}
      <span className="btn-icono">
        <Icono n="link" />
      </span>
    </button>
  );
}

export function CopiarTexto({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [listo, setListo] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost w-full"
      onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setListo(true);
        setTimeout(() => setListo(false), 2000);
      }}
    >
      <Icono n={listo ? "check" : "copiar"} className="size-[18px]" />
      {listo ? "Copiada" : etiqueta}
    </button>
  );
}

const R = 13;
const C = 2 * Math.PI * R;

/**
 * El nombre se ve borroso hasta que mantienes presionado: un anillo se llena alrededor de la huella
 * y al completarse el nombre se descifra letra por letra. La primera vez sueltan chispas.
 */
export function Revelar({ nombre }: { nombre: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [ver, setVer] = useState(false);
  const visible = useRef(false);
  const primera = useRef(true);
  const carga = useRef<gsap.core.Tween | null>(null);
  const descifrado = useRef<gsap.core.Tween | null>(null);
  const el = (sel: string) => raiz.current!.querySelector<HTMLElement>(sel)!;
  // Los tweens nacen en eventos; al desmontar se matan.
  useGSAP(() => () => gsap.killTweensOf(raiz.current?.querySelectorAll("*") ?? []), { scope: raiz });

  const chispas = (n: Element) => {
    const caja = raiz.current!.getBoundingClientRect();
    const r = n.getBoundingClientRect();
    for (let k = 0; k < 26; k++) {
      const c = document.createElement("span");
      c.className = "chispa";
      c.style.background = ["var(--accent)", "#f4c26b", "#fff1d6"][k % 3];
      raiz.current!.appendChild(c);
      gsap.set(c, { left: r.left - caja.left + gsap.utils.random(0, r.width), top: r.top - caja.top + r.height * gsap.utils.random(0.3, 0.8) });
      gsap.fromTo(
        c,
        { scale: gsap.utils.random(0.6, 1.6), opacity: 1 },
        {
          x: gsap.utils.random(-70, 70),
          y: gsap.utils.random(-140, -30),
          scale: 0,
          opacity: 0,
          duration: gsap.utils.random(0.9, 1.9),
          delay: gsap.utils.random(0, 0.3),
          ease: "power2.out",
          onComplete: () => c.remove(),
        },
      );
    }
  };

  const revelar = () => {
    visible.current = true;
    setVer(true);
    navigator.vibrate?.(15);
    const n = el(".nombre");
    gsap.set(el(".anillo"), { strokeDashoffset: 0 });
    gsap.to(n, { filter: "blur(0px)", opacity: 1, scale: 1, duration: 0.8, overwrite: "auto" });
    if (sinMovimiento()) return;
    // Mientras se descifra, la altura queda fija y las letras al azar salen del propio nombre (mismo ancho aprox.):
    // así la tarjeta no crece, el botón no se mueve bajo el dedo y el nombre no se esconde solo.
    gsap.set(n, { height: n.offsetHeight });
    descifrado.current = gsap.to(n, {
      duration: 1.1,
      scrambleText: { text: nombre, chars: nombre.replace(/\s/g, ""), speed: 0.5, revealDelay: 0.2 },
      onComplete: () => gsap.set(n, { clearProps: "height" }),
    });
    destellar(raiz.current!.closest(".bezel"));
    if (primera.current) {
      primera.current = false;
      chispas(n);
    }
  };

  const ocultar = () => {
    carga.current?.kill();
    gsap.to(el(".anillo"), { strokeDashoffset: C, duration: 0.4, ease: "power2.out" });
    if (!visible.current) return;
    visible.current = false;
    setVer(false);
    if (descifrado.current?.isActive()) {
      descifrado.current.kill();
      el(".nombre").textContent = nombre;
      gsap.set(el(".nombre"), { clearProps: "height" });
    }
    gsap.to(el(".nombre"), { filter: "blur(16px)", opacity: 0.55, scale: 0.98, duration: 0.5, ease: "power2.out", overwrite: "auto" });
  };

  const presionar = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Captura el puntero: aunque el dedo se mueva un poco, solo se esconde al soltar.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Puntero ya inexistente: se sigue sin captura.
    }
    if (sinMovimiento()) return revelar();
    carga.current = gsap.fromTo(el(".anillo"), { strokeDashoffset: C }, { strokeDashoffset: 0, duration: 0.6, ease: "power1.in", onComplete: revelar });
  };

  return (
    <div ref={raiz} className="relative space-y-5">
      <p className="nombre titulo select-none text-[54px] [text-wrap:balance]" style={{ filter: "blur(16px)", opacity: 0.55, transform: "scale(0.98)", transformOrigin: "0% 50%" }}>
        {nombre}
      </p>
      <button
        type="button"
        aria-pressed={ver}
        onPointerDown={presionar}
        onPointerUp={ocultar}
        onPointerCancel={ocultar}
        onLostPointerCapture={ocultar}
        onContextMenu={(e) => e.preventDefault()}
        // Teclado: Enter/Espacio alterna (click con detail 0 no viene de un puntero).
        onClick={(e) => e.detail === 0 && (visible.current ? ocultar() : revelar())}
        className="btn-ghost w-full touch-none select-none [-webkit-touch-callout:none]"
      >
        <span className="relative grid size-8 place-items-center">
          <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="16" cy="16" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
            <circle className="anillo" cx="16" cy="16" r={R} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
          </svg>
          <Icono n="huella" className="size-4 text-accent-text" />
        </span>
        {ver ? "Suelta para esconderlo" : "Deja presionado para ver"}
      </button>
    </div>
  );
}

type Mensaje = { id: number; de_santa: boolean; texto: string; creado: string };

export function Chat({ intercambio, receptor, soySanta, inicial }: { intercambio: string; receptor: string; soySanta: boolean; inicial: Mensaje[] }) {
  const [supabase] = useState(sb);
  const [mensajes, setMensajes] = useState(inicial);
  const [error, setError] = useState("");
  const fin = useRef<HTMLDivElement>(null);
  const agregar = (m: Mensaje) => setMensajes((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));

  useEffect(() => {
    // RLS filtra: solo llegan mensajes de hilos donde participo.
    const canal = supabase
      .channel(`chat-${intercambio}-${receptor}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensaje", filter: `receptor_id=eq.${receptor}` }, (p) => {
        if (p.new.intercambio_id === intercambio) agregar(p.new as Mensaje);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, intercambio, receptor]);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Cada burbuja nueva entra con resorte desde su lado.
  const lista = useRef<HTMLOListElement>(null);
  const vistos = useRef(inicial.length); // lo que ya estaba se muestra de una; solo lo nuevo anima
  useGSAP(
    () => {
      const todas = gsap.utils.toArray<HTMLElement>(".burbuja", lista.current);
      const nuevas = todas.slice(vistos.current);
      vistos.current = todas.length;
      if (!nuevas.length) return;
      if (sinMovimiento()) return;
      nuevas.forEach((el, k) => {
        const mia = el.dataset.mia === "1";
        gsap.fromTo(
          el,
          { autoAlpha: 0, x: mia ? 36 : -36, y: 12, scale: 0.8, transformOrigin: mia ? "100% 100%" : "0% 100%" },
          { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.9, ease: "back.out(1.7)", delay: Math.min(k, 10) * 0.05 },
        );
      });
    },
    { dependencies: [mensajes.length], scope: lista },
  );

  async function enviar(f: FormData) {
    const texto = String(f.get("texto") ?? "").trim();
    if (!texto) return;
    const { data, error } = await supabase
      .from("mensaje")
      .insert({ intercambio_id: intercambio, receptor_id: receptor, de_santa: soySanta, texto })
      .select("id, de_santa, texto, creado")
      .single();
    if (error) setError("No se envió. Revisa tu conexión e intenta otra vez.");
    else {
      setError("");
      destellar(document.querySelector("form .campo"));
      agregar(data);
    }
  }

  return (
    <>
      <ol ref={lista} className="flex flex-col gap-2 pb-28">
        {mensajes.length === 0 && (
          <li className="rounded-[26px] border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
            {soySanta ? "Pregúntale talla, colores, lo que sea. No va a saber que eres tú." : "Tu santa no ha escrito. Échale pistas de lo que quieres."}
          </li>
        )}
        {mensajes.map((m) => {
          const mio = m.de_santa === soySanta;
          return (
            <li
              key={m.id}
              data-mia={mio ? "1" : "0"}
              className={`burbuja max-w-[80%] rounded-[20px] px-4 py-2.5 text-[15px] leading-snug ${mio ? "self-end bg-ink text-bg" : "self-start border border-line bg-core"}`}
            >
              {m.texto}
            </li>
          );
        })}
        <div ref={fin} />
      </ol>
      <form action={enviar} className="fixed inset-x-0 bottom-0">
        <div className="relative mx-auto flex max-w-md gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && <p className="error absolute -top-14 left-5 right-5">{error}</p>}
          <label htmlFor="texto" className="sr-only">Mensaje</label>
          <div className="campo flex-1">
            <input id="texto" name="texto" placeholder="Escribe un mensaje" autoComplete="off" maxLength={1000} />
            <Enviar className="accion" aria-label="Enviar">
              <Icono n="enviar" className="size-5" />
            </Enviar>
          </div>
        </div>
      </form>
    </>
  );
}
