<!-- CRT texture + vignette only; the traveling band lives in ScanBand.vue,
     rendered BEHIND the map so it does not sweep over the countries. -->
<template>
  <div class="scanlines" aria-hidden="true">
    <div class="vignette"></div>
  </div>
</template>

<style scoped>
.scanlines {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(215, 243, 255, 0.028) 0 1px,
    transparent 1px 3px
  );
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(2, 4, 6, 0.55) 100%);
}

</style>
