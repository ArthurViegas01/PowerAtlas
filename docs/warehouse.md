# Armazém de dados (`data/warehouse/`)

Camada CSV-first do PowerAtlas: a **fonte da verdade** dos dados factuais, em
modelo estrela (dimensão + fato). Você edita/versiona os CSVs aqui, o site é
**compilado** a partir deles, e o Power BI / Excel abre esta pasta direto e cruza
as tabelas por chaves compartilhadas. Companheira de
[data-sources.md](data-sources.md) (de onde cada dado vem) e
[data-console.md](data-console.md) (a tela `/dados`).

## Por que existe

Os payloads que o navegador consome (`apps/web/public/data/**`) são otimizados
para tamanho de bundle: tuplas posicionais sem cabeçalho, objetos aninhados,
setores de comércio embutidos dentro de cada país. Ótimo para a rede, péssimo
para análise: o Power BI não abre direto e não há chave explícita para cruzar
demografia × fiscal × comércio. O armazém resolve isso sem penalizar o site.

## Fluxo

```
   (refresh, ocasional)                 (build, sempre)
IBGE / Comex / Tesouro ──fetch/build──▶ data/warehouse/*.csv ──compile-web──▶ public/data/**.json
                                              ▲                                      │
                                       você edita aqui                        site + /dados leem daqui
                                       Power BI abre aqui                     (byte-idêntico ao commitado)
```

- `pnpm warehouse` gera os CSVs + `DICIONARIO.md` + `meta.json` a partir dos
  payloads commitados (bootstrap offline, sem rede).
- `pnpm compile-web` faz o caminho inverso: warehouse → `public/data/**`.
- `pnpm compile-web:check` prova, byte-a-byte, que a compilação não altera o
  payload servido (roda no CI/pré-commit ideal).

## Tabelas (star schema)

Dimensões: `dim_uf`, `dim_municipio`, `dim_pais`, `dim_setor_comercio`.
Fatos: `fato_indicadores_uf`, `fato_demografia_municipio`, `fato_fiscal_municipio`,
`fato_comercio_parceiro`, `fato_comercio_parceiro_setor`.

O catálogo completo (grão, colunas, unidades, fontes e o mapa de relações para o
Power BI) é **gerado** em [`../data/warehouse/DICIONARIO.md`](../data/warehouse/DICIONARIO.md).
Não editar os CSVs nem o dicionário à mão: eles são saída do `pnpm warehouse`.

### Chaves de cruzamento

| Chave | Liga |
| --- | --- |
| `codigo_ibge` (7 díg.) | `dim_municipio` ↔ `fato_demografia_municipio`, `fato_fiscal_municipio` |
| `uf_sigla` | `dim_uf` ↔ `dim_municipio`, `fato_indicadores_uf` (`regiao_id`) |
| `iso` | `dim_pais` ↔ `fato_comercio_parceiro`, `fato_comercio_parceiro_setor` |
| `capitulo_ncm` | `dim_setor_comercio` ↔ `fato_comercio_parceiro_setor` |

## Escopo e fronteiras

- **Dentro:** os quatro datasets servidos/analíticos (indicadores UF, demografia,
  fiscal, comércio). São exatamente os que a tela `/dados` mostra.
- **Fora (de propósito):**
  - `public/data/indicators/municipios/{UF}.json`: cache bruto do fetch IBGE por
    UF, entrada do `build-demografia`. Fica upstream, como as malhas geo.
  - `public/geo/**`: geometria, não é tabular.
  - `apps/web/src/data/mock/*`: rankings **fictícios** (contrato congelado + regra
    de conteúdo do ARCHITECTURE §5). Nunca entram no armazém factual. O console
    exporta rankings via CSV client-side, se preciso.
  - Banco `datasets`/`dataset_rows`: CSVs importados pelo operador, namespace
    isolado (migração 0003).

## Como plugar no Power BI

1. Get Data → Text/CSV (ou Folder apontando para `data/warehouse/`).
2. Importar as 9 tabelas; o Power BI infere tipos (ponto decimal, sem milhar).
3. Model view: criar as relações da tabela de chaves acima
   (`dim_*[chave]` 1 ─ * `fato_*[chave]`).
4. Medidas de exemplo: PIB per capita (`pib_mil_brl * 1000 / populacao`),
   arrecadação por habitante (`arrecadacao / populacao`), saldo comercial
   (`exp - imp`) por país ou por setor.

## Adicionar um dataset novo

1. Modelar como `dim_*` e/ou `fato_*` com uma chave que ligue às tabelas
   existentes (ou uma dimensão nova).
2. Emitir o CSV no `warehouse-build.mjs` (via `writeTable`, que também alimenta o
   `DICIONARIO.md`).
3. Se o site for exibir: fazer o `compile-web.mjs` emitir o JSON e adicionar um
   `build*Dataset()` em `apps/web/src/lib/datasets.ts`. O console `/dados` e os
   gráficos são genéricos: KPIs, tabela e gráficos saem de graça.
