import Link from "next/link";
import { ViewTransition } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { diasPara, fecha, formatoDireccion, pesos, type Direccion } from "@/lib/util";
import { agregarDeseo, agregarExclusion, borrarDeseo, borrarExclusion, borrarIntercambio, deshacerSorteo, editarIntercambio, guardarDireccion, quitarParticipante, sortear } from "../../actions";
import { CamposDireccion, Copiar, CopiarTexto, Revelar } from "../../cliente";
import { BotonSortear } from "../../motion";
import { Barra, Bezel, ErrorMsg, Icono } from "../../ui";

type Deseo = { id: string; usuario_id: string; texto: string; url: string | null; imagen: string | null; precio: number | null };

export default async function Intercambio({ params, searchParams }: PageProps<"/i/[id]">) {
  const { id } = await params;
  const { error } = (await searchParams) as Record<string, string | undefined>;
  const { supabase, user } = await sesion(`/i/${id}`);

  const [{ data: i }, { data: gente = [] }, { data: asig }, { data: deseos = [] }, { data: exclusiones = [] }, { data: direcciones = [] }] = await Promise.all([
    supabase.from("intercambio").select("*").eq("id", id).maybeSingle(),
    supabase.from("participante").select("usuario_id, nombre").eq("intercambio_id", id).order("nombre"),
    supabase.from("asignacion").select("receptor_id").eq("intercambio_id", id).maybeSingle(),
    supabase.from("deseo").select("*").eq("intercambio_id", id).order("creado"),
    supabase.from("exclusion").select("usuario_a, usuario_b").eq("intercambio_id", id), // RLS: vacío si no eres organizador
    supabase.from("direccion").select("*").eq("intercambio_id", id), // RLS: solo la tuya y la de tu persona
  ]);
  if (!i) notFound();

  const soyOrg = i.organizador_id === user.id;
  const abierto = i.estado === "abierto";
  const nombre = (uid: string) => gente!.find((p) => p.usuario_id === uid)?.nombre ?? "Alguien";
  const misDeseos = deseos!.filter((d) => d.usuario_id === user.id);
  const susDeseos = asig ? deseos!.filter((d) => d.usuario_id === asig.receptor_id) : [];
  const miDireccion: Direccion | undefined = direcciones!.find((d) => d.usuario_id === user.id);
  const suDireccion: Direccion | undefined = asig ? direcciones!.find((d) => d.usuario_id === asig.receptor_id) : undefined;
  const faltan = i.fecha ? diasPara(i.fecha) : null;
  const h = await headers();
  const invitacion = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/unirse/${i.codigo}`;

  return (
    <main>
      <Barra atras="/">
        {faltan !== null && faltan >= 0 && (
          <span className="dato">
            faltan {faltan} d
          </span>
        )}
      </Barra>

      <header>
        <ViewTransition name={`intercambio-${id}`}>
          <h1 className="titulo text-[40px]">{i.nombre}</h1>
        </ViewTransition>
        <p className="dato mt-3">
          {[i.fecha && fecha(i.fecha), i.presupuesto && `tope ${pesos(i.presupuesto)}`, `${gente!.length} personas`].filter(Boolean).join(" / ")}
        </p>
        {soyOrg && (
          <details className="group mt-4 [&_summary::-webkit-details-marker]:hidden">
            <summary className="btn-ghost h-10 w-fit cursor-pointer list-none px-4 text-sm group-open:hidden">Editar intercambio</summary>
            <Bezel>
              <form action={editarIntercambio} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <label className="block space-y-2">
                  <span className="etiqueta">Nombre</span>
                  <input name="nombre" required maxLength={80} defaultValue={i.nombre} className="input" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-2">
                    <span className="etiqueta">Fecha</span>
                    <input name="fecha" type="date" defaultValue={i.fecha ?? ""} className="input" />
                  </label>
                  <label className="block space-y-2">
                    <span className="etiqueta">Presupuesto</span>
                    <input name="presupuesto" type="number" min={0} step={50} inputMode="numeric" defaultValue={i.presupuesto ?? ""} className="input" />
                  </label>
                </div>
                <button className="btn w-full">
                  Guardar cambios
                  <span className="btn-icono">
                    <Icono n="check" />
                  </span>
                </button>
              </form>
            </Bezel>
          </details>
        )}
      </header>

      <div className="mt-6">
        <ErrorMsg msg={error} />
      </div>

      <div className="space-y-5">
        {asig ? (
          <>
            <Bezel>
              <div className="space-y-5">
                <p className="etiqueta">Te tocó</p>
                <Revelar nombre={nombre(asig.receptor_id)} />
              </div>
            </Bezel>

            <Bezel>
              <p className="etiqueta mb-4">Su lista</p>
              <div className="space-y-4">
                {susDeseos.length ? (
                  susDeseos.map((d) => <Item key={d.id} d={d} presupuesto={i.presupuesto} />)
                ) : (
                  <p className="text-[15px] text-muted">Todavía no pide nada. Pregúntale por el chat, no va a saber que eres tú.</p>
                )}
              </div>
            </Bezel>

            <Bezel>
              <p className="etiqueta mb-4">A dónde mandarlo</p>
              {suDireccion ? (
                // Plegada: trae su nombre completo y no debe verse de reojo (igual que el nombre de arriba).
                <details className="group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="btn-ghost w-full cursor-pointer list-none group-open:hidden">Ver dirección</summary>
                  <div className="space-y-4">
                    <p className="whitespace-pre-line text-[15px] leading-relaxed">{formatoDireccion(suDireccion)}</p>
                    <CopiarTexto texto={formatoDireccion(suDireccion)} etiqueta="Copiar dirección" />
                  </div>
                </details>
              ) : (
                <p className="text-[15px] text-muted">Todavía no pone su dirección. Pídesela por el chat, sin que sepa que eres tú.</p>
              )}
            </Bezel>

            <div className="flex flex-col gap-2.5">
              <Link href={`/i/${id}/chat/persona`} prefetch={true} className="btn w-full">
                Escribirle de incógnito
                <span className="btn-icono">
                  <Icono n="flecha" />
                </span>
              </Link>
              <Link href={`/i/${id}/chat/santa`} prefetch={true} className="btn-ghost w-full">
                <Icono n="chat" className="size-[18px]" /> Mensajes de tu santa
              </Link>
            </div>
          </>
        ) : (
          <Bezel>
            <div className="space-y-5">
              <div className="flex gap-3">
                <Icono n="regalo" className="mt-0.5 size-5 shrink-0 text-accent-text" />
                <p className="text-[15px]">Todavía no hay sorteo. Pasa el link al grupo y arma tu lista, para que esta vez no te toque otra taza.</p>
              </div>
              <Copiar texto={invitacion} />
            </div>
          </Bezel>
        )}

        <section className="pt-4">
          <h2 className="titulo mb-4 text-2xl">Tu lista</h2>
          <div className="space-y-4">
            {misDeseos.map((d) => (
              <Item key={d.id} d={d} presupuesto={i.presupuesto} borrar={id} />
            ))}
          </div>
          <form action={agregarDeseo} className="grupo mt-4">
            <input type="hidden" name="id" value={id} />
            <div className="flex h-12 items-center px-4">
              <label htmlFor="texto" className="sr-only">Deseo</label>
              <input id="texto" name="texto" maxLength={200} placeholder="¿Qué se te antoja?" />
            </div>
            <div className="mx-4 h-px bg-line" />
            <div className="flex h-14 items-center gap-2 pl-4">
              <label htmlFor="url" className="sr-only">Link</label>
              <input id="url" name="url" type="url" inputMode="url" placeholder="Link de la tienda (opcional)" />
              <button className="accion" aria-label="Agregar deseo">
                <Icono n="mas" />
              </button>
            </div>
          </form>
        </section>

        <section className="pt-4">
          <h2 className="titulo text-2xl">Tu dirección</h2>
          <p className="etiqueta mt-1 mb-4">Para que te llegue el regalo. Solo la ve quien te va a regalar.</p>
          {miDireccion ? (
            <Bezel>
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{formatoDireccion(miDireccion)}</p>
              <details className="group mt-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="btn-ghost h-10 w-fit cursor-pointer list-none px-4 text-sm group-open:hidden">Editar</summary>
                <FormDireccion id={id} d={miDireccion} />
              </details>
            </Bezel>
          ) : (
            <Bezel>
              <FormDireccion id={id} />
            </Bezel>
          )}
        </section>

        {/* Todas las listas (RLS: cualquier miembro las ve). Sin marcar a tu persona: delataría el nombre que se difumina arriba. */}
        {gente!.length > 1 && (
          <section className="pt-4">
            <h2 className="titulo text-2xl">Lo que pide cada quien</h2>
            <p className="etiqueta mt-1 mb-4">Para inspirarte o para no repetir regalo.</p>
            <div className="space-y-2">
              {gente!
                .filter((p) => p.usuario_id !== user.id)
                .map((p) => {
                  const suyos = deseos!.filter((d) => d.usuario_id === p.usuario_id);
                  return (
                    <details key={p.usuario_id} className="group bezel [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                        <span className="truncate text-[15px] font-medium">{p.nombre}</span>
                        <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
                          {suyos.length ? `${suyos.length} ${suyos.length === 1 ? "cosa" : "cosas"}` : "Todavía nada"}
                          <Icono n="mas" className="size-4 transition-transform duration-300 group-open:rotate-45" />
                        </span>
                      </summary>
                      <div className="bezel-core space-y-4">
                        {suyos.length ? (
                          suyos.map((d) => <Item key={d.id} d={d} presupuesto={i.presupuesto} />)
                        ) : (
                          <p className="text-[15px] text-muted">Aún no agrega nada a su lista.</p>
                        )}
                      </div>
                    </details>
                  );
                })}
            </div>
          </section>
        )}

        <section className="pt-4">
          <h2 className="titulo mb-4 text-2xl">Participantes</h2>
          <ul data-fichas className="flex flex-wrap gap-2">
            {gente!.map((p) => (
              <li key={p.usuario_id} className="crece vidrio flex h-10 items-center gap-1 rounded-full pl-4 pr-1.5 text-[15px]">
                {p.nombre}
                {p.usuario_id === i.organizador_id && <span className="dato ml-1 mr-2.5">organiza</span>}
                {abierto && (soyOrg || p.usuario_id === user.id) && p.usuario_id !== i.organizador_id ? (
                  <form action={quitarParticipante}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="usuario" value={p.usuario_id} />
                    <button className="grid size-7 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-ink" aria-label={`Quitar a ${p.nombre}`}>
                      <Icono n="x" className="size-3.5" />
                    </button>
                  </form>
                ) : (
                  p.usuario_id !== i.organizador_id && <span className="w-2.5" />
                )}
              </li>
            ))}
          </ul>
        </section>

        {soyOrg && abierto && (
          <Bezel>
            <div className="space-y-5">
              <div>
                <p className="font-medium">Exclusiones</p>
                <p className="etiqueta mt-1">Quiénes no se pueden tocar entre sí, como parejas o hermanos.</p>
                <ul className="mt-4 space-y-2">
                  {exclusiones!.map((e) => (
                    <li key={e.usuario_a + e.usuario_b} className="crece flex items-center justify-between rounded-full bg-white/5 py-1.5 pl-5 pr-1.5 text-sm">
                      {nombre(e.usuario_a)} y {nombre(e.usuario_b)}
                      <form action={borrarExclusion}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="a" value={e.usuario_a} />
                        <input type="hidden" name="b" value={e.usuario_b} />
                        <button className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-ink" aria-label="Quitar exclusión">
                          <Icono n="x" className="size-4" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form action={agregarExclusion} className="campo mt-3">
                  <input type="hidden" name="id" value={id} />
                  <select name="a" required aria-label="Primera persona" defaultValue="">
                    <option value="" disabled>Persona</option>
                    {gente!.map((p) => (
                      <option key={p.usuario_id} value={p.usuario_id}>{p.nombre}</option>
                    ))}
                  </select>
                  <span className="text-sm text-muted">y</span>
                  <select name="b" required aria-label="Segunda persona" defaultValue="">
                    <option value="" disabled>Persona</option>
                    {gente!.map((p) => (
                      <option key={p.usuario_id} value={p.usuario_id}>{p.nombre}</option>
                    ))}
                  </select>
                  <button className="accion" aria-label="Agregar exclusión">
                    <Icono n="mas" />
                  </button>
                </form>
              </div>
              <form action={sortear} className="border-t border-line pt-5">
                <input type="hidden" name="id" value={id} />
                <BotonSortear deshabilitado={gente!.length < 3} />
                <p className="etiqueta mt-3 text-center text-xs">Después ya nadie se puede unir. Y ni tú vas a saber a quién le tocó quién.</p>
              </form>
            </div>
          </Bezel>
        )}
        {soyOrg && (
          <section className="space-y-2 pt-4">
            <h2 className="titulo mb-2 text-2xl">Zona de quien organiza</h2>
            {!abierto && (
              <Confirmar
                accion={deshacerSorteo}
                id={id}
                boton="Deshacer sorteo"
                aviso="El intercambio vuelve a estar abierto: puedes agregar o quitar gente, cambiar exclusiones y volver a sortear. Se borran las asignaciones y todos los chats, para que nadie lea mensajes que eran para otro santa."
                confirmo="Sí, deshacer el sorteo y borrar los chats"
              />
            )}
            <Confirmar
              accion={borrarIntercambio}
              id={id}
              boton="Borrar intercambio"
              aviso="Se borra todo: participantes, listas, direcciones, sorteo y chats. No se puede recuperar."
              confirmo="Sí, borrar el intercambio completo"
            />
          </section>
        )}
      </div>
    </main>
  );
}

/** Acción destructiva: se despliega, explica qué pasa y exige marcar una casilla. */
function Confirmar({ accion, id, boton, aviso, confirmo }: { accion: (f: FormData) => Promise<void>; id: string; boton: string; aviso: string; confirmo: string }) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden">
      <summary className="btn-ghost w-full cursor-pointer list-none text-accent-text group-open:hidden">{boton}</summary>
      <Bezel>
        <form action={accion} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-[15px]">{aviso}</p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="confirmo" value="si" required className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
            {confirmo}
          </label>
          <button className="btn w-full">
            {boton}
            <span className="btn-icono">
              <Icono n="x" />
            </span>
          </button>
        </form>
      </Bezel>
    </details>
  );
}

function Item({ d, presupuesto, borrar }: { d: Deseo; presupuesto: number | null; borrar?: string }) {
  const caro = presupuesto && d.precio && d.precio > presupuesto;
  return (
    <div className="crece flex items-center gap-3">
      {d.imagen ? (
        // eslint-disable-next-line @next/next/no-img-element -- imágenes de cualquier tienda
        <img src={d.imagen} alt="" className="size-12 shrink-0 rounded-full bg-white object-contain p-1" />
      ) : (
        <div className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-glass text-muted">
          <Icono n="regalo" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] leading-snug">{d.texto}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted">
          {d.precio && <span>{pesos(d.precio)}</span>}
          {caro && <span className="text-accent-text">se pasa del tope</span>}
          {d.url && (
            <a href={d.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-0.5 hover:text-ink">
              {new URL(d.url).hostname.replace(/^(www|articulo)\./, "")}
              <Icono n="flecha" className="size-3" />
            </a>
          )}
        </p>
      </div>
      {borrar && (
        <form action={borrarDeseo}>
          <input type="hidden" name="id" value={borrar} />
          <input type="hidden" name="deseo" value={d.id} />
          <button className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-ink" aria-label="Quitar deseo">
            <Icono n="x" className="size-4" />
          </button>
        </form>
      )}
    </div>
  );
}

function FormDireccion({ id, d }: { id: string; d?: Direccion }) {
  return (
    <form action={guardarDireccion} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <CamposDireccion d={d} />
      <Campo nombre="recibe" etiqueta="Quién recibe" auto="name" valor={d?.recibe} />
      <Campo nombre="telefono" etiqueta="Teléfono (10 dígitos)" auto="tel-national" valor={d?.telefono} tipo="tel" modo="tel" />
      <Campo nombre="referencias" etiqueta="Referencias (opcional)" valor={d?.referencias ?? undefined} requerido={false} max={200} ayuda="Entre calles, color de la casa..." />
      <button className="btn mt-2 w-full">
        Guardar dirección
        <span className="btn-icono">
          <Icono n="check" />
        </span>
      </button>
    </form>
  );
}

function Campo(p: { nombre: string; etiqueta: string; auto?: string; valor?: string; tipo?: string; modo?: "tel"; max?: number; requerido?: boolean; ayuda?: string }) {
  return (
    <label className="block space-y-2">
      <span className="etiqueta">{p.etiqueta}</span>
      <input
        name={p.nombre}
        type={p.tipo ?? "text"}
        inputMode={p.modo}
        maxLength={p.max ?? 120}
        required={p.requerido ?? true}
        autoComplete={p.auto ?? "off"}
        defaultValue={p.valor}
        placeholder={p.ayuda}
        className="input"
      />
    </label>
  );
}
