\set ON_ERROR_STOP on

-- 1. Usuário autenticado exclui a própria conta e os dados em cascata.
SET test.uid = '00000000-0000-0000-0000-00000000000a';
SELECT public.delete_own_account();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'Conta excluída ainda existe em auth.users';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'Perfil não foi removido em cascata';
  END IF;
  IF EXISTS (SELECT 1 FROM public.purchases WHERE user_id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'Compras não foram removidas em cascata';
  END IF;
  IF EXISTS (SELECT 1 FROM public.items WHERE purchase_id IN (1, 2)) THEN
    RAISE EXCEPTION 'Itens não foram removidos em cascata';
  END IF;
  IF EXISTS (SELECT 1 FROM public.drafts WHERE user_id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'Rascunhos não foram removidos em cascata';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shopping_lists WHERE user_id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'Listas não foram removidas em cascata';
  END IF;

  -- Outro titular permanece intacto.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'Exclusão atingiu outra conta';
  END IF;
  IF (SELECT count(*) FROM public.purchases WHERE user_id = '00000000-0000-0000-0000-00000000000b') <> 1 THEN
    RAISE EXCEPTION 'Compras de outro titular foram afetadas';
  END IF;

  -- Buckets das datas do titular foram recomputados.
  IF NOT EXISTS (SELECT 1 FROM public.analytics_runs WHERE bucket_date = '2026-10-01') THEN
    RAISE EXCEPTION 'Bucket de 2026-10-01 não foi recomputado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.analytics_runs WHERE bucket_date = '2026-10-02') THEN
    RAISE EXCEPTION 'Bucket de 2026-10-02 não foi recomputado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.analytics_runs WHERE bucket_date = '2026-10-03') THEN
    RAISE EXCEPTION 'Bucket de outro titular foi recomputado';
  END IF;
END $$;

-- 2. Sem sessão, a função falha em vez de excluir qualquer coisa.
SET test.uid = '';
DO $$
BEGIN
  PERFORM public.delete_own_account();
  RAISE EXCEPTION 'Chamada sem sessão deveria falhar';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'Chamada sem sessão deveria falhar' THEN
    RAISE;
  END IF;
END $$;

-- 3. anon não pode executar a função.
SET ROLE anon;
DO $$
BEGIN
  PERFORM public.delete_own_account();
  RAISE EXCEPTION 'anon não deveria executar delete_own_account';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
RESET ROLE;

-- 4. A função não expõe parâmetro de id; a assinatura é sempre auth.uid().
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'delete_own_account'
       AND p.pronargs <> 0
  ) THEN
    RAISE EXCEPTION 'delete_own_account não deve aceitar parâmetros';
  END IF;
END $$;
