"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Flip } from "gsap/Flip";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { SplitText } from "gsap/SplitText";
import { modoLigero } from "@/lib/util";
import { Icono } from "./ui";

gsap.registerPlugin(useGSAP, Flip, ScrambleTextPlugin, SplitText);
gsap.defaults({ ease: "expo.out" });

export { gsap, useGSAP };
export const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Capa global montada una vez en el layout:
 * brillo que sigue al cursor, ícono magnético en CTAs, inclinación 3D de tarjetas con luz
 * y temblor del vidrio al tocarlo. Todo solo en pointer fino y sin reduced-motion.
 */
export function Efectos() {
  useEffect(() => {
    // Liquid glass con refracción real (backdrop-filter: url()) solo existe en Chromium.
    const marcas = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
    if (marcas?.some((m) => m.brand === "Chromium")) document.documentElement.classList.add("refraccion");
    const cancelarMedicion = decidirModoLigero();

    const mm = gsap.matchMedia();
    mm.add(
      { movimiento: "(prefers-reduced-motion: no-preference)", fino: "(hover: hover) and (pointer: fine)" },
      (ctx) => {
        const { movimiento, fino } = ctx.conditions as { movimiento: boolean; fino: boolean };

        if (!movimiento || !fino) return;

        // Brillo con mucha inercia
        const brillo = document.querySelector(".brillo-sigue");
        const bx = gsap.quickTo(brillo, "x", { duration: 3, ease: "power3.out" });
        const by = gsap.quickTo(brillo, "y", { duration: 3, ease: "power3.out" });

        // quickTo por elemento, cacheados
        const qts = new WeakMap<Element, Record<string, (v: number) => void>>();
        const q = (el: Element, props: string[], duration = 0.6) => {
          let r = qts.get(el);
          if (!r) {
            r = Object.fromEntries(props.map((p) => [p, gsap.quickTo(el, p, { duration, ease: "power3.out" })]));
            qts.set(el, r);
          }
          return r;
        };

        let iman: HTMLElement | null = null;
        let tilt: HTMLElement | null = null;
        const soltarIman = () => {
          if (!iman) return;
          const icono = iman.querySelector(".btn-icono");
          if (icono) gsap.to(icono, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
          iman = null;
        };
        const soltarTilt = () => {
          if (!tilt) return;
          gsap.to(tilt, { rotationX: 0, rotationY: 0, duration: 0.8, ease: "power3.out" });
          tilt.style.setProperty("--luz", "0");
          tilt = null;
        };

        const mover = (e: PointerEvent) => {
          bx((e.clientX - innerWidth / 2) * 0.3);
          by((e.clientY - innerHeight / 2) * 0.3);
          const t = e.target as Element;

          const btn = t.closest?.<HTMLElement>(".btn:not(:disabled)") ?? null;
          if (btn !== iman) soltarIman();
          if (btn) {
            // El botón se queda alineado con su grupo; solo el círculo del ícono busca el cursor.
            iman = btn;
            const icono = btn.querySelector(".btn-icono");
            if (icono) {
              const r = icono.getBoundingClientRect();
              const mi = q(icono, ["x", "y"], 0.5);
              mi.x(gsap.utils.clamp(-6, 6, (e.clientX - (r.left + r.width / 2)) * 0.15));
              mi.y(gsap.utils.clamp(-4, 4, (e.clientY - (r.top + r.height / 2)) * 0.15));
            }
          }

          const card = t.closest?.<HTMLElement>("[data-tilt] .bezel") ?? null;
          if (card !== tilt) soltarTilt();
          if (card) {
            tilt = card;
            const r = card.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            const m = q(card, ["rotationX", "rotationY"], 0.5);
            gsap.set(card, { transformPerspective: 900 });
            m.rotationX((0.5 - py) * 3);
            m.rotationY((px - 0.5) * 4);
            card.style.setProperty("--mx", `${px * 100}%`);
            card.style.setProperty("--my", `${py * 100}%`);
            card.style.setProperty("--luz", "1");
          }
        };
        // El vidrio "tiembla" al tocarlo: sube la distorsión y regresa con resorte.
        const desplazamiento = document.querySelector("#refraccion feDisplacementMap");
        const presionar = (e: PointerEvent) => {
          const t = e.target as Element;
          const btn = t.closest?.(".btn:not(:disabled)");
          if (btn) gsap.to(btn, { scale: 0.98, duration: 0.2, ease: "power2.out" });
          if (desplazamiento && t.closest?.(".vidrio, .bezel"))
            gsap.timeline({ overwrite: true })
              .to(desplazamiento, { attr: { scale: 90 }, duration: 0.18, ease: "power2.out" })
              .to(desplazamiento, { attr: { scale: 34 }, duration: 1.4, ease: "elastic.out(1, 0.3)" });
        };
        const levantar = () => gsap.to(".btn", { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" });
        const salir = () => {
          soltarIman();
          soltarTilt();
        };

        addEventListener("pointermove", mover, { passive: true });
        addEventListener("pointerdown", presionar);
        addEventListener("pointerup", levantar);
        document.documentElement.addEventListener("pointerleave", salir);
        return () => {
          removeEventListener("pointermove", mover);
          removeEventListener("pointerdown", presionar);
          removeEventListener("pointerup", levantar);
          document.documentElement.removeEventListener("pointerleave", salir);
        };
      },
    );
    return () => {
      cancelarMedicion();
      mm.revert();
    };
  }, []);
  return null;
}

const CLAVE_MODO = "intercambio-gs:modo-ligero";
const VIGENCIA = 3 * 24 * 60 * 60 * 1000; // vuelve a medir a los 3 días, por si fue algo pasajero

/**
 * Activa html.ligero si el equipo no aguanta el vidrio. Primero pistas del equipo; si no alcanzan,
 * mide fps 1.5 s (tras 1 s de calentamiento, y solo con la pestaña visible). Recuerda la decisión.
 * Devuelve una función para cancelar la medición.
 */
function decidirModoLigero() {
  const raiz = document.documentElement;
  const activar = () => raiz.classList.add("ligero");
  const guardar = (ligero: boolean) => {
    try {
      localStorage.setItem(CLAVE_MODO, JSON.stringify({ ligero, hasta: Date.now() + VIGENCIA }));
    } catch {}
  };
  try {
    const previo = JSON.parse(localStorage.getItem(CLAVE_MODO) ?? "null");
    if (previo && previo.hasta > Date.now()) {
      if (previo.ligero) activar();
      return () => {};
    }
  } catch {}

  const nav = navigator as Navigator & { deviceMemory?: number };
  const pistas = {
    memoriaGB: nav.deviceMemory,
    nucleos: nav.hardwareConcurrency || undefined,
    menosTransparencia: matchMedia("(prefers-reduced-transparency: reduce)").matches,
  };
  if (modoLigero(pistas)) {
    activar();
    guardar(true);
    return () => {};
  }

  let raf = 0;
  let espera = 0;
  let midiendo = false;
  const medir = () => {
    if (document.hidden || midiendo) return; // oculta: no hay cuadros; se intenta al volver
    midiendo = true;
    let cuadros = 0;
    let inicio = 0;
    let ultimo = 0;
    let reinicios = 0;
    const paso = (t: number) => {
      // Un hueco largo es una pausa (cambio de pestaña), no lentitud: se reinicia la medición.
      // Pero si pasa una y otra vez, el equipo de verdad no da: modo ligero.
      if (!inicio || t - ultimo > 250) {
        if (inicio && ++reinicios >= 5) {
          activar();
          guardar(true);
          document.removeEventListener("visibilitychange", medir);
          return;
        }
        inicio = t;
        cuadros = 0;
      }
      ultimo = t;
      cuadros++;
      if (t - inicio < 1500) raf = requestAnimationFrame(paso);
      else {
        const ligero = modoLigero({ ...pistas, fps: (cuadros * 1000) / (t - inicio) });
        if (ligero) activar();
        guardar(ligero);
        document.removeEventListener("visibilitychange", medir);
      }
    };
    raf = requestAnimationFrame(paso);
  };
  espera = window.setTimeout(medir, 1000);
  document.addEventListener("visibilitychange", medir);
  return () => {
    clearTimeout(espera);
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", medir);
  };
}

/** Titular que sube letra por letra desde una máscara por línea. */
export function TituloLetras({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(() => {
    if (sinMovimiento()) return;
    SplitText.create(ref.current, {
      type: "lines,chars",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.chars, { yPercent: 115, rotate: 8, transformOrigin: "0% 100%", duration: 1.2, stagger: 0.022, delay: 0.15 }),
    });
  });
  return (
    <h1 ref={ref} className={className} aria-label={children}>
      {children}
    </h1>
  );
}

/**
 * Sortear con drama: revuelve las fichas de participantes (Flip) y al final las regresa
 * a su orden (para no confundir a React) antes de mandar el formulario.
 */
export function BotonSortear({ deshabilitado }: { deshabilitado: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [revolviendo, setRevolviendo] = useState(false);
  const { pending } = useFormStatus();

  const sortear = () => {
    const form = ref.current?.form;
    const lista = document.querySelector<HTMLElement>("[data-fichas]");
    if (!form || revolviendo || pending) return;
    if (!lista || sinMovimiento()) return form.requestSubmit();
    setRevolviendo(true);
    const original = [...lista.children] as HTMLElement[];
    // Con absolute: true las fichas salen del flujo; fijar la altura evita que lo de abajo brinque.
    lista.style.minHeight = `${lista.offsetHeight}px`;
    lista.scrollIntoView({ behavior: "smooth", block: "center" });

    const tl = gsap.timeline({
      delay: 0.5,
      onComplete: () => {
        lista.style.minHeight = "";
        setRevolviendo(false);
        form.requestSubmit();
      },
    });
    const mover = (orden: HTMLElement[], dur: number) => () => {
      const estado = Flip.getState(original);
      orden.forEach((el) => lista.appendChild(el));
      Flip.from(estado, { duration: dur, ease: "power2.inOut", absolute: true, scale: true });
    };
    [0.45, 0.38, 0.32, 0.32, 0.38, 0.5].forEach((d) => {
      tl.call(mover(gsap.utils.shuffle([...original]), d)).to({}, { duration: d + 0.05 });
    });
    tl.call(mover(original, 0.6)).to({}, { duration: 0.65 });
  };

  return (
    <button ref={ref} type="button" onClick={sortear} className="btn w-full" disabled={deshabilitado}>
      <span>{revolviendo ? "Revolviendo papelitos..." : pending ? "Sorteando..." : "Sortear"}</span>
      <span className="btn-icono">
        <Icono n="regalo" />
      </span>
    </button>
  );
}
