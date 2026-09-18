# Design System — MeuGasto

## Paleta de Cores

### Brand Palette (Light)

| Token | Hex | Uso |
|-------|-----|-----|
| Primary | `#C2410C` / `#FF6B35` | Ações principais, navegação, destaques |
| OnPrimary | `#FFFFFF` | Texto e ícones sobre primary |
| PrimaryContainer | `#FFF0E8` | Cards hero, filtros selecionados |
| OnPrimaryContainer | `#7C2D12` | Texto sobre primaryContainer |
| Secondary | `#5B46CC` | Ações de apoio, badges de categoria e labels |
| OnSecondary | `#FFFFFF` | Texto sobre secondary |
| SecondaryContainer | `#EDE9FE` | Cards secundários e filtros |
| OnSecondaryContainer | `#2E1065` | Texto sobre secondaryContainer |
| Tertiary | `#1D5FBF` | Analytics, gráficos, dados fiscais |
| OnTertiary | `#FFFFFF` | Texto sobre tertiary |
| TertiaryContainer | `#E0F2FE` | Fundos de gráficos e cards de insight |
| OnTertiaryContainer | `#0369A1` | Texto sobre tertiaryContainer |

### Brand Palette (Dark)

| Token | Hex | Uso |
|-------|-----|-----|
| PrimaryDark | `#FF8C5A` | Ações principais (dark) |
| OnPrimaryDark | `#431407` | Texto sobre primary (dark) |
| PrimaryContainerDark | `#5A200A` | Cards hero (dark) |
| OnPrimaryContainerDark | `#FFDBC8` | Texto sobre primaryContainer (dark) |
| SecondaryDark | `#FDBA74` | Ações de apoio (dark) |
| OnSecondaryDark | `#431407` | Texto sobre secondary (dark) |
| SecondaryContainerDark | `#431407` | Cards secundários (dark) |
| OnSecondaryContainerDark | `#FFEDD5` | Texto sobre secondaryContainer (dark) |
| TertiaryDark | `#7DD3FC` | Analytics (dark) |
| OnTertiaryDark | `#082F49` | Texto sobre tertiary (dark) |
| TertiaryContainerDark | `#0C4A6E` | Fundos de gráficos (dark) |
| OnTertiaryContainerDark | `#E0F2FE` | Texto sobre tertiaryContainer (dark) |

### Surface Palette

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| Background | `#EAF2F4` | `#181513` | Fundo do app (azul-gelo característico / carvão) |
| OnBackground | `#1F2937` | `#F5EFEB` | Texto sobre background |
| Surface | `#FFFFFF` | `#221E1B` | Cards e sheets |
| OnSurface | `#1F2937` | `#F5EFEB` | Texto sobre surface |
| SurfaceVariant | `#F7F7F7` | `#332D28` | Campos de entrada, seções mutadas |
| OnSurfaceVariant | `#6B7280` | `#D6C8BE` | Texto secundário |
| Outline | `#E6E6E6` | `#8C7F75` | Bordas e divisores sutis |
| OutlineVariant | `#E2E8F0` | `#4D433C` | Separadores sutis |

### Semantic Colors

| Token | Hex | Uso |
|-------|-----|-----|
| Positive | `#1E8E3E` | Economia, preço baixo, tendência positiva |
| PositiveContainer | `#DCFCE7` | Badges de economia |
| Negative | `#FF3B30` | Aumento de preço, erro, orçamento excedido |
| NegativeContainer | `#FFEBEE` | Superfícies de erro/aviso |
| Warning | `#F59E0B` | Dados incompletos, sync pendente |
| WarningContainer | `#FEF3C7` | Banners de aviso |
| Info | `#1D5FBF` | Explicações, status de sincronização |
| InfoContainer | `#E0F2FE` | Cards informativos |

### Chart Palette (Colorblind-safe)

| Token | Hex | Uso |
|-------|-----|-----|
| ChartPrimary | `#FF6B35` | Linha/barras principais (Laranja MeuGasto) |
| ChartSecondary | `#5B46CC` | Série secundária (Roxo MeuGasto) |
| ChartTertiary | `#1D5FBF` | Série terciária (Azul) |
| ChartQuaternary | `#F59E0B` | Série quaternária (Âmbar) |
| ChartPositive | `#1E8E3E` | Tendência positiva |
| ChartNegative | `#FF3B30` | Tendência negativa |
| ChartNeutral | `#94A3B8` | Neutro/sem dados |

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
