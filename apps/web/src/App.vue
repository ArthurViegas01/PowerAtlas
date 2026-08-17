<script setup lang="ts">
/**
 * App shell. The two screens (the map HUD and the data console) are routes;
 * this component is just the mount point. Pinia stores live above the router,
 * so map state survives a trip to the console and back.
 */
import { RouterView } from 'vue-router'

import CommandPalette from '@/components/ui/CommandPalette.vue'
import { useAnalysisSync } from '@/composables/useAnalysisSync'

// Keeps the URL and the analysis state in step, both ways (IA-3).
useAnalysisSync()
</script>

<template>
  <RouterView />
  <!-- Global overlay: lives above the router so Ctrl-K works on any route. -->
  <CommandPalette />
</template>
