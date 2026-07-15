<script setup lang="ts">
import { toRef } from 'vue'

import { useAnimatedCounter } from '@/composables/useAnimatedCounter'

const props = withDefaults(defineProps<{ value: number; duration?: number }>(), {
  duration: 0.9,
})

const display = useAnimatedCounter(toRef(props, 'value'), props.duration)
</script>

<template>
  <span class="pa-data">{{ display }}</span>
</template>
