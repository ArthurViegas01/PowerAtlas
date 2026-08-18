# Dicionário de dados: `data/warehouse/`

Armazém CSV-first do PowerAtlas em modelo estrela (dimensão + fato). Fonte da
verdade dos dados factuais: você edita/versiona os CSVs aqui, o site é compilado
a partir deles (`pnpm compile-web`) e o Power BI abre esta pasta direto.

**Gerado por `apps/web/scripts/warehouse-build.mjs` (`pnpm warehouse`). Não editar à mão.**

## Chaves de cruzamento (relações no Power BI)

| De (fato) | Coluna | Para (dimensão) | Coluna |
| --- | --- | --- | --- |
| fato_demografia_municipio | codigo_ibge | dim_municipio | codigo_ibge |
| fato_fiscal_municipio | codigo_ibge | dim_municipio | codigo_ibge |
| dim_municipio | uf_sigla | dim_uf | uf_sigla |
| fato_indicadores_uf | regiao_id | dim_uf | uf_sigla |
| fato_comercio_parceiro | iso | dim_pais | iso |
| fato_comercio_parceiro_setor | iso | dim_pais | iso |
| fato_comercio_parceiro_setor | capitulo_ncm | dim_setor_comercio | capitulo_ncm |

## Tabelas

### `dim_uf.csv` (28 linhas)

- **Grão:** Uma linha por UF (27) mais a linha agregada BR.
- **Fonte:** IBGE (siglas/códigos) + classificação estática de macro-região.

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `uf_sigla` | texto | - | Sigla da UF. CHAVE (PK). |
| `uf_codigo` | texto | - | Geocódigo IBGE de 2 dígitos (vazio para BR). |
| `uf_nome` | texto | - | Nome da unidade federativa. |
| `regiao` | texto | - | Macro-região IBGE (Norte/Nordeste/Sudeste/Sul/Centro-Oeste; "Brasil" para BR). |

### `dim_municipio.csv` (5570 linhas)

- **Grão:** Uma linha por município.
- **Fonte:** IBGE · malha territorial + Censo 2022 (centroide aproximado).

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `codigo_ibge` | texto | - | Geocódigo IBGE de 7 dígitos. CHAVE (PK). |
| `nome` | texto | - | Nome do município. |
| `uf_sigla` | texto | - | Sigla da UF. FK -> dim_uf.uf_sigla. |
| `uf_codigo` | texto | - | Geocódigo IBGE de 2 dígitos da UF. |
| `lon` | decimal | graus | Longitude do centroide. |
| `lat` | decimal | graus | Latitude do centroide. |

### `fato_demografia_municipio.csv` (5570 linhas)

- **Grão:** Uma linha por município.
- **Fonte:** IBGE · Censo 2022 (população/área/densidade) e PIB dos Municípios 2023.

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `codigo_ibge` | texto | - | FK -> dim_municipio.codigo_ibge. |
| `ano_censo` | inteiro | ano | Ano de referência da população. |
| `ano_pib` | inteiro | ano | Ano de referência do PIB. |
| `populacao` | inteiro | habitantes | População residente. |
| `area_km2` | decimal | km² | Área territorial. |
| `densidade` | decimal | hab/km² | Densidade demográfica. |
| `pib_mil_brl` | inteiro | R$ mil | PIB a preços correntes, em milhares de reais. |

### `fato_fiscal_municipio.csv` (5570 linhas)

- **Grão:** Uma linha por município.
- **Fonte:** Receita Federal (arrecadação) · Tesouro Nacional (transferências) · Portal da Transparência (emendas).

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `codigo_ibge` | texto | - | FK -> dim_municipio.codigo_ibge. |
| `ano` | inteiro | ano | Ano de referência. |
| `arrecadacao` | inteiro | R$ | Arrecadação federal total no município. |
| `previdencia` | inteiro | R$ | Arrecadação previdenciária (GPS). |
| `ir` | inteiro | R$ | Imposto de Renda. |
| `ipi` | inteiro | R$ | Imposto sobre Produtos Industrializados. |
| `transferencias` | inteiro | R$ | Transferências constitucionais e legais (total). |
| `fpm` | inteiro | R$ | Fundo de Participação dos Municípios. |
| `fundeb` | inteiro | R$ | FUNDEB. |
| `emendas` | inteiro | R$ | Emendas parlamentares recebidas. |

Notas:
- demais = arrecadacao - previdencia - ir - ipi (derivado no front; não armazenado).
- outras = transferencias - fpm - fundeb (derivado no front; não armazenado).
- Componentes-base apenas, para que um valor nunca contradiga o próprio total.

### `fato_indicadores_uf.csv` (28 linhas)

- **Grão:** Uma linha por região (BR + 27 UFs).
- **Fonte:** IBGE · Censo 2022 (população/área/densidade) e PIB 2023.

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `regiao_id` | texto | - | FK -> dim_uf.uf_sigla (BR ou sigla). |
| `ano_censo` | inteiro | ano | Ano do Censo. |
| `ano_pib` | inteiro | ano | Ano do PIB. |
| `populacao` | inteiro | habitantes | População residente. |
| `area_km2` | decimal | km² | Área territorial. |
| `densidade` | decimal | hab/km² | Densidade demográfica. |
| `pib_mil_brl` | inteiro | R$ mil | PIB em milhares de reais. |

### `dim_pais.csv` (171 linhas)

- **Grão:** Um parceiro comercial (país) por linha.
- **Fonte:** Comex Stat / MDIC.

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `iso` | texto | - | Código ISO do país. CHAVE (PK). |
| `nome` | texto | - | Nome do país. |
| `lon` | decimal | graus | Longitude aproximada. |
| `lat` | decimal | graus | Latitude aproximada. |

### `dim_setor_comercio.csv` (84 linhas)

- **Grão:** Um capítulo NCM (2 dígitos) por linha; "ZZ" agrega o restante.
- **Fonte:** Comex Stat / MDIC.

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `capitulo_ncm` | texto | - | Capítulo NCM de 2 dígitos (ou "ZZ" = Outros). CHAVE (PK). |
| `descricao` | texto | - | Descrição do capítulo. |

### `fato_comercio_parceiro.csv` (171 linhas)

- **Grão:** Uma linha por país parceiro.
- **Fonte:** Comex Stat / MDIC.

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `iso` | texto | - | FK -> dim_pais.iso. |
| `ano` | inteiro | ano | Ano de referência. |
| `exp` | inteiro | US$ FOB | Exportações do Brasil para o país. |
| `imp` | inteiro | US$ FOB | Importações do Brasil do país. |

### `fato_comercio_parceiro_setor.csv` (2176 linhas)

- **Grão:** Uma linha por país × capítulo NCM (setores aninhados desaninhados).
- **Fonte:** Comex Stat / MDIC.

| Coluna | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `iso` | texto | - | FK -> dim_pais.iso. |
| `capitulo_ncm` | texto | - | FK -> dim_setor_comercio.capitulo_ncm. |
| `ano` | inteiro | ano | Ano de referência. |
| `exp` | inteiro | US$ FOB | Exportações do setor para o país. |
| `imp` | inteiro | US$ FOB | Importações do setor do país. |
