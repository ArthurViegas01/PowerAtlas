<script setup lang="ts">
import CornerBracket from './CornerBracket.vue'
</script>

<template>
  <div class="hud-frame" aria-hidden="true">
    <CornerBracket position="tl" :size="26" />
    <CornerBracket position="tr" :size="26" />
    <CornerBracket position="br" :size="26" />
    <CornerBracket position="bl" :size="26" />
    <div class="ruler ruler--top"></div>
    <div class="ruler ruler--bottom"></div>
  </div>
</template>

<style scoped>
.hud-frame {
  position: fixed;
  inset: 10px;
  z-index: 30;
  border: 1px solid var(--pa-border-faint);
  pointer-events: none;
}

.ruler {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  height: 9px;
  background: repeating-linear-gradient(
    to right,
    var(--pa-border-cyan) 0 1px,
    transparent 1px 12px
  );
  opacity: 0.55;
}

.ruler--top {
  top: -1px;
}

.ruler--bottom {
  bottom: -1px;
}
</style>
