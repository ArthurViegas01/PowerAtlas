<script setup lang="ts">
import { computed } from 'vue'

import { formatGdpThousands, formatPeopleCompact } from '@/lib/format'
import { useIndicatorsStore } from '@/stores/indicators'
import { useSelectionStore } from '@/stores/selection'

/**
 * Cursor-anchored HUD tooltip for map hover, fed by deck.gl picking through
 * the selection store. Priority: municipality > state > world backdrop.
 * pointer-events: none, so it never steals the click that selects a region.
 */
const selection = useSelectionStore()
const indicators = useIndicatorsStore()

interface TooltipModel {
  title: string
  tag: string
  lines: { label: string; value: string }[]
}

const model = computed<TooltipModel | null>(() => {
  const municipio = selection.hoveredMunicipio
  if (municipio) {
    const data = indicators.forMunicipio(selection.selectedId, municipio.codigo)
    return {
      title: municipio.name,
      tag: `MUNICÍPIO · ${municipio.codigo}`,
      lines: data
        ? [
            { label: 'POP', value: formatPeopleCompact(data.population) },
            { label: 'PIB', value: formatGdpThousands(data.gdpBrlThousands) },
          ]
        : [],
    }
  }
  if (selection.hoveredId) {
    const data = indicators.forRegion(selection.hoveredId)
    return {
      title: selection.hoveredName ?? selection.hoveredId,
      tag: `UF · ${selection.hoveredId}`,
      lines: data
        ? [
            { label: 'POP', value: formatPeopleCompact(data.population) },
            { label: 'PIB', value: formatGdpThousands(data.gdpBrlThousands) },
          ]
        : [],
    }
  }
  if (selection.hoveredWorld) {
    return {
      title: selection.hoveredWorld.name,
      tag: 'NÃO MAPEADO',
      lines: [{ label: 'STATUS', value: 'EM BREVE' }],
    }
  }
  return null
})

/** Follow the cursor, flipping near the right/bottom edges of the viewport. */
const style = computed<Record<string, string> | null>(() => {
  const point = selection.hoverPoint
  if (!point) return null
  const flipX = typeof window !== 'undefined' && point.x > window.innerWidth - 240
  const flipY = typeof window !== 'undefined' && point.y > window.innerHeight - 130
  return {
    left: `${point.x}px`,
    top: `${point.y}px`,
    transform: `translate(${flipX ? 'calc(-100% - 14px)' : '14px'}, ${flipY ? 'calc(-100% - 14px)' : '14px'})`,
  }
})
</script>

<template>
  <transition name="pa-fade">
    <div v-if="model && style" class="map-tooltip" :style="style" aria-hidden="true">
      <p class="tooltip-title pa-data">{{ model.title }}</p>
      <p class="pa-label tooltip-tag">{{ model.tag }}</p>
      <dl v-if="model.lines.length" class="tooltip-lines">
        <div v-for="line in model.lines" :key="line.label" class="tooltip-line">
          <dt class="pa-label">{{ line.label }}</dt>
          <dd class="pa-data">{{ line.value }}</dd>
        </div>
      </dl>
    </div>
  </transition>
</template>

<style scoped>
.map-tooltip {
  position: absolute;
  z-index: 18;
  min-width: 150px;
  max-width: 230px;
  padding: 8px 10px;
  pointer-events: none;
  background: rgba(3, 6, 8, 0.88);
  border: 1px solid var(--pa-border-cyan);
  box-shadow: var(--pa-glow-cyan);
}

.tooltip-title {
  margin: 0;
  font-size: var(--pa-text-sm);
  letter-spacing: 0.08em;
  color: var(--pa-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tooltip-tag {
  margin: 2px 0 0;
  letter-spacing: 0.12em;
}

.tooltip-lines {
  display: grid;
  gap: 2px;
  margin: 8px 0 0;
  padding-top: 6px;
  border-top: 1px solid var(--pa-border-faint);
}

.tooltip-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.tooltip-line dt {
  margin: 0;
}

.tooltip-line dd {
  margin: 0;
  font-size: var(--pa-text-xs);
  color: var(--pa-text-primary);
}
</style>
