-- =====================================================================
-- Sistema de Gestión Empresarial · Esquema PostgreSQL (Supabase)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Perfiles de usuario ----------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text unique not null,
  nombre text, correo text, telefono text,
  rol text not null default 'vendedor' check (rol in ('admin','gerente','vendedor')),
  activo boolean not null default false,
  creado timestamptz default now()
);

-- El PRIMER usuario registrado es administrador activo; los demás quedan pendientes.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare primero boolean;
begin
  select not exists(select 1 from public.perfiles) into primero;
  insert into public.perfiles(id, usuario, nombre, correo, telefono, rol, activo)
  values (new.id,
          lower(coalesce(nullif(new.raw_user_meta_data->>'usuario',''), split_part(new.email,'@',1))),
          new.raw_user_meta_data->>'nombre', new.email, new.raw_user_meta_data->>'telefono',
          case when primero then 'admin' else 'vendedor' end, primero);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- Funciones auxiliares ----------
create or replace function public.mi_rol() returns text language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where id = auth.uid() and activo $$;

create or replace function public.bootstrap_needed() returns boolean language sql security definer set search_path = public as
$$ select not exists(select 1 from public.perfiles) $$;

create or replace function public.email_for_username(u text) returns text language sql security definer set search_path = public as
$$ select correo from public.perfiles where usuario = lower(u) limit 1 $$;

-- Pista de recuperación: devuelve datos ENMASCARADOS (no revela el usuario ni el correo completos)
create or replace function public.recovery_hint(q text) returns json language sql security definer set search_path = public as
$$ select json_build_object(
     'usuario', regexp_replace(usuario, '^(.{2}).*(.)$', '\1***\2'),
     'correo',  regexp_replace(correo,  '^(.{2})[^@]*(@.*)$', '\1***\2'))
   from public.perfiles
   where lower(correo) = lower(q) or telefono = q or usuario = lower(q) limit 1 $$;

grant execute on function public.bootstrap_needed(), public.email_for_username(text), public.recovery_hint(text) to anon, authenticated;

-- ---------- Tablas del negocio ----------
create table if not exists public.clientes (id bigint generated always as identity primary key, nombre text not null, documento text, telefono text, correo text, direccion text, notas text, creado timestamptz default now());
create table if not exists public.proveedores (id bigint generated always as identity primary key, empresa text not null, ruc text, contacto text, telefono text, correo text, direccion text, notas text, creado timestamptz default now());
create table if not exists public.productos (id bigint generated always as identity primary key, codigo text, nombre text not null, categoria text, unidad text default 'unid', precio_compra numeric(12,2) default 0, precio_venta numeric(12,2) default 0, stock numeric(12,2) default 0, stock_minimo numeric(12,2) default 0, activo boolean default true, creado timestamptz default now());
create table if not exists public.trabajadores (id bigint generated always as identity primary key, nombre text not null, documento text, cargo text, telefono text, correo text, sueldo numeric(12,2) default 0, fecha_ingreso date, estado text default 'activo', creado timestamptz default now());
create table if not exists public.asistencias (id bigint generated always as identity primary key, trabajador_id bigint references public.trabajadores(id) on delete cascade, fecha date not null, estado text not null default 'asistio', horas numeric(5,2), nota text, creado timestamptz default now());
create table if not exists public.pagos_trabajadores (id bigint generated always as identity primary key, trabajador_id bigint references public.trabajadores(id) on delete cascade, fecha date not null, tipo text not null, concepto text, monto numeric(12,2) not null default 0, creado timestamptz default now());
create table if not exists public.compras (id bigint generated always as identity primary key, proveedor_id bigint references public.proveedores(id), fecha date not null, total numeric(12,2) default 0, pagado boolean default true, metodo text, nota text, estado text default 'completada', creado timestamptz default now());
create table if not exists public.compra_items (id bigint generated always as identity primary key, compra_id bigint references public.compras(id) on delete cascade, producto_id bigint references public.productos(id), cantidad numeric(12,2), costo numeric(12,2), subtotal numeric(12,2));
create table if not exists public.ventas (id bigint generated always as identity primary key, cliente_id bigint references public.clientes(id), fecha date not null, subtotal numeric(12,2) default 0, descuento numeric(12,2) default 0, total numeric(12,2) default 0, metodo text, estado text default 'completada', reparto boolean default false, vendedor text, nota text, creado timestamptz default now());
create table if not exists public.venta_items (id bigint generated always as identity primary key, venta_id bigint references public.ventas(id) on delete cascade, producto_id bigint references public.productos(id), cantidad numeric(12,2), precio numeric(12,2), costo numeric(12,2), subtotal numeric(12,2));
create table if not exists public.movimientos_inventario (id bigint generated always as identity primary key, producto_id bigint references public.productos(id) on delete cascade, tipo text not null, cantidad numeric(12,2) not null, motivo text, ref text, usuario text, fecha timestamptz default now());
create table if not exists public.repartos (id bigint generated always as identity primary key, venta_id bigint references public.ventas(id) on delete set null, cliente_id bigint references public.clientes(id) on delete set null, direccion text, repartidor_id bigint references public.trabajadores(id) on delete set null, fecha date, estado text default 'pendiente', nota text, creado timestamptz default now());
create table if not exists public.gastos (id bigint generated always as identity primary key, fecha date not null, categoria text, descripcion text, monto numeric(12,2) not null default 0, metodo text, creado timestamptz default now());
create table if not exists public.caja (id bigint generated always as identity primary key, fecha date not null, tipo text not null check (tipo in ('ingreso','egreso')), concepto text, monto numeric(12,2) not null default 0, metodo text, ref text, creado timestamptz default now());
create table if not exists public.configuracion (id int primary key default 1, nombre_negocio text, ruc text, direccion text, telefono text, moneda text default 'S/');
create table if not exists public.bitacora (id bigint generated always as identity primary key, fecha timestamptz default now(), usuario text, accion text, tabla text, detalle text);

-- ---------- Seguridad (RLS) ----------
alter table public.perfiles enable row level security;
drop policy if exists perfiles_sel on public.perfiles; drop policy if exists perfiles_upd on public.perfiles;
create policy perfiles_sel on public.perfiles for select to authenticated using (id = auth.uid() or public.mi_rol() = 'admin');
create policy perfiles_upd on public.perfiles for update to authenticated using (public.mi_rol() = 'admin');

do $$
declare t text;
begin
  -- Tablas operativas: cualquier usuario activo lee/crea/edita; borrar solo admin/gerente
  foreach t in array array['clientes','proveedores','productos','compras','compra_items','ventas','venta_items','movimientos_inventario','repartos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_sel" on public.%1$I', t); execute format('drop policy if exists "%1$s_ins" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_upd" on public.%1$I', t); execute format('drop policy if exists "%1$s_del" on public.%1$I', t);
    execute format('create policy "%1$s_sel" on public.%1$I for select to authenticated using (public.mi_rol() is not null)', t);
    execute format('create policy "%1$s_ins" on public.%1$I for insert to authenticated with check (public.mi_rol() is not null)', t);
    execute format('create policy "%1$s_upd" on public.%1$I for update to authenticated using (public.mi_rol() is not null)', t);
    execute format('create policy "%1$s_del" on public.%1$I for delete to authenticated using (public.mi_rol() in (''admin'',''gerente''))', t);
  end loop;
  -- Tablas sensibles: solo admin/gerente
  foreach t in array array['trabajadores','asistencias','pagos_trabajadores','gastos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_all" on public.%1$I', t);
    execute format('create policy "%1$s_all" on public.%1$I for all to authenticated using (public.mi_rol() in (''admin'',''gerente'')) with check (public.mi_rol() in (''admin'',''gerente''))', t);
  end loop;
end $$;

-- Caja y bitácora: todos los activos pueden registrar (las ventas generan ingresos); leer solo admin/gerente
alter table public.caja enable row level security; alter table public.bitacora enable row level security; alter table public.configuracion enable row level security;
drop policy if exists caja_ins on public.caja; drop policy if exists caja_sel on public.caja; drop policy if exists caja_mod on public.caja; drop policy if exists caja_del on public.caja;
create policy caja_ins on public.caja for insert to authenticated with check (public.mi_rol() is not null);
create policy caja_sel on public.caja for select to authenticated using (public.mi_rol() in ('admin','gerente'));
create policy caja_mod on public.caja for update to authenticated using (public.mi_rol() in ('admin','gerente'));
create policy caja_del on public.caja for delete to authenticated using (public.mi_rol() in ('admin','gerente'));
drop policy if exists bit_ins on public.bitacora; drop policy if exists bit_sel on public.bitacora;
create policy bit_ins on public.bitacora for insert to authenticated with check (public.mi_rol() is not null);
create policy bit_sel on public.bitacora for select to authenticated using (public.mi_rol() in ('admin','gerente'));
drop policy if exists cfg_sel on public.configuracion; drop policy if exists cfg_mod on public.configuracion;
create policy cfg_sel on public.configuracion for select to authenticated using (public.mi_rol() is not null);
create policy cfg_mod on public.configuracion for all to authenticated using (public.mi_rol() = 'admin') with check (public.mi_rol() = 'admin');

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
