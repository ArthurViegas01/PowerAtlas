<script setup lang="ts">
import { computed } from 'vue'

/**
 * Data provenance seal (PROD-1). One reusable chip that says whether the
 * number next to it is verifiable official data (real), a development
 * placeholder (simulated) or a pipeline candidate awaiting human review
 * (review). Visual family follows ConfidenceBadge: thin border, radius-sm,
 * 2xs mono. The state colors reuse the confidence tokens on purpose;
 * provenance IS data status (docs/design-system.md, section 3).
 */
export type ProvenanceState = 'real' | 'simulated' | 'review'

const props = withDefaults(
  defineProps<{ state: ProvenanceState; label?: string; title?: string }>(),
  { label: '', title: '' },
)

const STATE_LABEL: Record<ProvenanceState, string> = {
  real: 'REAL',
  simulated: 'SIMULADO',
  review: 'EM REVISÃO',
}

const STATE_TITLE: Record<ProvenanceState, string> = {
  real: 'Dado real de fonte oficial verificável',
  simulated: 'Placeholder de desenvolvimento, dado fictício',
  review: 'Candidato do pipeline, ainda não publicado',
}

const text = computed(() =>
  props.label ? `${STATE_LABEL[props.state]} · ${props.label}` : STATE_LABEL[props.state],
)
const tip = computed(() => props.title || STATE_TITLE[props.state])
</script>

<template>
  <span class="prov pa-data" :class="`prov--${state}`" :title="tip">
    <i class="dot" aria-hidden="true"></i>
    {{ text }}
  </span>
</template>

<style scoped>
.prov {
  display: inline-flex;
  align-items: center;
  gap: var(--pa-space-1);
  padding: 1px 6px; /* chip fine-tune, off the spacing scale (ConfidenceBadge family) */
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.08em;
  border: 1px solid;
  border-radius: var(--pa-radius-sm);
}

.dot {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: var(--pa-radius-pill);
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}

.prov--real {
  color: var(--pa-confidence-high);
  border-color: color-mix(in srgb, var(--pa-confidence-high) 45%, transparent);
}

/* Simulated keeps the amber + dashed signature of the placeholder world. */
.prov--simulated {
  color: var(--pa-series-hidden);
  border-style: dashed;
  border-color: color-mix(in srgb, var(--pa-series-hidden) 55%, transparent);
}

.prov--review {
  color: var(--pa-confidence-medium);
  border-color: color-mix(in srgb, var(--pa-confidence-medium) 45%, transparent);
}
</style>
