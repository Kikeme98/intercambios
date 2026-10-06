import { entrarCorreo, entrarGoogle } from "../actions";
import { Enviar } from "../cliente";
import { TituloLetras } from "../motion";
import { ErrorMsg, Icono } from "../ui";

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { next = "/", enviado, error } = (await searchParams) as Record<string, string | undefined>;

  return (
    <main className="flex min-h-dvh flex-col justify-end gap-10 py-12">
      <div>
        <p className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
          <Icono n="arbol" className="size-[18px] text-[#3fb37f]" /> Intercambio GS
        </p>
        <TituloLetras className="titulo mt-6 pb-1 text-[56px]">Saca tu papelito.</TituloLetras>
        <p className="mt-4 max-w-[30ch] text-muted">
          Ve a quién te tocó, qué quiere y escríbele sin que sepa que eres tú.
        </p>
      </div>

      <div className="space-y-3">
        <ErrorMsg msg={error} />
        {enviado ? (
          <div className="bezel">
            <p className="bezel-core text-[15px]">Listo, revisa tu correo. Abre el link desde este mismo teléfono y entras directo.</p>
          </div>
        ) : (
          <>
            <form action={entrarGoogle}>
              <input type="hidden" name="next" value={next} />
              <Enviar cargando="Abriendo Google..." className="btn w-full">
                Entrar con Google
                <span className="btn-icono">
                  <Icono n="google" />
                </span>
              </Enviar>
            </form>
            <form action={entrarCorreo} className="campo">
              <input type="hidden" name="next" value={next} />
              <label htmlFor="email" className="sr-only">Correo</label>
              <input id="email" type="email" name="email" required autoComplete="email" placeholder="O entra con tu correo" />
              <Enviar className="accion" aria-label="Mandarme el link para entrar">
                <Icono n="flecha" />
              </Enviar>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
