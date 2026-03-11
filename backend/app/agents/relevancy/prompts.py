from __future__ import annotations

import json
from typing import Dict


def build_relevancy_prompt(exporter_profile: str, signals: Dict[str, object]) -> str:
    compact_signals = json.dumps(signals, ensure_ascii=True, separators=(",", ":"))
    return (
        "You are a strict B2B lead relevancy refiner.\n"
        "Use only provided compact signals. Never invent facts.\n"
        "A deterministic pre_judge may already exist in signals. Treat it as baseline and refine only when evidence is clearer.\n"
        "Never override blocked collection outcomes.\n"
        "If signals are weak/contradictory, return unknown with manual_review=true.\n"
        "CRITICAL MATCHING RULE: If the exporter_profile indicates the user is a wholesaler, manufacturer, "
        "or distributor looking for buyers, then B2C retailers, storefronts, and boutiques are RELEVANT targets. "
        "Do not reject a business just because it sells B2C; evaluate if it is the type of retailer the B2B exporter wants to supply. "
        "If the exporter_profile is a wholesaler/supplier AND the target business is a relevant B2C storefront/boutique in the same industry (e.g., clothing to clothing), "
        "you MUST classify the target as relevant with a high confidence score (> 0.85). Do not default to unknown if you have confirmed the industry and the B2C retail nature of the target.\n"
        "Output JSON only. No markdown, no prose, no extra keys.\n"
        f"Exporter profile:\n{exporter_profile}\n\n"
        "Required JSON keys and types:\n"
        "{\n"
        '  "relevance_decision":"relevant|irrelevant|unknown",\n'
        '  "manual_review":true|false,\n'
        '  "confidence":0.0,\n'
        '  "match_reasons":["..."],\n'
        '  "mismatch_reasons":["..."],\n'
        '  "signals_used":["..."],\n'
        '  "relevance_score":0,\n'
        '  "relevance_reason":"...",\n'
        '  "business_type":"...",\n'
        '  "primary_niche":"..."\n'
        "}\n\n"
        "Rules:\n"
        "1. relevance_score is integer 0-100.\n"
        "2. confidence is float 0-1.\n"
        "3. unknown must set manual_review=true.\n"
        "4. relevance_reason must be concise and evidence-based.\n"
        f"Signals:\n{compact_signals}"
    )
