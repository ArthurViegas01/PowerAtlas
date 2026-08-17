<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CornerBracket from '@/components/hud/CornerBracket.vue'
import HudInput from '@/components/ui/HudInput.vue'
import { rankEntries, type PaletteEntry } from '@/lib/paletteIndex'
import { useComercioStore } from '@/stores/comercio'
import { useDemografiaStore } from '@/stores/demografia'
import { useFiscalStore } from '@/stores/fiscal'
import { useMapLayersStore } from '@/stores/mapLayers'
import { usePaletteStore } from '@/stores/palette'
import { useRankingsStore } from '@/stores/rankings'
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
const route = useRoute()
const router = useRouter()

const query = ref('')
const activeIndex = ref(0)
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
])

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
      ...regionEntries.value,
      ...countryEntries.value,
      ...entityEntries.value,
    ],
    query.value,
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
    void rankings.load()
    void comercio.load()
    await nextTick()
    inputRef.value?.focus()
  },
)

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
  palette.close()
  const action = entry.action
  if (action.kind === 'command' && action.command === 'console') {
    void router.push('/dados')
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
    case 'mapa':
      break // the router.push above already landed on the map
  }
}

function onInputKeydown(event: KeyboardEvent) {
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
  }
}

/**
 * Capture-phase listener so Ctrl-K works everywhere and Esc closes the
 * palette BEFORE MapScreen's own Esc cascade sees the event.
 */
function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
    event.preventDefault()
    event.stopPropagation()
    palette.toggle()
    return
  }
  if (palette.isOpen && event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
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
          placeholder="Buscar região, país, entidade ou comando"
          aria-controls="palette-results"
          @keydown="onInputKeydown"
        />
        <p class="hint pa-label">SETAS NAVEGAM · ENTER EXECUTA · ESC FECHA</p>
        <div v-if="flat.length" id="palette-results" ref="listRef" class="results" role="listbox">
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
        <p v-else class="empty pa-label">SEM RESULTADOS PARA "{{ query.toUpperCase() }}"</p>
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
