-- Las listas de deseos las ve todo el intercambio (como en la app que usaba el grupo).
-- No revela asignaciones: ver todas las listas no dice quién le regala a quién.
-- Las direcciones siguen privadas: solo su dueño y su santa.
drop policy ver on deseo;
create policy ver on deseo for select using (privado.es_miembro(intercambio_id));
