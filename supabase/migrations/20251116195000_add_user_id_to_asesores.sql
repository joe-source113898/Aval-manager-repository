alter table if exists public.asesores
  add column if not exists user_id uuid references public.usuarios (id);

create unique index if not exists asesores_user_id_key on public.asesores(user_id) where user_id is not null;
