-- INNvesting · Gestionale: rafforzamento della sicurezza (da eseguire UNA volta, dopo setup.sql).
-- SQL Editor > New query > incolla > Run.

-- 1. La funzione "sono un amministratore?" la può chiamare solo chi ha già fatto l'accesso.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. L'archivio delle foto accetta solo immagini JPEG fino a 5 MB (il gestionale le comprime prima di inviarle).
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg']
where id = 'photos';
