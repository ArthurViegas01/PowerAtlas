<template>
  <!-- Traveling scan band. Sits BEHIND the map canvases (rendered before
       MapView, base map transparent): the opaque land fills occlude it, so
       the sweep reads as passing behind the countries, over the void. -->
  <div class="scan-underlay" aria-hidden="true">
    <div class="scan-band"></div>
  </div>
</template>

<style scoped>
.scan-underlay {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
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

@media (prefers-reduced-motion: reduce) {
  .scan-band {
    display: none;
  }
}
</style>
