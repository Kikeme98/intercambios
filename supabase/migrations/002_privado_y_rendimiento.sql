-- Ayudantes fuera de la API pública + reglas que evalúan auth.uid() una vez + índices de llaves foráneas.
-- (Recomendaciones de los asesores de seguridad y rendimiento de Supabase.)

create schema if not exists privado;
grant usage on schema privado to anon, authenticated;

alter function public.es_miembro(uuid) set schema privado;
alter function public.es_organizador(uuid) set schema privado;
alter function public.es_santa_de(uuid, uuid) set schema privado;
alter function public.al_crear_intercambio() set schema privado;
grant execute on function privado.es_miembro(uuid), privado.es_organizador(uuid), privado.es_santa_de(uuid, uuid) to anon, authenticated;

-- sortear llamaba a es_organizador sin esquema: ahora va calificado.
create or replace function public.sortear(i uuid) returns void language plpgsql security definer set search_path = public as $$
declare
  p uuid[];
  n int;
  intento int;
  ok boolean;
begin
  if not privado.es_organizador(i) then raise exception 'Solo quien organiza puede sortear.'; end if;
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

-- Reglas con (select auth.uid()): se evalúa una vez por consulta, no por fila.
drop policy ver on intercambio;
drop policy crear on intercambio;
drop policy editar on intercambio;
drop policy borrar on intercambio;
create policy ver on intercambio for select using (privado.es_miembro(id) or organizador_id = (select auth.uid()));
create policy crear on intercambio for insert with check (organizador_id = (select auth.uid()));
create policy editar on intercambio for update using (organizador_id = (select auth.uid()) and estado = 'abierto');
create policy borrar on intercambio for delete using (organizador_id = (select auth.uid()));

drop policy salir on participante;
create policy salir on participante for delete using (
  (usuario_id = (select auth.uid()) or privado.es_organizador(intercambio_id))
  and (select estado from intercambio where id = intercambio_id) = 'abierto'
);

drop policy ver on asignacion;
create policy ver on asignacion for select using (santa_id = (select auth.uid()));

drop policy ver on deseo;
drop policy crear on deseo;
drop policy borrar on deseo;
create policy ver on deseo for select using (usuario_id = (select auth.uid()) or privado.es_santa_de(intercambio_id, usuario_id));
create policy crear on deseo for insert with check (usuario_id = (select auth.uid()));
create policy borrar on deseo for delete using (usuario_id = (select auth.uid()));

drop policy ver on mensaje;
drop policy crear on mensaje;
create policy ver on mensaje for select using (receptor_id = (select auth.uid()) or privado.es_santa_de(intercambio_id, receptor_id));
create policy crear on mensaje for insert with check (
  case when de_santa then privado.es_santa_de(intercambio_id, receptor_id) else receptor_id = (select auth.uid()) end
);

drop policy ver on direccion;
drop policy crear on direccion;
drop policy editar on direccion;
create policy ver on direccion for select using (usuario_id = (select auth.uid()) or privado.es_santa_de(intercambio_id, usuario_id));
create policy crear on direccion for insert with check (usuario_id = (select auth.uid()));
create policy editar on direccion for update using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- Índices de llaves foráneas (el del chat es el que más se usa).
create index if not exists intercambio_organizador on intercambio (organizador_id);
create index if not exists participante_usuario on participante (usuario_id);
create index if not exists deseo_dueno on deseo (intercambio_id, usuario_id);
create index if not exists mensaje_hilo on mensaje (intercambio_id, receptor_id);
