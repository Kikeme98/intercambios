import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function db() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión.
        }
      },
    },
  });
}

/**
 * Cliente + usuario, o manda a /entrar.
 * getClaims verifica el JWT localmente (llaves asimétricas de Supabase): sin viaje extra al servidor de auth.
 */
export async function sesion(next = "/") {
  const supabase = await db();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return { supabase, user: { id: c.sub, email: c.email, user_metadata: c.user_metadata ?? {} } };
}
