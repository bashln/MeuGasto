# Design System — MeuGasto

## Paleta de Cores

### Brand Palette (Light)

| Token | Hex | Uso |
|-------|-----|-----|
| Primary | `#356859` | Ações principais, navegação, destaques |
| OnPrimary | `#FFFFFF` | Texto e ícones sobre primary |
| PrimaryContainer | `#BEE8D5` | Cards hero, filtros selecionados |
| OnPrimaryContainer | `#002114` | Texto sobre primaryContainer |
| Secondary | `#6B5E4A` | Ações de apoio e labels |
| OnSecondary | `#FFFFFF` | Texto sobre secondary |
| SecondaryContainer | `#EFE0C5` | Cards secundários e filtros |
| OnSecondaryContainer | `#251B0A` | Texto sobre secondaryContainer |
| Tertiary | `#526B8C` | Analytics, gráficos, estados de comparação |
| OnTertiary | `#FFFFFF` | Texto sobre tertiary |
| TertiaryContainer | `#D5E3FF` | Fundos de gráficos e cards de insight |
| OnTertiaryContainer | `#0A1E38` | Texto sobre tertiaryContainer |

### Brand Palette (Dark)

| Token | Hex | Uso |
|-------|-----|-----|
| PrimaryDark | `#A7D7C5` | Ações principais (dark) |
| OnPrimaryDark | `#12372A` | Texto sobre primary (dark) |
| PrimaryContainerDark | `#1D4D3D` | Cards hero (dark) |
| OnPrimaryContainerDark | `#BEE8D5` | Texto sobre primaryContainer (dark) |
| SecondaryDark | `#D8C6A8` | Ações de apoio (dark) |
| OnSecondaryDark | `#3B2E1C` | Texto sobre secondary (dark) |
| SecondaryContainerDark | `#51432E` | Cards secundários (dark) |
| OnSecondaryContainerDark | `#EFE0C5` | Texto sobre secondaryContainer (dark) |
| TertiaryDark | `#B8C9E8` | Analytics (dark) |
| OnTertiaryDark | `#20334F` | Texto sobre tertiary (dark) |
| TertiaryContainerDark | `#3A506F` | Fundos de gráficos (dark) |
| OnTertiaryContainerDark | `#D5E3FF` | Texto sobre tertiaryContainer (dark) |

### Surface Palette

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| Background | `#F8FAF7` | `#1A1C19` | Fundo do app |
| OnBackground | `#1A1C19` | `#E2E3DD` | Texto sobre background |
| Surface | `#F8FAF7` | `#1A1C19` | Cards e sheets |
| OnSurface | `#1A1C19` | `#E2E3DD` | Texto sobre surface |
| SurfaceVariant | `#DDE5DA` | `#414941` | Campos de entrada, seções mutadas |
| OnSurfaceVariant | `#414941` | `#C1C9BF` | Texto secundário |
| Outline | `#717971` | `#8B938A` | Bordas e divisores |
| OutlineVariant | `#C1C9BF` | `#414941` | Separadores sutis |

### Semantic Colors

| Token | Hex | Uso |
|-------|-----|-----|
| Positive | `#2E7D5B` | Economia, preço baixo, tendência positiva |
| PositiveContainer | `#D7F2E3` | Badges de economia |
| Negative | `#BA1A1A` | Aumento de preço, erro, orçamento excedido |
| NegativeContainer | `#FFDAD6` | Superfícies de erro/aviso |
| Warning | `#8A6100` | Dados incompletos, sync pendente |
| WarningContainer | `#FFDEA6` | Banners de aviso |
| Info | `#426486` | Explicações, status de sincronização |
| InfoContainer | `#D1E4FF` | Cards informativos |

### Chart Palette (Colorblind-safe)

| Token | Hex | Uso |
|-------|-----|-----|
| ChartPrimary | `#356859` | Linha/barras principais |
| ChartSecondary | `#526B8C` | Série secundária |
| ChartTertiary | `#B66D3C` | Série terciária |
| ChartQuaternary | `#7B5C8A` | Série quaternária |
| ChartPositive | `#2E7D5B` | Tendência positiva |
| ChartNegative | `#BA1A1A` | Tendência negativa |
| ChartNeutral | `#7A7A7A` | Neutro/sem dados |

---

## Tipografia

| Token | Tamanho | Peso | Uso |
|-------|---------|------|-----|
| DisplaySmall | 36sp | 400 | Onboarding ou resumo principal |
| HeadlineLarge | 32sp | 700 | Total mensal no Dashboard |
| HeadlineMedium | 28sp | 700 | Resumo analytics principal |
| HeadlineSmall | 24sp | 700 | Ênfase de seção |
| TitleLarge | 22sp | 700 | Títulos de tela |
| TitleMedium | 16sp | 600 | Títulos de cards e grupos |
| TitleSmall | 14sp | 600 | Títulos compactos |
| BodyLarge | 16sp | 400 | Conteúdo legível principal |
| BodyMedium | 14sp | 400 | Itens de lista, descrições |
| BodySmall | 12sp | 400 | Metadados de apoio |
| LabelLarge | 14sp | 600 | Botões e controles importantes |
| LabelMedium | 12sp | 600 | Chips, tabs, badges |
| LabelSmall | 11sp | 600 | Indicadores de status compactos |

---

## Espaçamento (Grid 4dp)

| Token | Valor | Uso |
|-------|-------|-----|
| XS | 4dp | Ícone para label |
| SM | 8dp | Espaçamento interno de formulário |
| MD | 12dp | Padding vertical de itens de lista |
| LG | 16dp | Padding interno de cards, horizontal de tela |
| XL | 24dp | Separação entre seções |
| XXL | 32dp | Separação hero |
| XXXL | 48dp | Espaçamento inferior |

---

## Formas

| Token | Raio | Uso |
|-------|------|-----|
| None | 0dp | Conteúdo full-bleed |
| ExtraSmall | 4dp | Campos compactos |
| Small | 8dp | Chips, inputs, containers de lista |
| Medium | 12dp | Cards padrão e botões |
| Large | 16dp | Cards hero, seções proeminentes |
| ExtraLarge | 28dp | Bottom sheets, dialogs, onboarding |
| Full | 50% | Avatares, botões de ícone circulares |

---

## Elevação

| Token | Elevação | Uso |
|-------|----------|-----|
| Level0 | 0dp | Fundo e seções flat |
| Level1 | 1dp | Cards padrão |
| Level2 | 3dp | FAB, superfícies selecionadas |
| Level3 | 6dp | Menus e bottom sheets |
| Level4 | 8dp | Dialogs |
| Level5 | 12dp | Overlays temporários raros |
