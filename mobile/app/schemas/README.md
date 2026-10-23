# Schemas Room exportados

Não editar manualmente. Eles são consumidos por `MigrationTestHelper` e pelo
build (`room.schemaLocation`).

## Histórico

- `5.json`: schema da versão 5 publicada. Gerado a partir da tag `v0.5.4.0`
  (commit `eec58f9`), com `exportSchema = true` e `room.schemaLocation`
  temporariamente habilitados no worktree da tag. Room 2.6.1, mesma versão usada
  no build atual.
- `6.json`: schema atual (versão 6), gerado no branch `dev` já com
  `canonicalName` e `@ColumnInfo(defaultValue = "''")`.

## Regenerar

```bash
cd mobile
./gradlew :app:kspDebugKotlin
```

Ao subir a versão do banco, adicione o novo JSON e um teste de migration em
`app/src/androidTest`.
