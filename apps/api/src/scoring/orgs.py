"""Curated public-organization dictionary for the heuristic scoring v0.

Only official, national-scope public bodies: constitutional branches, courts,
ministries, federal agencies and state-owned giants. Real names on purpose:
candidates produced from this list live in the DRAFT staging tables behind
the F6 review gate and never reach the served payload (ARCHITECTURE section
5; the parity test enforces it). Aliases are conservative to avoid false
positives (e.g. no bare "Camara", which would match any city council).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Org:
    """One public organization the v0 heuristic can credit mentions to."""

    name: str
    kind: str  # entity_candidates.kind: office | institution | organization
    aliases: tuple[str, ...] = ()


ORGS: tuple[Org, ...] = (
    # Poderes e cupula
    Org("Presidência da República", "office", ("Palácio do Planalto",)),
    Org("Senado Federal", "institution", ("Agência Senado",)),
    Org("Câmara dos Deputados", "institution", ("Agência Câmara",)),
    Org("Supremo Tribunal Federal", "institution", ("STF",)),
    Org("Superior Tribunal de Justiça", "institution", ("STJ",)),
    Org("Tribunal Superior Eleitoral", "institution", ("TSE",)),
    Org("Tribunal de Contas da União", "institution", ("TCU",)),
    Org("Ministério Público Federal", "institution", ("Procuradoria-Geral da República", "PGR")),
    Org("Advocacia-Geral da União", "institution", ("AGU",)),
    Org("Controladoria-Geral da União", "institution", ("CGU",)),
    Org("Casa Civil", "institution"),
    # Ministerios
    Org("Ministério da Fazenda", "institution"),
    Org("Ministério da Justiça", "institution"),
    Org("Ministério da Saúde", "institution"),
    Org("Ministério da Educação", "institution"),
    Org("Ministério da Defesa", "institution"),
    Org("Ministério da Agricultura", "institution"),
    Org("Ministério do Meio Ambiente", "institution"),
    Org("Ministério de Minas e Energia", "institution"),
    Org("Ministério das Relações Exteriores", "institution", ("Itamaraty",)),
    Org("Ministério do Trabalho", "institution"),
    # Forcas e seguranca
    Org("Polícia Federal", "institution"),
    Org("Exército Brasileiro", "institution"),
    Org("Marinha do Brasil", "institution"),
    Org("Força Aérea Brasileira", "institution", ("Aeronáutica",)),
    # Agencias e autarquias
    Org("Banco Central", "institution"),
    Org("Receita Federal", "institution"),
    Org("INSS", "institution", ("Instituto Nacional do Seguro Social",)),
    Org("IBGE", "institution"),
    Org("Anvisa", "institution"),
    Org("Aneel", "institution"),
    Org("Anatel", "institution"),
    Org("ANP", "institution", ("Agência Nacional do Petróleo",)),
    Org("Ibama", "institution"),
    Org("Funai", "institution"),
    Org("Incra", "institution"),
    # Estatais e empresas publicas
    Org("Petrobras", "organization"),
    Org("Banco do Brasil", "organization"),
    Org("Caixa Econômica Federal", "organization", ("Caixa Econômica",)),
    Org("BNDES", "organization"),
    Org("Correios", "organization"),
    Org("Embrapa", "organization"),
    Org("Eletrobras", "organization"),
)
