<script setup lang="ts">
import { computed } from 'vue'

import type { PowerDimension, PowerEntity } from '@/types/power-entity'

import RankingBarItem from './RankingBarItem.vue'

const props = defineProps<{ entities: PowerEntity[]; variant: PowerDimension }>()

const sorted = computed(() => [...props.entities].sort((a, b) => b.score - a.score))
</script>

<template>
  <ul class="m-0 list-none p-0">
    <RankingBarItem
      v-for="(entity, index) in sorted"
      :key="entity.id"
      :entity="entity"
      :rank="index + 1"
      :variant="variant"
    />
  </ul>
  <p v-if="sorted.length === 0" class="pa-label">SEM REGISTROS</p>
</template>
