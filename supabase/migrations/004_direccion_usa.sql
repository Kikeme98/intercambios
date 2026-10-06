-- Direcciones en Estados Unidos además de México.
-- USA: sin colonia, ZIP de 5 dígitos (o ZIP+4) y teléfono de 10 dígitos (+1).
alter table direccion add column pais text not null default 'MX' check (pais in ('MX', 'US'));
alter table direccion alter column colonia drop not null;

alter table direccion drop constraint direccion_colonia_check;
alter table direccion add constraint direccion_colonia_check check (
  case pais when 'MX' then colonia is not null and length(colonia) between 1 and 80 else colonia is null or length(colonia) <= 80 end
);

alter table direccion drop constraint direccion_cp_check;
alter table direccion add constraint direccion_cp_check check (
  case pais when 'MX' then cp ~ '^[0-9]{5}$' else cp ~ '^[0-9]{5}(-[0-9]{4})?$' end
);
