import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase";
import { Chat } from "../../../../cliente";
import { Barra } from "../../../../ui";

// /chat/persona: soy santa, le escribo a quien le regalo.
// /chat/santa:   soy receptor, le escribo a mi santa (anónimo para mí).
export default async function ChatPage({ params }: PageProps<"/i/[id]/chat/[quien]">) {
  const { id, quien } = await params;
  if (quien !== "persona" && quien !== "santa") notFound();
  const { supabase, user } = await sesion(`/i/${id}/chat/${quien}`);

  const soySanta = quien === "persona";
  let receptor = user.id;
  let titulo = "Tu santa";
  if (soySanta) {
    const { data: asig } = await supabase.from("asignacion").select("receptor_id").eq("intercambio_id", id).maybeSingle();
    if (!asig) notFound();
    receptor = asig.receptor_id;
  }

  const [{ data: inicial }, { data: p }] = await Promise.all([
    supabase.from("mensaje").select("id, de_santa, texto, creado").match({ intercambio_id: id, receptor_id: receptor }).order("id"),
    soySanta
      ? supabase.from("participante").select("nombre").match({ intercambio_id: id, usuario_id: receptor }).single()
      : Promise.resolve({ data: null }),
  ]);
  if (soySanta) titulo = p?.nombre ?? "Tu persona";

  return (
    <main>
      <Barra atras={`/i/${id}`}>
        <div className="text-right">
          <p className="text-[15px] font-medium leading-tight">{titulo}</p>
          <p className="dato mt-0.5">{soySanta ? "no sabe que eres tú" : "no sabes quién es"}</p>
        </div>
      </Barra>
      <Chat intercambio={id} receptor={receptor} soySanta={soySanta} inicial={inicial ?? []} />
    </main>
  );
}
