import { redirect } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { unirse } from "../../actions";
import { Enviar } from "../../cliente";
import { Barra, Bezel, ErrorMsg, Icono } from "../../ui";

export default async function Unirse({ params, searchParams }: PageProps<"/unirse/[codigo]">) {
  const { codigo } = await params;
  const { error } = (await searchParams) as Record<string, string | undefined>;
  const { supabase, user } = await sesion(`/unirse/${codigo}`);
  // RLS solo deja ver un intercambio a sus miembros: si aparece, ya estás dentro.
  const { data: yaDentro } = await supabase.from("intercambio").select("id").eq("codigo", codigo).maybeSingle();
  if (yaDentro) redirect(`/i/${yaDentro.id}`);
  const nombre = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "";

  return (
    <main>
      <Barra atras="/" />
      <h1 className="titulo text-[44px]">Te invitaron al intercambio</h1>
      <p className="mt-3 text-muted">
        Primero dinos cómo quieres aparecer en la lista.
      </p>
      <Bezel className="mt-8">
        <form action={unirse} className="space-y-4">
          <ErrorMsg msg={error} />
          <input type="hidden" name="codigo" value={codigo} />
          <label className="block space-y-2">
            <span className="etiqueta">Tu nombre o apodo</span>
            <input name="nombre" required maxLength={40} defaultValue={nombre} className="input" />
          </label>
          <Enviar cargando="Apuntándote..." className="btn w-full">
            Me apunto
            <span className="btn-icono">
              <Icono n="flecha" />
            </span>
          </Enviar>
        </form>
      </Bezel>
    </main>
  );
}
