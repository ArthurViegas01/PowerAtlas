<script setup lang="ts">
/**
 * App shell. The two screens (the map HUD and the data console) are routes;
 * this component is just the mount point. Pinia stores live above the router,
 * so map state survives a trip to the console and back.
 */
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>
