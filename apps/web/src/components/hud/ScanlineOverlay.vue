<template>
  <div class="scanlines" aria-hidden="true">
    <div class="scan-band"></div>
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

.scan-band {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 140px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(61, 225, 255, 0.045) 45%,
    rgba(61, 225, 255, 0.095) 50%,
    rgba(61, 225, 255, 0.045) 55%,
    transparent
  );
  animation: band-sweep 9s linear infinite;
}

@keyframes band-sweep {
  from {
    transform: translateY(-20vh);
  }

  to {
    transform: translateY(115vh);
  }
}

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(2, 4, 6, 0.55) 100%);
}

@media (prefers-reduced-motion: reduce) {
  .scan-band {
    display: none;
  }
}
</style>
