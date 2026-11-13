-- Réactions partagées de Geekotidien (à exécuter une fois dans l'éditeur SQL de Supabase).

create table if not exists reactions (
  news text not null,            -- identifiant de la news, ex. 2026-11-13-1
  emoji text not null,
  total integer not null default 0,
  primary key (news, emoji)
);

alter table reactions enable row level security;

-- Tout le monde peut lire les compteurs.
create policy "lecture publique" on reactions for select to anon using (true);

-- Une seule fonction permet d'ajouter une réaction : pas d'écriture directe.
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
