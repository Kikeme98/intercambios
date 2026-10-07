# Intercambio GS

Sorteo de intercambio con listas de deseos y chat anónimo. Next.js 16 + Supabase, en Vercel.

## Configurar

1. Crea un proyecto en [Supabase](https://supabase.com) y corre en orden los archivos de `supabase/migrations/` en el SQL Editor.
2. **Authentication → Providers**: activa Google (Client ID/Secret de Google Cloud). El correo con link ya viene activo.
3. **Authentication → URL Configuration**: Site URL = tu dominio de Vercel; agrega `https://tu-dominio/auth/callback` y `http://localhost:3000/auth/callback` a Redirect URLs.
4. Copia `.env.example` a `.env.local` con la URL y la publishable key (Project Settings → API).
5. Carga el catálogo de códigos postales (autollenado de colonia, municipio y estado). La llave secreta está en Project Settings → API Keys:
   `SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SECRET_KEY=sb_secret_... node scripts/cargar-cp.mjs`
   El catálogo de Correos de México es gratis para uso particular pero no se puede redistribuir: por eso no está en el repo, el script lo descarga de la fuente oficial.
6. `pnpm dev`

### Correos (opcionales)

La app avisa por correo cuando se hace el sorteo y cuando hay mensajes nuevos en el chat (máximo uno cada 30 min por conversación). Salen de una cuenta de Gmail:

1. Activa la verificación en dos pasos de esa cuenta y crea una [contraseña de aplicación](https://myaccount.google.com/apppasswords).
2. En Vercel, agrega (sin el prefijo `NEXT_PUBLIC_`):
   - `GMAIL_USER`: el Gmail.
   - `GMAIL_APP_PASSWORD`: la contraseña de aplicación.
   - `SUPABASE_SECRET_KEY`: la llave secreta de Supabase (para leer los correos de los participantes).
3. Opcional: en Supabase → Authentication → SMTP Settings usa `smtp.gmail.com`, puerto `465` y los mismos datos, para que los links de entrar salgan de ese Gmail y se quite el límite de 2 correos por hora.

Sin estas variables la app funciona igual y solo anota en el log del servidor los correos que habría mandado.

En Vercel: importa el repo y agrega las mismas dos variables de entorno (y las de correos, si los quieres).

## Privacidad

Todo se hace cumplir con RLS en `supabase/migrations/`: cada quien ve solo su asignación (el organizador incluido), la lista de deseos y la dirección de envío solo las ve tu santa, y los mensajes no guardan autor, solo `de_santa`.

## Pruebas

`node --test lib/util.test.ts`
