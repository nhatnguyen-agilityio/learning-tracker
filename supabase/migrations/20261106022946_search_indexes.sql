-- unaccent is only stable, so an index needs this immutable wrapper. The
-- search query must use the same expressions: see src/domain/search-resources.ts
create function public.immutable_unaccent(text) returns text
  language sql immutable parallel safe strict
  set search_path = ''
  as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;
--> statement-breakpoint
revoke execute on function public.immutable_unaccent(text) from public, anon, authenticated;
--> statement-breakpoint
create index resources_title_search_idx on public.resources
  using gin (public.immutable_unaccent(lower(title)) extensions.gin_trgm_ops);
--> statement-breakpoint
create index resources_url_search_idx on public.resources
  using gin (public.immutable_unaccent(lower(url)) extensions.gin_trgm_ops);
--> statement-breakpoint
create index notes_content_search_idx on public.notes
  using gin (public.immutable_unaccent(lower(content_md)) extensions.gin_trgm_ops);
