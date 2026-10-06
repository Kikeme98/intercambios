-- Intercambio GS 001: esquema inicial. Correr en orden los archivos de supabase/migrations (SQL Editor o MCP).
-- La privacidad vive aquí (RLS), no en el frontend.

create table intercambio (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(nombre) between 1 and 80),
  fecha date,
  presupuesto int check (presupuesto >= 0),
  codigo text not null unique default substr(md5(random()::text), 1, 8),
  organizador_id uuid not null default auth.uid() references auth.users on delete cascade,
  estado text not null default 'abierto' check (estado in ('abierto', 'sorteado')),
  creado timestamptz not null default now()
);

create table participante (
  intercambio_id uuid references intercambio on delete cascade,
  usuario_id uuid references auth.users on delete cascade,
  nombre text not null,
  primary key (intercambio_id, usuario_id)
);

-- Simétrica: a no le regala a b, ni b a a.
create table exclusion (
  intercambio_id uuid references intercambio on delete cascade,
  usuario_a uuid not null,
  usuario_b uuid not null,
  primary key (intercambio_id, usuario_a, usuario_b),
  check (usuario_a <> usuario_b)
);

create table asignacion (
  intercambio_id uuid references intercambio on delete cascade,
  santa_id uuid not null,
  receptor_id uuid not null,
  primary key (intercambio_id, santa_id),
  unique (intercambio_id, receptor_id)
);

create table deseo (
  id uuid primary key default gen_random_uuid(),
  intercambio_id uuid not null,
  usuario_id uuid not null default auth.uid(),
  texto text not null check (length(texto) between 1 and 200),
  url text check (url ~ '^https?://'),
  imagen text,
  precio numeric,
  creado timestamptz not null default now(),
  foreign key (intercambio_id, usuario_id) references participante on delete cascade
);

-- Un hilo por receptor: de_santa marca quién habla, sin guardar el autor.
-- Así el receptor nunca puede saber quién es su santa, ni leyendo la base.
create table mensaje (
  id bigint generated always as identity primary key,
  intercambio_id uuid not null,
  receptor_id uuid not null,
  de_santa boolean not null,
  texto text not null check (length(texto) between 1 and 1000),
  creado timestamptz not null default now(),
  foreign key (intercambio_id, receptor_id) references participante on delete cascade
);

-- Helpers security definer (evitan recursión de RLS)
create function es_miembro(i uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from participante where intercambio_id = i and usuario_id = auth.uid())
$$;

create function es_organizador(i uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from intercambio where id = i and organizador_id = auth.uid())
$$;

create function es_santa_de(i uuid, receptor uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from asignacion where intercambio_id = i and santa_id = auth.uid() and receptor_id = receptor)
$$;

alter table intercambio enable row level security;
alter table participante enable row level security;
alter table exclusion enable row level security;
alter table asignacion enable row level security;
alter table deseo enable row level security;
alter table mensaje enable row level security;

create policy ver on intercambio for select using (es_miembro(id) or organizador_id = auth.uid());
create policy crear on intercambio for insert with check (organizador_id = auth.uid());
create policy editar on intercambio for update using (organizador_id = auth.uid() and estado = 'abierto');
create policy borrar on intercambio for delete using (organizador_id = auth.uid());

create policy ver on participante for select using (es_miembro(intercambio_id));
create policy salir on participante for delete using (
  (usuario_id = auth.uid() or es_organizador(intercambio_id))
  and (select estado from intercambio where id = intercambio_id) = 'abierto'
);

-- Exclusiones: solo el organizador las ve y las edita.
create policy ver on exclusion for select using (es_organizador(intercambio_id));
create policy crear on exclusion for insert with check (es_organizador(intercambio_id));
create policy borrar on exclusion for delete using (es_organizador(intercambio_id));

-- Cada quien ve solo a quién le regala. El organizador tampoco ve el resto.
create policy ver on asignacion for select using (santa_id = auth.uid());

create policy ver on deseo for select using (usuario_id = auth.uid() or es_santa_de(intercambio_id, usuario_id));
create policy crear on deseo for insert with check (usuario_id = auth.uid());
create policy borrar on deseo for delete using (usuario_id = auth.uid());

create policy ver on mensaje for select using (receptor_id = auth.uid() or es_santa_de(intercambio_id, receptor_id));
create policy crear on mensaje for insert with check (
  case when de_santa then es_santa_de(intercambio_id, receptor_id) else receptor_id = auth.uid() end
);

-- Al crear un intercambio, el organizador entra como participante.
create function al_crear_intercambio() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into participante values (new.id, new.organizador_id,
    coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = new.organizador_id),
             (select split_part(email, '@', 1) from auth.users where id = new.organizador_id)));
  return new;
end $$;
create trigger al_crear after insert on intercambio for each row execute function al_crear_intercambio();

-- Unirse con el código del link de invitación.
create or replace function unirse(cod text, nombre_visible text) returns uuid language plpgsql security definer set search_path = public as $$
declare i intercambio;
begin
  select * into i from intercambio where codigo = cod;
  if i is null then raise exception 'Ese link de invitación no existe. Pide uno nuevo a quien organiza.'; end if;
  if i.estado <> 'abierto' then raise exception 'Llegaste tarde: este intercambio ya se sorteó.'; end if;
  insert into participante values (i.id, auth.uid(), left(trim(nombre_visible), 40))
    on conflict do nothing;
  return i.id;
end $$;

-- Sorteo: baraja y forma un solo ciclo (nadie se saca a sí mismo, no hay parejas A<->B).
-- ponytail: reintento aleatorio, basta para grupos chicos; backtracking si hay muchas exclusiones.
create or replace function sortear(i uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  p uuid[];
  n int;
  intento int;
  ok boolean;
begin
  if not es_organizador(i) then raise exception 'Solo quien organiza puede sortear.'; end if;
  if (select estado from intercambio where id = i) <> 'abierto' then raise exception 'Este intercambio ya se sorteó.'; end if;
  select count(*) into n from participante where intercambio_id = i;
  if n < 3 then raise exception 'Se necesitan al menos 3 personas para sortear.'; end if;

  for intento in 1..2000 loop
    select array_agg(usuario_id order by random()) into p from participante where intercambio_id = i;
    select not exists (
      select 1 from generate_series(1, n) k
      join exclusion e on e.intercambio_id = i
        and ((e.usuario_a = p[k] and e.usuario_b = p[k % n + 1])
          or (e.usuario_b = p[k] and e.usuario_a = p[k % n + 1]))
    ) into ok;
    if ok then
      insert into asignacion select i, p[k], p[k % n + 1] from generate_series(1, n) k;
      update intercambio set estado = 'sorteado' where id = i;
      return;
    end if;
  end loop;
  raise exception 'Con tantas exclusiones no sale el sorteo. Quita alguna e intenta otra vez.';
end $$;

-- Chat en vivo
alter publication supabase_realtime add table mensaje;

-- Dirección de envío (intercambio en línea). Solo la ven su dueño y su santa.
create table direccion (
  intercambio_id uuid not null,
  usuario_id uuid not null default auth.uid(),
  recibe text not null check (length(recibe) between 1 and 80),
  calle text not null check (length(calle) between 1 and 120),
  colonia text not null check (length(colonia) between 1 and 80),
  cp text not null check (cp ~ '^[0-9]{5}$'),
  ciudad text not null check (length(ciudad) between 1 and 80),
  estado text not null check (length(estado) between 1 and 40),
  telefono text not null check (telefono ~ '^[0-9]{10}$'),
  referencias text check (length(referencias) <= 200),
  primary key (intercambio_id, usuario_id),
  foreign key (intercambio_id, usuario_id) references participante on delete cascade
);
alter table direccion enable row level security;
create policy ver on direccion for select using (usuario_id = auth.uid() or es_santa_de(intercambio_id, usuario_id));
create policy crear on direccion for insert with check (usuario_id = auth.uid());
create policy editar on direccion for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Catálogo de códigos postales (SEPOMEX). Se llena con scripts/cargar-cp.mjs, no se versiona:
-- Correos de México lo da gratis para uso particular pero prohíbe redistribuirlo.
create table codigo_postal (
  id bigint generated always as identity primary key,
  cp text not null,
  colonia text not null,
  municipio text not null,
  estado text not null
);
create index codigo_postal_cp on codigo_postal (cp);
alter table codigo_postal enable row level security;
create policy ver on codigo_postal for select to authenticated using (true);

-- Endurecer: sortear y unirse solo con sesión. Las de ayuda (es_miembro, etc.) se quedan abiertas:
-- solo responden sí/no para auth.uid() y las reglas las necesitan para devolver vacío a quien no tiene sesión.
revoke execute on function unirse(text, text), sortear(uuid), al_crear_intercambio() from public, anon;
grant execute on function unirse(text, text), sortear(uuid) to authenticated;
