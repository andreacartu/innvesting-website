-- INNvesting · Gestionale: archivio online dei dati (immobili, fornitori, costi, aggiornamenti).
-- Da eseguire UNA volta nell'SQL Editor di Supabase (New query > incolla > Run), dopo setup.sql.
--
-- Un solo archivio, un record per elemento. Il gestionale invia ogni modifica e scarica quelle degli altri dispositivi.

create table if not exists public.records (
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('property', 'supplier', 'cost', 'update')),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, kind, id)
);

create index if not exists records_owner_updated_idx on public.records (owner_id, updated_at);

-- L'istante di modifica lo mette sempre il server (non l'orologio del telefono): così i dispositivi si allineano senza errori.
create or replace function public.touch_records()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.touch_records();

-- Accesso: solo tu (l'amministratore), solo ai tuoi record.
alter table public.records enable row level security;

drop policy if exists "amministratore gestisce i propri record" on public.records;
create policy "amministratore gestisce i propri record" on public.records
  for all to authenticated
  using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());

-- Notifiche in tempo reale: un dispositivo vede subito le modifiche fatte da un altro.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null;
end $$;
