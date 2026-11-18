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
