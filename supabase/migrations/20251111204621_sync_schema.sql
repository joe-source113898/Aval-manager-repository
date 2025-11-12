-- Supabase schema for Aval-manager

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

set search_path to public, auth;

-- Enumerations ----------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'metodo_pago_enum') then
    create type public.metodo_pago_enum as enum ('efectivo', 'bancario');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_contrato_enum') then
    create type public.estado_contrato_enum as enum ('pendiente', 'firmado', 'cancelado');
  end if;
  if not exists (select 1 from pg_type where typname = 'estado_firma_enum') then
    create type public.estado_firma_enum as enum ('programada', 'realizada', 'reprogramada', 'cancelada');
  end if;
end$$;

-- Tables ----------------------------------------------------------------------
create table if not exists public.avales (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  edad integer,
  telefono text,
  email text,
  estado_civil text,
  domicilio_actual text,
  identificacion_oficial_url text,
  comprobante_domicilio_cfe_url text,
  comprobante_domicilio_siapa_url text,
  pago_predial_url text,
  escrituras_url text,
  certificado_libre_gravamen_url text,
  rfc_url text,
  curp_url text,
  acta_nacimiento_url text,
  comprobante_ingresos_1_url text,
  comprobante_ingresos_2_url text,
  comprobante_ingresos_3_url text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  identificacion_oficial_url text,
  telefono text,
  email text,
  notas text,
  referencias_familiares jsonb not null default '[]'::jsonb,
  referencias_conocidos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.propiedades (
  id uuid primary key default gen_random_uuid(),
  domicilio text not null,
  ciudad text not null default 'Guadalajara',
  estado text not null default 'Jalisco',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  aval_id uuid not null references public.avales (id) on delete restrict,
  propiedad_id uuid not null references public.propiedades (id) on delete restrict,
  lugar_firma_maps_url text not null,
  tipo_renta text not null,
  monto_renta_mensual numeric(12,2) not null,
  pago_por_servicio numeric(12,2) not null,
  periodo_contrato text not null,
  fecha_firma timestamptz not null,
  estado public.estado_contrato_enum not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  metodo public.metodo_pago_enum not null,
  monto numeric(12,2) not null check (monto > 0),
  fecha_pago timestamptz not null default now(),
  referencia text,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists public.firmas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  inmobiliaria_id uuid references public.inmobiliarias (id) on delete set null,
  aval_id uuid not null references public.avales (id) on delete restrict,
  asesor_nombre text not null,
  cliente_nombre text not null,
  telefono text,
  correo text,
  tipo_renta text not null,
  periodo_contrato_anios integer not null default 0,
  monto_renta numeric(12,2) not null default 0,
  propiedad_domicilio text not null,
  ubicacion_maps_url text not null,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  estado public.estado_firma_enum not null default 'programada',
  canal_firma text not null default 'dueno_directo',
  pago_por_servicio numeric(12,2) not null default 0,
  solicitud_aval_url text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagos_cortes (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio date not null,
  fecha_fin date not null,
  total_servicio numeric(12,2) not null default 0,
  total_comisiones numeric(12,2) not null default 0,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.pagos_servicio (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmas (id) on delete cascade,
  monto_efectivo numeric(12,2) not null default 0 check (monto_efectivo >= 0),
  monto_transferencia numeric(12,2) not null default 0 check (monto_transferencia >= 0),
  comprobante_url text,
  fecha_pago timestamptz not null default now(),
  notas text,
  estado text not null default 'registrado',
  corte_id uuid references public.pagos_cortes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((monto_efectivo + monto_transferencia) > 0)
);

create table if not exists public.pagos_comisiones (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmas (id) on delete cascade,
  beneficiario_tipo text not null check (beneficiario_tipo in ('aval', 'asesor')),
  beneficiario_id uuid not null,
  monto numeric(12,2) not null check (monto > 0),
  metodo text,
  fecha_programada timestamptz,
  fecha_pago timestamptz,
  estado text not null default 'pendiente',
  comprobante_url text,
  notas text,
  corte_id uuid references public.pagos_cortes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy compatibility: migrate old aval_id/asesor_id columns if a pre-existing
-- table still has them (e.g. when applying this script on top of an older DB).
alter table public.pagos_comisiones
  add column if not exists beneficiario_tipo text,
  add column if not exists beneficiario_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pagos_comisiones'
      and column_name = 'asesor_id'
  ) then
    execute $sql$
      update public.pagos_comisiones
      set beneficiario_tipo = coalesce(beneficiario_tipo, 'asesor'),
          beneficiario_id = coalesce(beneficiario_id, asesor_id)
      where asesor_id is not null
        and (beneficiario_tipo is null or beneficiario_id is null);
    $sql$;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pagos_comisiones'
      and column_name = 'aval_id'
  ) then
    execute $sql$
      update public.pagos_comisiones
      set beneficiario_tipo = 'aval',
          beneficiario_id = aval_id
      where aval_id is not null
        and (beneficiario_tipo is null or beneficiario_id is null);
    $sql$;
  end if;
end
$$;

alter table public.pagos_comisiones
  alter column beneficiario_tipo set not null,
  alter column beneficiario_id set not null,
  drop constraint if exists pagos_comisiones_beneficiario_tipo_check,
  add constraint pagos_comisiones_beneficiario_tipo_check check (beneficiario_tipo in ('aval', 'asesor'));

alter table public.pagos_comisiones
  drop column if exists aval_id,
  drop column if exists asesor_id;

create table if not exists public.disponibilidades_avales (
  id uuid primary key default gen_random_uuid(),
  aval_id uuid not null references public.avales (id) on delete cascade,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  recurrente boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  tipo text not null,
  archivo_path text not null,
  creado_por uuid references public.usuarios (id),
  created_at timestamptz not null default now(),
  notas text
);

create table if not exists public.vetos_avales (
  id uuid primary key default gen_random_uuid(),
  aval_id uuid not null references public.avales (id) on delete cascade,
  inmobiliaria_id uuid references public.inmobiliarias (id) on delete set null,
  motivo text not null,
  evidencia_documento_id uuid references public.documentos (id) on delete set null,
  estatus text not null default 'activo' check (estatus in ('activo','levantado')),
  registrado_por uuid references public.usuarios (id),
  levantado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clientes_morosidad (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  registrado_por uuid references public.usuarios (id),
  motivo_tipo text not null default 'moroso' check (motivo_tipo in ('moroso','problematico')),
  motivo text not null,
  estatus text not null default 'vetado' check (estatus in ('vetado','limpio')),
  limpio_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clientes_morosidad'
      and column_name = 'motivo_tipo'
  ) then
    alter table public.clientes_morosidad
      add column motivo_tipo text not null default 'moroso';
  end if;
  update public.clientes_morosidad
    set motivo_tipo = coalesce(nullif(motivo_tipo, ''), 'moroso')
  where motivo_tipo is null or motivo_tipo = '';
  alter table public.clientes_morosidad
    add constraint if not exists clientes_morosidad_motivo_tipo_check
    check (motivo_tipo in ('moroso','problematico'));
end
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clientes_morosidad'
      and column_name = 'resuelto_at'
  ) then
    alter table public.clientes_morosidad
      rename column resuelto_at to limpio_at;
  end if;
end
$$;

do $$
begin
  update public.clientes_morosidad
    set estatus = case estatus when 'activo' then 'vetado' when 'resuelto' then 'limpio' else estatus end;
  alter table public.clientes_morosidad
    drop constraint if exists clientes_morosidad_estatus_check,
    add constraint clientes_morosidad_estatus_check check (estatus in ('vetado','limpio'));
end
$$;

alter table public.clientes_morosidad
  drop column if exists monto_pendiente,
  drop column if exists evidencia_documento_id;

create table if not exists public.usuarios (
  id uuid primary key,
  email text unique,
  rol text not null default 'admin',
  created_at timestamptz not null default now()
);

-- Views -----------------------------------------------------------------------
create or replace view public.vw_firmas_publicas as
select
  f.id,
  f.contrato_id,
  f.aval_id,
  a.nombre_completo as aval_nombre,
  f.fecha_inicio,
  f.fecha_fin,
  f.ubicacion_maps_url,
  f.estado
from public.firmas f
join public.avales a on a.id = f.aval_id
where a.activo = true;

create or replace view public.vw_documentos_publicos as
select
  d.id,
  d.contrato_id,
  d.tipo,
  d.archivo_path,
  d.created_at
from public.documentos d;

-- Policies --------------------------------------------------------------------
alter table public.avales enable row level security;
alter table public.clientes enable row level security;
alter table public.propiedades enable row level security;
alter table public.contratos enable row level security;
alter table public.pagos enable row level security;
alter table public.firmas enable row level security;
alter table public.pagos_servicio enable row level security;
alter table public.pagos_comisiones enable row level security;
alter table public.pagos_cortes enable row level security;
alter table public.disponibilidades_avales enable row level security;
alter table public.documentos enable row level security;
alter table public.usuarios enable row level security;
alter table public.vetos_avales enable row level security;
alter table public.clientes_morosidad enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.rol = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists avales_admin_manage on public.avales;

create policy avales_admin_manage on public.avales
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists clientes_admin_manage on public.clientes;

create policy clientes_admin_manage on public.clientes
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists propiedades_admin_manage on public.propiedades;

create policy propiedades_admin_manage on public.propiedades
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists contratos_admin_manage on public.contratos;

create policy contratos_admin_manage on public.contratos
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists pagos_admin_manage on public.pagos;

create policy pagos_admin_manage on public.pagos
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists firmas_admin_manage on public.firmas;

create policy firmas_admin_manage on public.firmas
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists pagos_servicio_admin_manage on public.pagos_servicio;

create policy pagos_servicio_admin_manage on public.pagos_servicio
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists pagos_comisiones_admin_manage on public.pagos_comisiones;

create policy pagos_comisiones_admin_manage on public.pagos_comisiones
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists pagos_cortes_admin_manage on public.pagos_cortes;

create policy pagos_cortes_admin_manage on public.pagos_cortes
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists disponibilidades_admin_manage on public.disponibilidades_avales;

create policy disponibilidades_admin_manage on public.disponibilidades_avales
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists documentos_admin_manage on public.documentos;

create policy documentos_admin_manage on public.documentos
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists usuarios_admin_manage on public.usuarios;

create policy usuarios_admin_manage on public.usuarios
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists vetos_avales_admin_manage on public.vetos_avales;

create policy vetos_avales_admin_manage on public.vetos_avales
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists clientes_morosidad_admin_manage on public.clientes_morosidad;

create policy clientes_morosidad_admin_manage on public.clientes_morosidad
  for all using (auth.role() = 'service_role' or public.is_admin())
  with check (auth.role() = 'service_role' or public.is_admin());

drop policy if exists documentos_public_select on public.documentos;

create policy documentos_public_select on public.documentos
  for select using (auth.role() = 'anon');

drop policy if exists firmas_public_select on public.firmas;

create policy firmas_public_select on public.firmas
  for select using (auth.role() = 'anon');

-- Trigger to register new auth users -------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.usuarios (id, email, rol)
  values (new.id, new.email, 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
