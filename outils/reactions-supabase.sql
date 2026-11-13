-- Geekotidien : réactions, compteurs et commentaires (à exécuter une fois dans l'éditeur SQL de Supabase).

-- 1. Réactions partagées (👍 🔥 😮)
create table if not exists reactions (
  news text not null,            -- identifiant de la news, ex. 2026-11-13-1
  emoji text not null,
  total integer not null default 0,
  primary key (news, emoji)
);
alter table reactions enable row level security;
create policy "lecture publique" on reactions for select to anon using (true);
grant select on reactions to anon;

create or replace function incrementer(p_news text, p_emoji text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t integer;
begin
  if p_news !~ '^\d{4}-\d{2}-\d{2}-\d{1,2}$' then
    raise exception 'news invalide';
  end if;
  if p_emoji not in ('👍', '🔥', '😮') then
    raise exception 'réaction invalide';
  end if;
  insert into reactions (news, emoji, total) values (p_news, p_emoji, 1)
  on conflict (news, emoji) do update set total = reactions.total + 1
  returning total into t;
  return t;
end;
$$;
grant execute on function incrementer(text, text) to anon;

-- 2. Total des visites
create table if not exists compteur (
  nom text primary key,
  total bigint not null default 0
);
insert into compteur (nom, total) values ('visites', 0) on conflict (nom) do nothing;
alter table compteur enable row level security;
create policy "lecture compteur" on compteur for select to anon using (true);
grant select on compteur to anon;

create or replace function enregistrer_visite()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  t bigint;
begin
  update compteur set total = total + 1 where nom = 'visites' returning total into t;
  return t;
end;
$$;
grant execute on function enregistrer_visite() to anon;

-- 3. Commentaires (publiés immédiatement ; suppression possible depuis le tableau de bord)
create table if not exists commentaires (
  id uuid primary key default gen_random_uuid(),
  news text not null,
  pseudo text not null,
  texte text not null,
  approuve boolean not null default true,
  created_at timestamptz not null default now()
);
alter table commentaires alter column approuve set default true;
alter table commentaires enable row level security;
-- Un visiteur peut publier, avec des longueurs raisonnables.
drop policy if exists "publier commentaire" on commentaires;
create policy "publier commentaire" on commentaires for insert to anon
  with check (
    news ~ '^\d{4}-\d{2}-\d{2}-\d{1,2}$'
    and char_length(pseudo) between 1 and 40
    and char_length(texte) between 2 and 1000
  );
-- Tout commentaire publié est lisible.
drop policy if exists "lire commentaires approuves" on commentaires;
create policy "lire commentaires approuves" on commentaires for select to anon using (approuve = true);
grant select, insert on commentaires to anon;
