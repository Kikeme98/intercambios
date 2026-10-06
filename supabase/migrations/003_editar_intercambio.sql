-- Quien organiza puede cambiar nombre, fecha y presupuesto, también después del sorteo.
-- Solo esas tres columnas: estado y código no se tocan desde la API (nadie puede "reabrir" un intercambio sorteado).
drop policy editar on intercambio;
create policy editar on intercambio for update
  using (organizador_id = (select auth.uid()))
  with check (organizador_id = (select auth.uid()));
revoke update on intercambio from anon, authenticated;
grant update (nombre, fecha, presupuesto) on intercambio to authenticated;

-- Deshacer el sorteo: regresa a "abierto" para cambiar gente o exclusiones y volver a sortear.
-- Borra también los chats: si no, el santa nuevo leería lo que el anterior le escribió a esa persona.
create or replace function public.deshacer_sorteo(i uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not privado.es_organizador(i) then raise exception 'Solo quien organiza puede deshacer el sorteo.'; end if;
  delete from mensaje where intercambio_id = i;
  delete from asignacion where intercambio_id = i;
  update intercambio set estado = 'abierto' where id = i;
end $$;
revoke execute on function public.deshacer_sorteo(uuid) from public, anon;
grant execute on function public.deshacer_sorteo(uuid) to authenticated;
-- Borrar el intercambio completo ya lo permite la regla "borrar" (todo lo demás cae en cascada).
