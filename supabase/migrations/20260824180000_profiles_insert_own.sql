-- Allow an authenticated user to create their own profile if the
-- auth.users trigger did not run (legacy users / manual inserts).
-- Owner-only: id must equal auth.uid().

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
