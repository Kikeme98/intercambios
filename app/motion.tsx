"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Flip } from "gsap/Flip";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { SplitText } from "gsap/SplitText";
import { Icono } from "./ui";

gsap.registerPlugin(useGSAP, Flip, ScrambleTextPlugin, SplitText);
gsap.defaults({ ease: "expo.out" });

export { gsap, useGSAP };
export const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Superficies que se comportan como cristal: destello al tocar y brillo especular que sigue al puntero. */
const SUPERFICIES = ".bezel, .btn, .btn-ghost, .redondo, .campo, .grupo";

/** Hace pasar un destello de luz por la superficie (al tocar o en momentos clave). */
export function destellar(el: Element | null | undefined) {
  if (!el || sinMovimiento()) return;
  el.classList.remove("destello");
  void (el as HTMLElement).offsetWidth; // reinicia la animación aunque siga en curso
  el.classList.add("destello");
}

/**
 * Capa global montada una vez en el layout:
 * - Cristal: destello al tocar, brillo especular que sigue al cursor (o al dedo mientras presionas).
 * - Desplegables (<details>) que crecen y se encogen con su contenido, en todos los navegadores.
 * - Solo con puntero fino: brillo de fondo con inercia, ícono magnético en CTAs e inclinación 3D de tarjetas.
 * - html.montado: lo que se agrega después de cargar la pantalla crece al aparecer (ver .crece).
 * Todo se apaga con reduced-motion.
 */
export function Efectos() {
  const ruta = usePathname();
  // Al cambiar de pantalla, lo nuevo aparece de una (no crece); a partir del siguiente cuadro, lo que se agregue sí.
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.remove("montado");
    const id = requestAnimationFrame(() => raiz.classList.add("montado"));
    return () => cancelAnimationFrame(id);
  }, [ruta]);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { movimiento: "(prefers-reduced-motion: no-preference)", fino: "(hover: hover) and (pointer: fine)" },
      (ctx) => {
        const { movimiento, fino } = ctx.conditions as { movimiento: boolean; fino: boolean };
        if (!movimiento) return;

        // --- Cristal: brillo especular ---
        let iluminada: HTMLElement | null = null;
        let presionando = false;
        const apagar = () => {
          iluminada?.style.setProperty("--luz", "0");
          iluminada = null;
        };
        const iluminar = (e: PointerEvent) => {
          const el = (e.target as Element).closest?.<HTMLElement>(SUPERFICIES) ?? null;
          if (el !== iluminada) apagar();
          if (!el) return;
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${e.clientX - r.left}px`);
          el.style.setProperty("--my", `${e.clientY - r.top}px`);
          el.style.setProperty("--luz", "1");
          iluminada = el;
        };

        // --- Desplegables que crecen ---
        const alternar = (e: MouseEvent) => {
          const resumen = (e.target as Element).closest?.("summary");
          const d = resumen?.parentElement;
          if (!(d instanceof HTMLDetailsElement) || resumen !== d.querySelector(":scope > summary")) return;
          e.preventDefault();
          if (gsap.isTweening(d)) return;
          const desde = d.offsetHeight;
          const contenido = [...d.children].filter((c) => c !== resumen);
          if (!d.open) {
            d.open = true;
            const hasta = d.offsetHeight;
            gsap.fromTo(d, { height: desde, overflow: "hidden" }, { height: hasta, duration: 0.6, ease: "expo.out", clearProps: "height,overflow" });
            gsap.fromTo(contenido, { opacity: 0, y: -10, scale: 0.97, transformOrigin: "50% 0%" }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "expo.out", clearProps: "all" });
          } else {
            d.open = false;
            const hasta = d.offsetHeight; // altura cerrado
            d.open = true;
            gsap.to(contenido, { opacity: 0, duration: 0.2 });
            gsap.fromTo(
              d,
              { height: desde, overflow: "hidden" },
              {
                height: hasta,
                duration: 0.45,
                ease: "expo.inOut",
                onComplete: () => {
                  d.open = false;
                  gsap.set(d, { clearProps: "height,overflow" });
                  gsap.set(contenido, { clearProps: "opacity" });
                },
              },
            );
          }
        };

        const presionar = (e: PointerEvent) => {
          presionando = true;
          const t = e.target as Element;
          destellar(t.closest?.(SUPERFICIES));
          iluminar(e);
          const btn = t.closest?.(".btn:not(:disabled)");
          if (btn) gsap.to(btn, { scale: 0.98, duration: 0.2, ease: "power2.out" });
        };
        const levantar = () => {
          presionando = false;
          if (!fino) apagar();
          gsap.to(".btn", { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" });
        };

        // --- Solo puntero fino: fondo, imán e inclinación ---
        const brillo = document.querySelector(".brillo-sigue");
        const bx = fino ? gsap.quickTo(brillo, "x", { duration: 3, ease: "power3.out" }) : null;
        const by = fino ? gsap.quickTo(brillo, "y", { duration: 3, ease: "power3.out" }) : null;
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
          tilt = null;
        };

        const mover = (e: PointerEvent) => {
          if (fino || presionando) iluminar(e);
          if (!fino) return;
          bx!((e.clientX - innerWidth / 2) * 0.3);
          by!((e.clientY - innerHeight / 2) * 0.3);
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
          }
        };
        const salir = () => {
          apagar();
          soltarIman();
          soltarTilt();
        };

        addEventListener("pointermove", mover, { passive: true });
        addEventListener("pointerdown", presionar);
        addEventListener("pointerup", levantar);
        addEventListener("pointercancel", levantar);
        document.addEventListener("click", alternar);
        document.documentElement.addEventListener("pointerleave", salir);
        return () => {
          removeEventListener("pointermove", mover);
          removeEventListener("pointerdown", presionar);
          removeEventListener("pointerup", levantar);
          removeEventListener("pointercancel", levantar);
          document.removeEventListener("click", alternar);
          document.documentElement.removeEventListener("pointerleave", salir);
        };
      },
    );
    return () => mm.revert();
  }, []);
  return null;
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
    // Mover fichas cuenta como "recién agregadas" y las haría crecer en cada barajada: se apaga mientras tanto.
    document.documentElement.classList.remove("montado");
    const original = [...lista.children] as HTMLElement[];
    // Con absolute: true las fichas salen del flujo; fijar la altura evita que lo de abajo brinque.
    lista.style.minHeight = `${lista.offsetHeight}px`;
    lista.scrollIntoView({ behavior: "smooth", block: "center" });

    const tl = gsap.timeline({
      delay: 0.5,
      onComplete: () => {
        document.documentElement.classList.add("montado");
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
