# Item price format regression

Run this test only against a new disposable PostgreSQL database. It creates synthetic tables and an `auth.uid()` fixture. It does not connect to Supabase or use customer data.

```sh
createdb meugasto_price_basis_test
psql -v ON_ERROR_STOP=1 -d meugasto_price_basis_test \
  -f supabase/tests/item_price_basis_setup.sql \
  -f supabase/migrations/20261108170000_explicit_item_price_basis.sql \
  -f supabase/tests/item_price_basis_assertions.sql
```

The assertions cover unknown historical rows, canonical unit storage, exact line totals, per-user receipt identity, reimport of unknown items, duplicate idempotency, reports, and aggregation with five synthetic contributors. The fixture does not exercise Supabase JWT validation or RLS policies.

# Account self-deletion

Run this test only against a new disposable PostgreSQL database. It creates a synthetic `auth` schema and does not touch Supabase or customer data.

```sh
createdb meugasto_account_deletion_test
psql -v ON_ERROR_STOP=1 -d meugasto_account_deletion_test \
  -f supabase/tests/account_deletion_setup.sql \
  -f supabase/migrations/20261123120000_account_self_deletion.sql \
  -f supabase/tests/account_deletion_assertions.sql
```

The assertions cover cascade removal of profile, purchases, items, drafts and lists; isolation from another account; analytics recomputation for the deleted user's buckets; refusal without a session; `anon` denial; and the zero-argument signature. The fixture does not exercise Supabase Auth/GoTrue or PostgREST.
