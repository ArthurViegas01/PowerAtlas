<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CornerBracket from '@/components/hud/CornerBracket.vue'
import HudInput from '@/components/ui/HudInput.vue'
import { fromQuery, toQuery } from '@/lib/analysisUrl'
import { rankEntries, type PaletteEntry } from '@/lib/paletteIndex'
import { useAnalysisStore } from '@/stores/analysis'
import { useComercioStore } from '@/stores/comercio'
import { useCompareStore } from '@/stores/compare'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useMapLayersStore } from '@/stores/mapLayers'
import { useOnboardingStore } from '@/stores/onboarding'
import { usePaletteStore } from '@/stores/palette'
import { useRankingsStore } from '@/stores/rankings'
import { useSavedViewsStore } from '@/stores/savedViews'
import { useSelectionStore } from '@/stores/selection'

/**
 * Command palette (IA-2): Ctrl-K search over regions, trade partners,
 * ranking entities and commands. Every action mirrors an existing flow of
 * MapScreen/MapCompass through the selection store, so the palette never
 * invents behavior of its own. Mounted once in App.vue, above the router.
 */
const palette = usePaletteStore()
const selection = useSelectionStore()
const rankings = useRankingsStore()
const comercio = useComercioStore()
const demografia = useDemografiaStore()
const fiscal = useFiscalStore()
const mapLayers = useMapLayersStore()
const analysis = useAnalysisStore()
const savedViews = useSavedViewsStore()
const onboarding = useOnboardingStore()
const compare = useCompareStore()
const route = useRoute()
const router = useRouter()

const query = ref('')
const activeIndex = ref(0)
/** 'salvar' repurposes the input as the name field of the analysis. */
const mode = ref<'search' | 'salvar'>('search')
const hintOverride = ref<string | null>(null)
const inputRef = ref<InstanceType<typeof HudInput> | null>(null)
const listRef = ref<HTMLElement | null>(null)

const commandEntries = computed<PaletteEntry[]>(() => [
  {
    key: 'cmd-national',
    group: 'command',
    label: 'VISÃO NACIONAL [BR]',
    sublabel: 'CÂMERA + PAINEL DO BRASIL',
    action: { kind: 'command', command: 'national' },
  },
  {
    key: 'cmd-global',
    group: 'command',
    label: 'VISÃO GLOBAL',
    sublabel: 'MUNDO + COMÉRCIO EXTERIOR',
    action: { kind: 'command', command: 'global' },
  },
  {
    key: 'cmd-demografia',
    group: 'command',
    label: selection.demographicView ? 'SAIR DA VISÃO DEMOGRÁFICA' : 'VISÃO DEMOGRÁFICA [BR]',
    sublabel: 'COLUNAS POR MUNICÍPIO',
    action: { kind: 'command', command: 'demografia' },
  },
  route.path === '/dados'
    ? {
        key: 'cmd-mapa',
        group: 'command',
        label: 'VOLTAR AO MAPA',
        sublabel: 'ROTA /',
        action: { kind: 'command', command: 'mapa' },
      }
    : {
        key: 'cmd-console',
        group: 'command',
        label: 'CONSOLE DE DADOS',
        sublabel: 'ROTA /DADOS',
        action: { kind: 'command', command: 'console' },
      },
  {
    key: 'cmd-salvar',
    group: 'command',
    label: 'SALVAR ANÁLISE',
    sublabel: 'GUARDA O ESTADO ATUAL COM NOME',
    action: { kind: 'command', command: 'salvar' },
  },
  {
    key: 'cmd-copiar',
    group: 'command',
    label: 'COPIAR LINK DA ANÁLISE',
    sublabel: 'URL QUE RECONSTRÓI ESTA TELA',
    keywords: ['compartilhar', 'share'],
    action: { kind: 'command', command: 'copiar' },
  },
  ...(selection.selectedId && !selection.selectedMunicipio
    ? [
        {
          key: 'cmd-comparar',
          group: 'command' as const,
          label: compare.has(selection.selectedId)
            ? 'REMOVER DA COMPARAÇÃO'
            : 'FIXAR NA COMPARAÇÃO',
          sublabel: `${selection.selectedId} · ATÉ 4 REGIÕES`,
          action: { kind: 'command' as const, command: 'comparar' as const },
        },
      ]
    : []),
  ...(compare.count
    ? [
        {
          key: 'cmd-comparar-abrir',
          group: 'command' as const,
          label: 'ABRIR COMPARAÇÃO',
          sublabel: `${compare.count} FIXADAS · ROTA /COMPARAR`,
          action: { kind: 'command' as const, command: 'comparar-abrir' as const },
        },
      ]
    : []),
  {
    key: 'cmd-home',
    group: 'command',
    label: 'VOLTAR AO BRASIL',
    sublabel: 'FECHA PAINÉIS + CÂMERA NACIONAL',
    keywords: ['esc', 'limpar'],
    action: { kind: 'command', command: 'home' },
  },
  {
    key: 'cmd-norte',
    group: 'command',
    label: 'ALINHAR AO NORTE',
    sublabel: 'BRG 000',
    action: { kind: 'command', command: 'norte' },
  },
  {
    key: 'cmd-auto',
    group: 'command',
    label: 'ENQUADRAMENTO AUTO',
    sublabel: 'LIMPA ROTAÇÃO E INCLINAÇÃO MANUAIS',
    action: { kind: 'command', command: 'auto' },
  },
  {
    key: 'cmd-sobre',
    group: 'command',
    label: 'SOBRE / METODOLOGIA',
    sublabel: 'ESCALA, DIMENSÕES E FONTES · ROTA /SOBRE',
    keywords: ['metodologia', 'fontes', 'escala'],
    action: { kind: 'command', command: 'sobre' },
  },
  {
    key: 'cmd-intro',
    group: 'command',
    label: 'VER INTRODUÇÃO',
    sublabel: 'ONBOARDING EM 4 PASSOS',
    keywords: ['ajuda', 'tutorial', 'onboarding'],
    action: { kind: 'command', command: 'intro' },
  },
])

const savedEntries = computed<PaletteEntry[]>(() =>
  savedViews.views.map((view) => ({
    key: `saved-${view.id}`,
    group: 'saved' as const,
    label: view.name.toUpperCase(),
    sublabel: `${new Date(view.savedAt).toLocaleDateString('pt-BR')} · DEL REMOVE`,
    action: { kind: 'saved' as const, id: view.id },
  })),
)

const regionEntries = computed<PaletteEntry[]>(() =>
  [...rankings.regionsById.values()]
    .sort((a, b) =>
      a.id === 'BR' ? -1 : b.id === 'BR' ? 1 : a.name.localeCompare(b.name, 'pt-BR'),
    )
    .map((region) => ({
      key: `region-${region.id}`,
      group: 'region' as const,
      label: region.name.toUpperCase(),
      sublabel: region.id === 'BR' ? 'PAÍS' : `UF · ${region.id}`,
      keywords: [region.id],
      action: { kind: 'region' as const, id: region.id, name: region.name },
    })),
)

const countryEntries = computed<PaletteEntry[]>(() =>
  comercio.partners.map((partner) => ({
    key: `country-${partner.iso}`,
    group: 'country' as const,
    label: partner.name.toUpperCase(),
    sublabel: `PARCEIRO COMERCIAL · ${partner.iso}`,
    keywords: [partner.iso],
    action: { kind: 'country' as const, iso: partner.iso, name: partner.name },
  })),
)

/** Fictional ranking entities; picking one flies to its region. */
const entityEntries = computed<PaletteEntry[]>(() => {
  const out: PaletteEntry[] = []
  for (const region of rankings.regionsById.values()) {
    for (const entity of [...region.official, ...region.hidden]) {
      out.push({
        key: `entity-${entity.id}`,
        group: 'entity',
        label: entity.name.toUpperCase(),
        sublabel: `${region.id} · ${entity.dimension === 'official' ? 'OFICIAL' : 'OCULTA'}`,
        action: { kind: 'region', id: region.id, name: region.name },
      })
    }
  }
  return out
})

const groups = computed(() =>
  rankEntries(
    [
      ...commandEntries.value,
      ...savedEntries.value,
      ...regionEntries.value,
      ...countryEntries.value,
      ...entityEntries.value,
    ],
    query.value,
    // Empty query reads as a menu: show every command; searches stay capped.
    query.value.trim() ? 6 : 12,
  ),
)

/** Groups with a running index per entry, for the single active-row cursor. */
const indexed = computed(() => {
  let index = 0
  return groups.value.map((group) => ({
    ...group,
    entries: group.entries.map((entry) => ({ entry, index: index++ })),
  }))
})

const flat = computed(() => groups.value.flatMap((group) => group.entries))

watch([query, () => palette.isOpen], () => {
  activeIndex.value = 0
})

watch(
  () => palette.isOpen,
  async (open) => {
    if (!open) return
    query.value = ''
    mode.value = 'search'
    hintOverride.value = null
    void rankings.load()
    void comercio.load()
    await nextTick()
    inputRef.value?.focus()
  },
)

/** Share URL for the current analysis (the sync keeps location in step). */
function shareUrl(): string {
  const params = new URLSearchParams(toQuery(analysis.snapshot())).toString()
  return `${location.origin}/${params ? `?${params}` : ''}`
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl())
    hintOverride.value = 'LINK COPIADO'
  } catch {
    hintOverride.value = 'FALHA AO COPIAR'
  }
  window.setTimeout(() => {
    hintOverride.value = null
    palette.close()
  }, 900)
}

function saveCurrent() {
  const name =
    query.value.trim() || `ANÁLISE ${new Date().toLocaleString('pt-BR')}`
  savedViews.save(name, new URLSearchParams(toQuery(analysis.snapshot())).toString())
  mode.value = 'search'
  palette.close()
}

function move(delta: number) {
  const count = flat.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
  void nextTick(() => {
    listRef.value
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  })
}

/** Every branch mirrors an existing MapScreen/MapCompass flow, on purpose. */
async function run(entry: PaletteEntry) {
  const action = entry.action
  if (action.kind === 'command' && action.command === 'salvar') {
    mode.value = 'salvar'
    query.value = ''
    inputRef.value?.focus()
    return
  }
  if (action.kind === 'command' && action.command === 'copiar') {
    void copyLink()
    return
  }
  palette.close()
  if (action.kind === 'saved') {
    const view = savedViews.views.find((candidate) => candidate.id === action.id)
    if (!view) return
    if (route.path !== '/') await router.push('/')
    void analysis.apply(fromQuery(Object.fromEntries(new URLSearchParams(view.query))))
    return
  }
  if (action.kind === 'command' && action.command === 'console') {
    void router.push('/dados')
    return
  }
  if (action.kind === 'command' && action.command === 'comparar-abrir') {
    void router.push('/comparar')
    return
  }
  if (action.kind === 'command' && action.command === 'sobre') {
    void router.push('/sobre')
    return
  }
  if (route.path !== '/') await router.push('/')
  if (action.kind === 'region') {
    selection.exitDemographicView()
    selection.select(action.id, action.name)
    return
  }
  if (action.kind === 'country') {
    selection.exitDemographicView()
    selection.selectTradePartner({ iso: action.iso, name: action.name })
    selection.requestCamera('global')
    return
  }
  switch (action.command) {
    case 'national':
      selection.exitDemographicView()
      selection.select('BR', 'Brasil')
      break
    case 'global':
      selection.exitDemographicView()
      selection.closePanels()
      selection.requestCamera('global')
      break
    case 'demografia':
      if (selection.demographicView) {
        selection.exitDemographicView()
        break
      }
      void demografia.load()
      void fiscal.load()
      void mapLayers.loadAllMunicipios()
      selection.enterDemographicView()
      break
    case 'home':
      selection.goHome()
      break
    case 'norte':
      selection.requestNorth()
      break
    case 'auto':
      selection.requestAutoBearing()
      break
    case 'intro':
      onboarding.open()
      break
    case 'comparar':
      if (selection.selectedId && selection.selectedName)
        compare.toggle({ id: selection.selectedId, name: selection.selectedName })
      break
    case 'mapa':
    case 'salvar':
    case 'copiar':
    case 'comparar-abrir':
    case 'sobre':
      break // these returned earlier or already landed on their route
  }
}

function onInputKeydown(event: KeyboardEvent) {
  if (mode.value === 'salvar') {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveCurrent()
    }
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const entry = flat.value[activeIndex.value]
    if (entry) void run(entry)
  } else if (event.key === 'Delete') {
    const entry = flat.value[activeIndex.value]
    if (entry?.action.kind === 'saved') {
      event.preventDefault()
      savedViews.remove(entry.action.id)
      void nextTick(() => {
        activeIndex.value = Math.min(activeIndex.value, Math.max(0, flat.value.length - 1))
      })
    }
  }
}

/**
 * Capture-phase listener so Ctrl-K works everywhere and Esc closes the
 * palette BEFORE MapScreen's own Esc cascade sees the event. Immediate stop:
 * other window-level capture listeners (the onboarding overlay) must not see
 * the same Esc either.
 */
function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
    event.preventDefault()
    event.stopImmediatePropagation()
    palette.toggle()
    return
  }
  if (palette.isOpen && event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (mode.value === 'salvar') {
      mode.value = 'search'
      query.value = ''
      return
    }
    palette.close()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown, true))
</script>

<template>
  <transition name="pa-fade">
    <div v-if="palette.isOpen" class="palette-overlay" @click.self="palette.close()">
      <div class="palette" role="dialog" aria-modal="true" aria-label="Busca e comandos">
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="br" />
        <CornerBracket position="bl" />
        <HudInput
          ref="inputRef"
          v-model="query"
          :placeholder="mode === 'salvar' ? 'Nome da análise' : 'Buscar região, país, entidade ou comando'"
          aria-controls="palette-results"
          @keydown="onInputKeydown"
        />
        <p class="hint pa-label">
          {{
            hintOverride ??
            (mode === 'salvar'
              ? 'ENTER SALVA · ESC VOLTA'
              : 'SETAS NAVEGAM · ENTER EXECUTA · ESC FECHA')
          }}
        </p>
        <div
          v-if="mode === 'search' && flat.length"
          id="palette-results"
          ref="listRef"
          class="results"
          role="listbox"
        >
          <template v-for="group in indexed" :key="group.group">
            <p class="group pa-label">{{ group.label }}</p>
            <button
              v-for="{ entry, index } in group.entries"
              :key="entry.key"
              class="item"
              :class="{ 'item--active': index === activeIndex }"
              type="button"
              role="option"
              :aria-selected="index === activeIndex"
              :data-active="index === activeIndex ? 'true' : undefined"
              @click="run(entry)"
              @mousemove="activeIndex = index"
            >
              <span class="item-label pa-data">{{ entry.label }}</span>
              <span v-if="entry.sublabel" class="item-sub pa-label">{{ entry.sublabel }}</span>
            </button>
          </template>
        </div>
        <p v-else-if="mode === 'search'" class="empty pa-label">
          SEM RESULTADOS PARA "{{ query.toUpperCase() }}"
        </p>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Page overlay: void at 40%, no blur (ARCHITECTURE surface rule). */
.palette-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--pa-z-command);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh var(--pa-space-4) var(--pa-space-4);
  background: color-mix(in srgb, var(--pa-bg-void) 40%, transparent);
}

.palette {
  position: relative;
  width: min(560px, 100%);
  padding: var(--pa-space-4);
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-cyan);
  backdrop-filter: blur(10px);
  box-shadow:
    var(--pa-glow-cyan),
    inset 0 0 42px rgba(61, 225, 255, 0.03);
}

.hint {
  margin: var(--pa-space-2) 0 0;
  letter-spacing: 0.14em;
}

.results {
  max-height: 46vh;
  margin-top: var(--pa-space-3);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--pa-border-cyan) transparent;
}

.group {
  margin: var(--pa-space-3) 0 var(--pa-space-1);
  color: var(--pa-text-faint);
}

.group:first-child {
  margin-top: 0;
}

.item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--pa-space-3);
  width: 100%;
  padding: var(--pa-space-15) var(--pa-space-2);
  font: inherit;
  text-align: left;
  color: var(--pa-text-primary);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
}

.item--active {
  background: color-mix(in srgb, var(--pa-series-official) 8%, transparent);
  border-color: var(--pa-border-cyan);
}

.item-label {
  overflow: hidden;
  font-size: var(--pa-text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-sub {
  flex: none;
}

.empty {
  margin: var(--pa-space-4) 0 var(--pa-space-2);
  text-align: center;
}
</style>
