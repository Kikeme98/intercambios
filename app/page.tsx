import Link from "next/link";
import { ViewTransition } from "react";
import { sesion } from "@/lib/supabase";
import { fecha, pesos } from "@/lib/util";
import { crearIntercambio, salir } from "./actions";
import { Barra, Bezel, ErrorMsg, Icono } from "./ui";

export default async function Inicio({ searchParams }: PageProps<"/">) {
  const { error } = (await searchParams) as Record<string, string | undefined>;
  const { supabase } = await sesion();
  const { data: lista } = await supabase
    .from("intercambio")
    .select("id, nombre, fecha, presupuesto, estado")
    .order("creado", { ascending: false });

  return (
    <main>
      <Barra>
        <form action={salir}>
          <button className="btn-ghost h-10 px-4 text-sm text-muted">Salir</button>
        </form>
      </Barra>

      <h1 className="titulo text-[44px]">Tus intercambios</h1>
      <div className="mt-6">
        <ErrorMsg msg={error} />
      </div>

      <ul className="space-y-3">
        {lista?.map((i) => (
          <li key={i.id}>
            <Link href={`/i/${i.id}`} prefetch={true} data-tilt className="block [transform-style:preserve-3d]">
              <Bezel>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <ViewTransition name={`intercambio-${i.id}`}>
                      <p className="titulo truncate text-2xl">{i.nombre}</p>
                    </ViewTransition>
                    <p className="dato mt-2">
                      {[i.fecha && fecha(i.fecha), i.presupuesto && pesos(i.presupuesto)].filter(Boolean).join(" / ") || "Sin fecha"}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm ${i.estado === "sorteado" ? "text-accent-text" : "text-muted"}`}>
                    {i.estado === "sorteado" ? "Ya hay sorteo" : "Falta el sorteo"}
                  </span>
                </div>
              </Bezel>
            </Link>
          </li>
        ))}
        {lista?.length === 0 && (
          <li className="rounded-[32px] border border-dashed border-line p-8 text-center text-sm text-muted">
            Todavía no estás en ningún intercambio. Abre el link que te pasaron en el grupo o arma uno nuevo.
          </li>
        )}
      </ul>

      <details className="group mt-8 [&_summary::-webkit-details-marker]:hidden">
        <summary className="btn-ghost w-full cursor-pointer list-none">
          <Icono n="mas" className="size-4 transition-transform duration-300 group-open:rotate-45" /> Armar un intercambio
        </summary>
        <Bezel className="mt-3">
          <form action={crearIntercambio} className="space-y-4">
            <label className="block space-y-2">
              <span className="etiqueta">Nombre</span>
              <input name="nombre" required maxLength={80} placeholder="Navidad GS 2026" className="input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-2">
                <span className="etiqueta">Fecha</span>
                <input name="fecha" type="date" className="input" />
              </label>
              <label className="block space-y-2">
                <span className="etiqueta">Presupuesto</span>
                <input name="presupuesto" type="number" min={0} step={50} inputMode="numeric" placeholder="600" className="input" />
              </label>
            </div>
            <button className="btn w-full">
              Crear intercambio
              <span className="btn-icono">
                <Icono n="flecha" />
              </span>
            </button>
          </form>
        </Bezel>
      </details>
    </main>
  );
}
