-- Hidden integration for imported projects (spec 187).
--
-- How a foundation lands is a property of the import, and import_sources is already the one row that
-- records where a project came from (spec 91 chose it for exactly that reason), so the layout goes
-- here rather than into a second place on projects that could disagree with it (§IV).
--
-- The folder name is stored, not derived at delivery: the founder typed it, and a value they chose is
-- not something to recompute. It also has to survive them renaming their account — a derived name
-- would quietly move the folder on the next download and orphan the first one, still on disk, still
-- ignored, with a foundation nothing points at any more.
--
-- No new table, so no new RLS surface: both columns are covered by the existing
-- "org members access import_sources" policy.

alter table public.import_sources
  add column if not exists delivery_layout text not null default 'integrated'
    check (delivery_layout in ('integrated', 'hidden')),
  -- Empty exactly when the layout is integrated. Constrained to a single path segment for the same
  -- reason the Zod schema is: it is concatenated into every delivered path, and a separator or a
  -- '..' here would address a directory the founder never chose.
  add column if not exists hidden_folder text not null default '';

alter table public.import_sources
  drop constraint if exists import_sources_hidden_folder_ck;

alter table public.import_sources
  add constraint import_sources_hidden_folder_ck check (
    case delivery_layout
      when 'hidden' then hidden_folder ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and length(hidden_folder) <= 48
      else hidden_folder = ''
    end
  );
