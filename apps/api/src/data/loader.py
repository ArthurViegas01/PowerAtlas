"""Loads the fictional mock dataset and assembles the RegionPowerData payload.

This is the API-side counterpart of the web ``mockDataLoader.ts``: same source
JSON, same envelope, same region ordering (country first, then states in
pt-BR collation order). The API owns its own copy of the JSON under
``src/data/mock`` (synced manually with the web until F4 introduces a
database). Swapping this for a real database read is a one-module change.
"""

from __future__ import annotations

import json
import unicodedata
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..models.power_entity import (
    AmbientSignal,
    InfluenceLink,
    PowerRegion,
    RegionPowerData,
)

_MOCK_DIR = Path(__file__).parent / "mock"
_NETWORK_FILE = "influence-network.json"

# Kept byte-identical to the web MOCK_DISCLAIMER so the payload matches.
DISCLAIMER = 'PROTÓTIPO · DADOS SIMULADOS · ENTIDADES DE "PODER OCULTO" SÃO FICTÍCIAS'


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _collation_key(region: PowerRegion) -> tuple[int, str]:
    """Country first, then states alphabetically under pt-BR collation.

    JS ``localeCompare`` folds accents (``São`` sorts as ``Sao``); Python's
    default codepoint sort does not, so we strip diacritics to mirror it.
    """
    rank = 0 if region.kind == "country" else 1
    folded = "".join(
        ch
        for ch in unicodedata.normalize("NFKD", region.name)
        if not unicodedata.combining(ch)
    )
    return (rank, folded.casefold())


def _now_iso_z() -> str:
    """UTC timestamp in JS ``toISOString`` shape (millisecond precision, ``Z``)."""
    now = datetime.now(tz=UTC)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


@lru_cache(maxsize=1)
def _load_static() -> tuple[list[PowerRegion], list[InfluenceLink], list[AmbientSignal]]:
    regions: list[PowerRegion] = []
    links: list[InfluenceLink] = []
    signals: list[AmbientSignal] = []

    for path in sorted(_MOCK_DIR.glob("*.json")):
        data = _read_json(path)
        if path.name == _NETWORK_FILE:
            links = [InfluenceLink.model_validate(link) for link in data["links"]]
            signals = [AmbientSignal.model_validate(sig) for sig in data["ambientSignals"]]
        else:
            regions.append(PowerRegion.model_validate(data))

    regions.sort(key=_collation_key)
    return regions, links, signals


def load_region_power_data() -> RegionPowerData:
    """Assemble the full payload. Static content is cached; timestamp is fresh."""
    regions, links, signals = _load_static()
    return RegionPowerData(
        schema_version=1,
        generated_at=_now_iso_z(),
        disclaimer=DISCLAIMER,
        regions=regions,
        links=links,
        ambient_signals=signals,
    )
