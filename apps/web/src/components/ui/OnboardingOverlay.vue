<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import CornerBracket from '@/components/hud/CornerBracket.vue'
import DecryptedText from '@/components/shared/DecryptedText.vue'
import DataProvenanceChip from '@/components/ui/DataProvenanceChip.vue'
import HudButton from '@/components/ui/HudButton.vue'
import { useOnboardingStore } from '@/stores/onboarding'

/**
 * First-visit welcome overlay (PROD-5): four steps over the map, dismissible
 * and remembered in localStorage, never blocking again after the first
 * dismiss. Auto-opens once on the map route; the palette reopens it via
 * VER INTRODUÇÃO. Esc dismisses in capture phase so MapScreen's Esc cascade
 * never sees the event while the overlay is up.
 */
const onboarding = useOnboardingStore()
const route = useRoute()

const step = ref(0)

const STEPS: { title: string; body: string; chips?: boolean }[] = [
  {
    title: 'O QUE É O POWERATLAS',
    body: 'Um atlas tático de influência sobre o Brasil: estados, municípios, comércio exterior e demografia num só globo. Clique num estado para abrir o ranking da região; Esc sempre volta um nível.',
  },
  {
    title: 'A ESCALA DE INFLUÊNCIA',
    body: 'Cada região carrega rankings de influência de 0 a 100 em duas dimensões: a oficial (ciano), da estrutura constitucional, e a oculta (âmbar), bloqueada como "em breve" até o pipeline de dados reais passar por revisão humana.',
  },
  {
    title: 'DADOS MISTOS, SEMPRE MARCADOS',
    body: 'Números reais (IBGE, Comex, Tesouro) e placeholders de desenvolvimento convivem aqui, e todo número diz de onde veio pelo selo de origem. As entidades dos rankings são fictícias nesta fase.',
    chips: true,
  },
  {
    title: 'NAVEGUE COMO OPERADOR',
    body: 'Ctrl-K abre a busca e os comandos: regiões, países parceiros, entidades, salvar e compartilhar análises. O compasso gira e inclina a câmera; a URL desta tela é sempre um link compartilhável.',
  },
]

const last = computed(() => step.value === STEPS.length - 1)
const visible = computed(() => onboarding.isOpen && route.path === '/')

// Auto-open once per browser: first landing on the map without a dismiss.
watch(
  () => route.path,
  (path) => {
    if (path === '/' && !onboarding.dismissed) onboarding.open()
  },
  { immediate: true },
)

watch(
  () => onboarding.isOpen,
  (open) => {
    if (open) step.value = 0
  },
)

function next() {
  if (last.value) onboarding.dismiss()
  else step.value += 1
}

function prev() {
  if (step.value > 0) step.value -= 1
}

/** Capture phase: Esc dismisses before MapScreen's Esc cascade sees it. */
function onKeydown(event: KeyboardEvent) {
  if (!visible.value || event.key !== 'Escape') return
  event.preventDefault()
  event.stopImmediatePropagation()
  onboarding.dismiss()
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <transition name="pa-fade">
    <div v-if="visible" class="onboarding-overlay">
      <div class="onboarding" role="dialog" aria-modal="true" aria-label="Introdução ao PowerAtlas">
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="br" />
        <CornerBracket position="bl" />
        <p class="kicker pa-label">PRIMEIRO ACESSO · PASSO {{ step + 1 }}/{{ STEPS.length }}</p>
        <h2 class="title pa-data">
          <DecryptedText :text="STEPS[step].title" />
        </h2>
        <p class="body">{{ STEPS[step].body }}</p>
        <div v-if="STEPS[step].chips" class="chips">
          <DataProvenanceChip state="real" label="IBGE · CENSO 2022" />
          <DataProvenanceChip state="simulated" />
        </div>
        <div class="controls">
          <HudButton type="button" @click="onboarding.dismiss()">PULAR (ESC)</HudButton>
          <div class="dots" aria-hidden="true">
            <span
              v-for="(s, index) in STEPS"
              :key="s.title"
              class="dot"
              :class="{ 'dot--on': index === step }"
            ></span>
          </div>
          <div class="nav">
            <HudButton v-if="step > 0" type="button" @click="prev">◄ ANTERIOR</HudButton>
            <HudButton type="button" :active="last" @click="next">
              {{ last ? 'COMEÇAR' : 'PRÓXIMO ►' }}
            </HudButton>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Page overlay: void at 40%, no blur (ARCHITECTURE surface rule). */
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--pa-z-modal);
  display: grid;
  place-items: center;
  padding: var(--pa-space-4);
  background: color-mix(in srgb, var(--pa-bg-void) 40%, transparent);
}

.onboarding {
  position: relative;
  width: min(600px, 100%);
  padding: var(--pa-space-6);
  background: var(--pa-bg-panel);
  border: 1px solid var(--pa-border-cyan);
  backdrop-filter: blur(10px);
  box-shadow:
    var(--pa-glow-cyan),
    inset 0 0 42px rgba(61, 225, 255, 0.03);
}

.kicker {
  margin: 0 0 var(--pa-space-3);
}

.title {
  margin: 0 0 var(--pa-space-3);
  font-size: var(--pa-text-lg);
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--pa-text-primary);
  text-shadow: 0 0 12px rgba(61, 225, 255, 0.35);
}

.body {
  min-height: 72px;
  margin: 0 0 var(--pa-space-4);
  font-size: var(--pa-text-sm);
  line-height: 1.7;
  color: var(--pa-text-dim);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pa-space-2);
  margin: 0 0 var(--pa-space-4);
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pa-space-3);
}

.dots {
  display: flex;
  gap: var(--pa-space-15);
}

/* Square dots: the HUD is angular. */
.dot {
  width: 8px;
  height: 8px;
  border: 1px solid var(--pa-border-cyan);
}

.dot--on {
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

.nav {
  display: flex;
  gap: var(--pa-space-2);
}

@media (max-width: 900px) {
  .controls {
    flex-wrap: wrap;
  }
}
</style>
