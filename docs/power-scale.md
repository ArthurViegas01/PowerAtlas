# Escala de poder (Power Scale)

Índice único de **0 a 100** que mede poder de um agente, servindo tanto para
uma pessoa comum quanto para um presidente, senador ou empresário, e valendo
igual para o **setor público** e o **privado**.

> Todos os valores são **estimativas metodológicas simuladas** — placeholders
> para desenvolvimento da UI, não medições verificadas. Coerente com o
> disclaimer global do PowerAtlas.

## Três pilares

O score combina três dimensões, cada uma normalizada em 0-100:

| Pilar | Símbolo | O que mede | Público | Privado |
|-------|---------|------------|---------|---------|
| **Capital** | `C` | Dinheiro/patrimônio controlado | salário/bens | patrimônio/faturamento |
| **Autoridade** | `A` | Poder formal do cargo | cargo constitucional | span de controle |
| **Influência** | `I` | Alcance e mobilização | base eleitoral, mídia | rede, lobby, mídia |

### Capital (escala logarítmica)

Dinheiro varia em ordens de grandeza, então a régua é log entre um piso e um
teto:

```
C = clamp01( (log10(valor) - log10(PISO)) / (log10(TETO) - log10(PISO)) ) * 100
PISO = R$ 10 mil     TETO = R$ 100 bilhões
```

Assim cada ordem de grandeza a mais soma um valor aproximadamente constante:
um poupador modesto fica perto de 0-15; um bilionário perto de 90-100.

### Autoridade (patamares de cargo)

Tabela de âncoras (`AUTHORITY_TIER` em `lib/powerScore.ts`): presidência 100,
STF/presidência de casa legislativa ~85, governador 75, senador 70, deputado
federal 55, prefeito de capital 52, prefeito 35, vereador 18. O setor privado
usa a mesma régua por span de controle: controlador de conglomerado ~80, CEO de
grande empresa ~68, dono de PME ~30. Cidadão comum = 0.

### Influência

Entrada estimada 0-100 (base eleitoral, alcance de mídia, capacidade de
mobilização, densidade de rede). Sempre rotulada como estimativa.

## Fórmula final

```
powerScore = round( 0.34·C + 0.33·A + 0.33·I )   ∈ [0, 100]
```

Soma ponderada (não média geométrica) **de propósito**: um bilionário sem
cargo (A=0) ainda pontua alto por C+I; um presidente sem grande patrimônio
(C baixo) ainda pontua alto por A+I. A geométrica zeraria esses casos.

## Escala de referência

| Agente | C | A | I | Score aprox. |
|--------|---|---|---|--------------|
| Cidadão comum, 25 anos, renda modesta | ~5 | 0 | ~2 | **~2** |
| Vereador de cidade média | ~10 | 18 | ~15 | **~14** |
| Prefeito | ~25 | 35 | ~40 | **~33** |
| Senador | ~30 | 70 | ~65 | **~55** |
| Governador de estado grande | ~35 | 75 | ~80 | **~63** |
| Presidente da República | ~30 | 100 | ~96 | **~75+** |
| Bilionário (controlador) | ~95 | 80 | ~80 | **~85** |

Os âncoras acima são cobertos por testes em `lib/powerScore.spec.ts`.

## Implementação

- `apps/web/src/lib/powerScore.ts` — `capitalScore`, `authorityScore`,
  `powerScore`, pesos e âncoras.
- `apps/web/src/types/power-entity.ts` — `PowerBreakdown` e o campo `power` de
  cada `PowerEntity`; o card nacional mostra a decomposição.
