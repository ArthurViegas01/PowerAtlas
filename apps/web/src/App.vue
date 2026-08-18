<script setup lang="ts">
/**
 * App shell. The two screens (the map HUD and the data console) are routes;
 * this component is just the mount point. Pinia stores live above the router,
 * so map state survives a trip to the console and back.
 */
import { RouterView } from 'vue-router'

import CommandPalette from '@/components/ui/CommandPalette.vue'
import NavRail from '@/components/ui/NavRail.vue'
import OnboardingOverlay from '@/components/ui/OnboardingOverlay.vue'
import { useAnalysisSync } from '@/composables/useAnalysisSync'

// Keeps the URL and the analysis state in step, both ways (IA-3).
useAnalysisSync()
</script>

<template>
  <NavRail />
  <div class="with-rail">
    <RouterView />
  </div>
  <!-- Global overlays above the router: Ctrl-K works on any route; the
       onboarding gates itself to the map route. Mount order matters: the
       palette registers its capture keydown first and wins the Esc. -->
  <CommandPalette />
  <OnboardingOverlay />
</template>

<style scoped>
/* Normal-flow screens live right of the rail; MapScreen's fixed shell
   offsets itself (its .app-shell inset does the same job). */
.with-rail {
  height: 100%;
  padding-left: var(--pa-rail-width);
}

@media (max-width: 900px) {
  .with-rail {
    padding-left: 0;
  }
}
</style>
