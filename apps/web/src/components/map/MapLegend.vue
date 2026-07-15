<template>
  <div class="legend">
    <p class="pa-label legend-title">LEGENDA // CAMADAS</p>
    <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
      <li class="flex items-center gap-2">
        <span class="swatch swatch--official"></span>
        <span class="row-label pa-data">PODER OFICIAL</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--hidden"></span>
        <span class="row-label pa-data">PODER OCULTO · FICTÍCIO</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--nodata"></span>
        <span class="row-label pa-data">SEM DADOS (FASE 1)</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--intl"></span>
        <span class="row-label pa-data">INTERNACIONAL · EM BREVE</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--heat"></span>
        <span class="row-label pa-data">ATIVIDADE AMBIENTE</span>
      </li>
      <li class="flex items-center gap-2">
        <span class="swatch swatch--arc">◜</span>
        <span class="row-label pa-data">ARCOS DE INFLUÊNCIA</span>
      </li>
    </ul>
    <p class="credit pa-label">MALHAS: IBGE · SIMPLIFICADAS</p>
  </div>
</template>

<style scoped>
.legend {
  position: absolute;
  left: 22px;
  bottom: 52px;
  z-index: 18;
  padding: 12px 14px;
  background: rgba(3, 6, 8, 0.72);
  border: 1px solid var(--pa-border-faint);
  backdrop-filter: blur(6px);
}

.legend-title {
  margin: 0 0 8px;
  color: var(--pa-text-dim);
}

.row-label {
  font-size: var(--pa-text-2xs);
  letter-spacing: 0.1em;
  color: var(--pa-text-dim);
}

.swatch {
  width: 14px;
  height: 8px;
  flex: none;
}

.swatch--official {
  background: var(--pa-series-official);
  box-shadow: var(--pa-glow-cyan);
}

.swatch--hidden {
  background: var(--pa-series-hidden);
  box-shadow: var(--pa-glow-amber);
}

.swatch--nodata {
  background: rgba(61, 88, 101, 0.25);
  border: 1px solid var(--pa-border-faint);
}

.swatch--intl {
  background: rgba(61, 88, 101, 0.12);
  border: 1px dashed var(--pa-text-faint);
}

.swatch--heat {
  background: linear-gradient(to right, rgba(61, 225, 255, 0.1), rgba(61, 225, 255, 0.85));
}

.swatch--arc {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: auto;
  color: var(--pa-series-hidden);
  font-size: 12px;
  line-height: 1;
}

.credit {
  margin: 10px 0 0;
  color: var(--pa-text-faint);
}

@media (max-width: 900px) {
  .legend {
    display: none;
  }
}
</style>
