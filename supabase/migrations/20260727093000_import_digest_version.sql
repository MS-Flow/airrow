-- Peppered import digests (spec 68).
--
-- import_files.digest stops being a raw SHA-256 and becomes an HMAC keyed by a pepper that lives
-- in the app environment, never in this database — so a leak of these rows can no longer be used
-- to brute-force the contents of a short file back out of its digest.
--
-- The version records which key an import was hashed with, so the pepper can be rotated without
-- every existing import suddenly reading as all-conflicts. 0 means "hashed before peppering
-- existed": raw SHA-256, still diffable.

alter table public.import_sources
  add column if not exists digest_version int not null default 0;

comment on column public.import_sources.digest_version is
  '0 = raw SHA-256 (pre-peppering). >0 = HMAC keyed by that version of IMPORT_DIGEST_PEPPERS.';
