from __future__ import annotations

import json
import logging
import os
import re
from typing import Dict, List, Sequence, Set, Tuple

logger = logging.getLogger(__name__)

from langchain_openai import ChatOpenAI

from app.agents.relevancy.prompts import build_relevancy_prompt
from app.agents.relevancy.schemas import LLMRelevanceDecision
from app.agents.relevancy.state import RelevancyAgentState
from app.agents.relevancy.utils import clamp_float as _clamp_float
from app.agents.relevancy.utils import dedupe_limited as _dedupe_limited
from app.agents.relevancy.utils import safe_list as _safe_list

MAX_ENTITIES = 5
MAX_CLEAN_EXCERPT = 900
B2B_KEYWORDS: Tuple[str, ...] = (
    "wholesale",
    "manufacturer",
    "distributor",
    "b2b",
    "moq",
    "trade",
    "bulk",
    "oem",
    "private label",
    "export",
    "factory",
)
ECOMMERCE_PLATFORMS = {"shopify", "woocommerce"}
HOMEPAGE_RETAIL_MARKERS: Tuple[str, ...] = (
    "add to bag",
    "add to basket",
    "shopping bag",
    "view bag",
    "checkout",
    "my bag",
    "product-grid",
    "/products/",
    "/collections/",
    "shop now",
    "shop all",
)
WEAK_STOREFRONT_MARKERS: Tuple[str, ...] = (
    "add to cart",
    "checkout",
    "shop now",
    "new arrivals",
    "wishlist",
    "size guide",
    "shipping",
    "returns",
)
HOMEPAGE_RETAIL_NAV_MARKERS: Tuple[str, ...] = ("/shop", "/products", "/collections")
B2B_RETAILER_TARGETING_MARKERS: Tuple[str, ...] = (
    "wholesaler",
    "distributor",
    "retailer",
    "retailers",
    "boutique",
    "boutiques",
    "department store",
)


def _exporter_targets_retailers(state: RelevancyAgentState) -> bool:
    exporter_profile = str(state.get("exporter_profile") or "").lower()
    if not exporter_profile:
        return False
    return any(marker in exporter_profile for marker in B2B_RETAILER_TARGETING_MARKERS)


def _to_db_decision_fields(decision: LLMRelevanceDecision) -> Dict[str, object]:
    return {
        "relevance_decision": decision.relevance_decision,
        "relevance_score": int(decision.relevance_score),
        "relevance_reason": decision.relevance_reason,
        "business_type": decision.business_type,
        "primary_niche": decision.primary_niche,
    }


def _one_line(value: str) -> str:
    return " ".join(str(value or "").split()).strip()




def _available_signal_tags(state: RelevancyAgentState) -> List[str]:
    structured = state.get("structured_signals_output") or {}
    clean = state.get("clean_text_output") or {}
    catalog = state.get("catalog_intelligence_output") or {}
    platform = state.get("platform_detection_output") or {}
    shopify = state.get("shopify_probe_output") or {}
    business_model = state.get("business_model_intelligence_output") or {}
    tags: Set[str] = set()

    structured_used = structured.get("structured_signals_used") or state.get("structured_signals_used") or []
    flag_aliases = {
        "jsonld_products": "jsonld_product",
        "jsonld_catalog": "jsonld_catalog",
        "jsonld_org": "jsonld_org",
    }
    signal_flags = _safe_list(structured.get("signal_flags"))
    for raw in signal_flags:
        mapped = flag_aliases.get(raw)
        if mapped:
            tags.add(mapped)
    for signal in structured_used:
        text = str(signal).strip()
        if text in {"jsonld_org", "jsonld_product", "jsonld_catalog", "meta_generator", "opengraph"}:
            tags.add(text)

    if structured.get("structured_has_product_catalog") is True:
        tags.add("jsonld_catalog")

    state_signals = _safe_list(state.get("signals_used"))
    for signal in state_signals:
        if signal == "blocked_status":
            tags.add("blocked_status")

    if clean.get("text_excerpt"):
        tags.add("clean_text_excerpt")
    if catalog.get("has_catalog") is True:
        tags.add("catalog_present")
    catalog_mode = str(catalog.get("catalog_mode") or "").strip().lower()
    if catalog_mode in {"storefront", "marketplace", "directory", "brand_catalog"}:
        tags.add(f"catalog_mode.{catalog_mode}")
    if catalog.get("marketplace_like") is True:
        tags.add("catalog.marketplace")
    if catalog.get("directory_like") is True:
        tags.add("catalog.directory")
    listing_density = str(catalog.get("listing_density") or "").strip().lower()
    if listing_density in {"medium", "high"}:
        tags.add(f"catalog_density.{listing_density}")
    if platform.get("platform") and platform.get("platform") != "unknown":
        tags.add("platform_detect")
    if shopify.get("performed") is True and (shopify.get("detected") is True or bool(shopify.get("signals"))):
        tags.add("shopify_catalog")
    if state.get("collect_blocked") is True or (state.get("collect_sources_output") or {}).get("blocked") is True:
        tags.add("blocked_status")
    if business_model.get("primary_model") in {
        "retailer",
        "wholesaler",
        "manufacturer",
        "distributor",
        "brand",
        "marketplace",
        "service_business",
    }:
        tags.add("business_model_intel")
    if business_model.get("customer_model"):
        tags.add(f"business_model_customer.{str(business_model.get('customer_model')).lower()}")
    return _dedupe_limited(sorted(tags), limit=12)


def _compact_entities(structured: Dict[str, object]) -> List[Dict[str, object]]:
    entities = (structured.get("entities") or [])[:MAX_ENTITIES]
    compact_entities = []
    for item in entities:
        if not isinstance(item, dict):
            continue
        compact_entities.append(
            {
                "source": item.get("source"),
                "type_hint": item.get("type_hint"),
                "name": item.get("name"),
                "url": item.get("url"),
                "keys": (item.get("keys") or [])[:6],
            }
        )
    return compact_entities


def _compact_signals(state: RelevancyAgentState) -> Dict[str, object]:
    structured = state.get("structured_signals_output") or {}
    clean = state.get("clean_text_output") or {}
    catalog = state.get("catalog_intelligence_output") or {}
    platform = state.get("platform_detection_output") or {}
    shopify = state.get("shopify_probe_output") or {}
    text_excerpt = (clean.get("text_excerpt") or "")[:MAX_CLEAN_EXCERPT]

    return {
        "business": {
            "name": state.get("business_name"),
            "website": state.get("website"),
            "category": state.get("category"),
            "description": (state.get("description") or "")[:200],
        },
        "collection": {
            "status_code": state.get("collect_status_code"),
            "needs_browser": bool(state.get("collect_needs_browser")),
            "blocked": bool(state.get("collect_blocked")),
        },
        "structured": {
            "quality": structured.get("quality"),
            "strong_signal": bool(structured.get("strong_signal")),
            "structured_signal_strength": structured.get("structured_signal_strength"),
            "structured_has_product_catalog": bool(structured.get("structured_has_product_catalog")),
            "structured_has_organization": bool(structured.get("structured_has_organization")),
            "structured_signals_used": (structured.get("structured_signals_used") or [])[:8],
            "counts": structured.get("counts") or {},
            "signal_flags": (structured.get("signal_flags") or [])[:5],
            "top_entities": _compact_entities(structured),
        },
        "catalog": {
            "has_catalog": bool(catalog.get("has_catalog")),
            "catalog_confidence": _clamp_float(catalog.get("catalog_confidence")),
            "catalog_breadth": catalog.get("catalog_breadth"),
            "catalog_mode": catalog.get("catalog_mode"),
            "marketplace_like": bool(catalog.get("marketplace_like")),
            "directory_like": bool(catalog.get("directory_like")),
            "listing_density": catalog.get("listing_density"),
            "marketplace_signals": (catalog.get("marketplace_signals") or [])[:4],
        },
        "business_model": {
            "primary_model": (state.get("business_model_intelligence_output") or {}).get("primary_model"),
            "customer_model": (state.get("business_model_intelligence_output") or {}).get("customer_model"),
            "fulfillment_model": (state.get("business_model_intelligence_output") or {}).get("fulfillment_model"),
            "catalog_present": bool(
                (state.get("business_model_intelligence_output") or {}).get("catalog_present")
            ),
            "service_heavy": bool((state.get("business_model_intelligence_output") or {}).get("service_heavy")),
            "confidence": _clamp_float((state.get("business_model_intelligence_output") or {}).get("confidence")),
        },
        "clean_text": {
            "used": bool(text_excerpt),
            "text_excerpt": text_excerpt,
        },
        "platform": {
            "platform": platform.get("platform"),
            "confidence": platform.get("confidence"),
            "shopify_detected": bool(platform.get("shopify_detected")),
            "reasons": (platform.get("reasons") or [])[:4],
        },
        "shopify_probe": {
            "performed": bool(shopify.get("performed")),
            "detected": bool(shopify.get("detected")),
            "confidence": shopify.get("confidence"),
            "signals": (shopify.get("signals") or [])[:4],
        },
        "available_signal_labels": _available_signal_tags(state),
    }


def _confidence_to_score(decision: str, confidence: float) -> int:
    if decision == "relevant":
        return int(round(_clamp_float(confidence) * 100))
    if decision == "irrelevant":
        return int(round((1.0 - _clamp_float(confidence)) * 100))
    return 0


def _build_decision(
    relevance_decision: str,
    manual_review: bool,
    confidence: float,
    relevance_reason: str,
    match_reasons: Sequence[str],
    mismatch_reasons: Sequence[str],
    signals_used: Sequence[str],
    business_type: str = "Unknown",
    primary_niche: str = "Unknown",
) -> LLMRelevanceDecision:
    decision = str(relevance_decision).strip().lower()
    if decision not in {"relevant", "irrelevant", "unknown"}:
        decision = "unknown"

    payload = {
        "relevance_decision": decision,
        "manual_review": bool(manual_review) or decision == "unknown",
        "confidence": _clamp_float(confidence),
        "match_reasons": _dedupe_limited(match_reasons, limit=8),
        "mismatch_reasons": _dedupe_limited(mismatch_reasons, limit=8),
        "signals_used": _dedupe_limited(signals_used, limit=12),
        "relevance_score": _confidence_to_score(decision, _clamp_float(confidence)),
        "relevance_reason": _one_line(relevance_reason) or "Insufficient evidence to classify.",
        "business_type": _one_line(business_type) or "Unknown",
        "primary_niche": _one_line(primary_niche) or "Unknown",
    }
    return LLMRelevanceDecision.model_validate(payload)


def _contains_jsonld_product_or_offer(structured: Dict[str, object]) -> bool:
    used = set(_safe_list(structured.get("structured_signals_used")))
    if "jsonld_product" in used:
        return True

    flags = set(_safe_list(structured.get("signal_flags")))
    if "jsonld_products" in flags:
        return True

    entities = structured.get("top_entities") or []
    for entity in entities:
        if not isinstance(entity, dict):
            continue
        if str(entity.get("source") or "").strip().lower() != "json-ld":
            continue
        type_hint = str(entity.get("type_hint") or "").lower()
        if "product" in type_hint or "offer" in type_hint:
            return True
    return False


def _b2b_term_hits(text: str) -> List[str]:
    normalized = str(text or "").lower()
    hits: List[str] = []
    for keyword in B2B_KEYWORDS:
        if " " in keyword:
            # Multi-word phrase: allow flexible whitespace (spaces, tabs,
            # newlines) between words so "private  label" still matches.
            parts = [re.escape(word) for word in keyword.split()]
            pattern = r"\b" + r"\s+" .join(parts) + r"\b"
        else:
            pattern = rf"\b{re.escape(keyword)}\b"
        if re.search(pattern, normalized):
            hits.append(keyword)
    return _dedupe_limited(hits, limit=8)


def _decision_signals(base_signals: Sequence[str], required: Sequence[str]) -> List[str]:
    required_list = [tag for tag in required if str(tag).strip()]
    return _dedupe_limited([*required_list, *base_signals], limit=12)


def _is_blocked(state: RelevancyAgentState, signal_tags: Sequence[str]) -> bool:
    if state.get("collect_blocked") is True:
        return True
    collect = state.get("collect_sources_output") or {}
    if collect.get("blocked") is True:
        return True
    return "blocked_status" in {str(tag).strip() for tag in signal_tags}


def _blocked_reason(state: RelevancyAgentState) -> str:
    collect = state.get("collect_sources_output") or {}
    reason = state.get("collect_block_reason") or collect.get("block_reason") or "unknown"
    return _one_line(str(reason))


def _unknown_confidence(signal_tags: Sequence[str], has_clean_text: bool) -> float:
    active = [tag for tag in signal_tags if str(tag).strip() and str(tag).strip() != "blocked_status"]
    if has_clean_text and len(active) >= 2:
        return 0.4
    if has_clean_text or active:
        return 0.32
    return 0.25


def _homepage_retail_evidence(state: RelevancyAgentState) -> List[str]:
    collect = state.get("collect_sources_output") or {}
    homepage = collect.get("homepage") or {}
    html = str(homepage.get("html") or "").lower()
    if not html:
        return []

    evidence: List[str] = []
    if "queue-it.net/javascriptqueue" in html or "queue-it" in html:
        evidence.append("queue_it")

    marker_hits = sum(1 for token in HOMEPAGE_RETAIL_MARKERS if token in html)
    if marker_hits >= 2:
        evidence.append("retail_terms")

    nav_hits = sum(1 for token in HOMEPAGE_RETAIL_NAV_MARKERS if token in html)
    if nav_hits >= 2:
        evidence.append("retail_navigation")

    return evidence


def _business_model_favors_b2b(state: RelevancyAgentState) -> bool:
    model_output = state.get("business_model_intelligence_output") or {}
    primary = str(model_output.get("primary_model") or "").strip().lower()
    customer = str(model_output.get("customer_model") or "").strip().lower()
    confidence = _clamp_float(model_output.get("confidence"), 0.0, 1.0)
    if confidence < 0.55:
        return False
    if customer in {"b2b", "mixed"} and primary in {"wholesaler", "manufacturer", "distributor", "brand", "marketplace"}:
        return True
    if customer == "b2b" and primary == "retailer":
        return False
    return False


def _apply_confidence_policy(decision: LLMRelevanceDecision, policy: str) -> LLMRelevanceDecision:
    payload = decision.model_dump()
    confidence = _clamp_float(payload.get("confidence"))
    relevance_decision = payload.get("relevance_decision")

    if policy == "blocked":
        payload["relevance_decision"] = "unknown"
        payload["manual_review"] = True
        payload["confidence"] = 0.0
    elif relevance_decision == "unknown":
        payload["manual_review"] = True
        payload["confidence"] = _clamp_float(confidence, 0.25, 0.4)
    elif policy == "irrelevant_ecommerce" and relevance_decision == "irrelevant":
        payload["confidence"] = _clamp_float(confidence, 0.6, 0.75)
    elif policy == "relevant_b2b" and relevance_decision == "relevant":
        if payload.get("manual_review") is True:
            payload["confidence"] = _clamp_float(confidence, 0.6, 0.7)
        else:
            payload["confidence"] = _clamp_float(confidence, 0.7, 0.9)
    else:
        payload["confidence"] = _clamp_float(confidence)

    payload["relevance_score"] = _confidence_to_score(
        str(payload.get("relevance_decision") or "unknown"),
        float(payload.get("confidence") or 0.0),
    )
    return LLMRelevanceDecision.model_validate(payload)


def _deterministic_prejudge(state: RelevancyAgentState, signals: Dict[str, object]) -> Tuple[LLMRelevanceDecision, str]:
    signal_tags = _safe_list(signals.get("available_signal_labels"))
    structured = signals.get("structured") or {}
    clean = signals.get("clean_text") or {}
    catalog = signals.get("catalog") or {}
    platform = signals.get("platform") or {}
    shopify = signals.get("shopify_probe") or {}
    business_model = signals.get("business_model") or {}
    business_model_primary = str(business_model.get("primary_model") or "").strip().lower()
    business_model_customer = str(business_model.get("customer_model") or "").strip().lower()
    business_model_conf = _clamp_float(business_model.get("confidence"), 0.0, 1.0)

    if _is_blocked(state, signal_tags):
        block_reason = _blocked_reason(state)
        decision = _build_decision(
            relevance_decision="unknown",
            manual_review=True,
            confidence=0.0,
            relevance_reason=f"Blocked during collection ({block_reason}).",
            match_reasons=[],
            mismatch_reasons=[f"Blocked during collection ({block_reason})."],
            signals_used=_decision_signals(signal_tags, ["blocked_status"]),
        )
        return _apply_confidence_policy(decision, "blocked"), "blocked"

    has_catalog = bool(structured.get("structured_has_product_catalog"))
    has_jsonld_product_offer = _contains_jsonld_product_or_offer(structured)
    catalog_has = bool(catalog.get("has_catalog"))
    catalog_confidence = _clamp_float(catalog.get("catalog_confidence"))
    catalog_mode = str(catalog.get("catalog_mode") or "").strip().lower()
    catalog_marketplace_like = bool(catalog.get("marketplace_like"))
    catalog_directory_like = bool(catalog.get("directory_like"))
    catalog_marketplace_signals = _safe_list(catalog.get("marketplace_signals"))
    platform_name = str(platform.get("platform") or "").strip().lower()
    platform_confidence = _clamp_float(platform.get("confidence"))
    platform_ecommerce = platform_name in ECOMMERCE_PLATFORMS
    shopify_probe_detected = bool(shopify.get("performed") is True and shopify.get("detected") is True)
    homepage_retail_evidence = _homepage_retail_evidence(state)
    marketplace_context_score = 0
    if catalog_has and catalog_mode in {"marketplace", "directory"}:
        marketplace_context_score += 2
    if catalog_marketplace_like:
        marketplace_context_score += 1
    if catalog_directory_like:
        marketplace_context_score += 1
    if catalog_marketplace_signals:
        marketplace_context_score += min(2, max(1, len(catalog_marketplace_signals) // 2))
    if catalog_confidence >= 0.65:
        marketplace_context_score += 1
    if business_model_primary == "marketplace" and business_model_conf >= 0.58:
        marketplace_context_score += 2
    if business_model_customer in {"b2b", "mixed"}:
        marketplace_context_score += 1
    if _business_model_favors_b2b(state):
        marketplace_context_score += 1
    marketplace_b2b_context = marketplace_context_score >= 4

    # Issue 1: Fast-track strict B2C retailer/storefront cases to irrelevant
    targets_retailers = _exporter_targets_retailers(state)
    if not targets_retailers and catalog_has and catalog_mode in {"storefront", "brand_catalog", "unknown"} and business_model_primary in {"retailer", "brand"} and business_model_customer == "b2c" and business_model_conf >= 0.62:
        decision = _build_decision(
            relevance_decision="irrelevant",
            manual_review=False,
            confidence=0.92,
            relevance_reason="B2C retailer / DTC storefront mismatch with exporter profile.",
            match_reasons=[],
            mismatch_reasons=["Business model intelligence strongly indicates a B2C retailer.","Direct-to-consumer storefront catalog detected."],
            signals_used=_decision_signals(signal_tags, ["catalog_present", f"catalog_mode.{catalog_mode}", "business_model_intel", "business_model_customer.b2c"]),
            business_type="B2C Retailer / Brand",
        )
        return _apply_confidence_policy(decision, "irrelevant_ecommerce"), "irrelevant_ecommerce"

    # Phase 2B: Stronger Weak-Storefront Rejection
    # Condition: customer_model is b2c AND text evidence has store keywords AND NO strong B2B terms
    clean_text_blob = str(clean.get("text_excerpt") or "").lower()
    weak_storefront_hits = sum(1 for token in WEAK_STOREFRONT_MARKERS if token in clean_text_blob)
    b2b_text_hits = _b2b_term_hits(clean_text_blob)
    
    if not targets_retailers and business_model_customer == "b2c" and weak_storefront_hits >= 2 and not b2b_text_hits:
        decision = _build_decision(
            relevance_decision="irrelevant",
            manual_review=False,
            confidence=0.88,
            relevance_reason="Weak B2C storefront detected via text markers; lacking B2B signals.",
            match_reasons=[],
            mismatch_reasons=[
                "Customer model identified as B2C.",
                "Storefront phrasing detected (e.g., checkout, cart) without B2B wholesale terms."
            ],
            signals_used=_decision_signals(signal_tags, ["clean_text_excerpt", "business_model_customer.b2c"]),
            business_type="B2C Storefront",
        )
        return _apply_confidence_policy(decision, "irrelevant_ecommerce"), "irrelevant_ecommerce"

    ecommerce_signal_score = 0
    ecommerce_mismatch: List[str] = ["Ecommerce retailer / DTC store signals detected."]
    ecommerce_signals: List[str] = []
    if has_catalog:
        ecommerce_signal_score += 2
        ecommerce_mismatch.append("Structured product catalog markers detected.")
        ecommerce_signals.append("jsonld_catalog")
    if catalog_has and catalog_mode in {"storefront", "brand_catalog"}:
        ecommerce_signal_score += 2
        ecommerce_mismatch.append(f"Catalog intelligence identifies the site as {catalog_mode}.")
        ecommerce_signals.append(f"catalog_mode.{catalog_mode}")
    if has_jsonld_product_offer:
        ecommerce_signal_score += 2
        ecommerce_mismatch.append("JSON-LD product/offer entities detected.")
        ecommerce_signals.append("jsonld_product")
    if platform_ecommerce:
        ecommerce_signal_score += 2 if platform_confidence >= 0.8 else 1
        ecommerce_mismatch.append(f"Platform detection indicates {platform_name}.")
        ecommerce_signals.append("platform_detect")
    if shopify_probe_detected:
        ecommerce_signal_score += 1
        ecommerce_mismatch.append("Shopify catalog probe succeeded.")
        ecommerce_signals.append("shopify_catalog")
    if homepage_retail_evidence:
        ecommerce_signal_score += 2 if len(homepage_retail_evidence) >= 2 else 1
        ecommerce_mismatch.append("Homepage markup contains consumer-retail storefront markers.")
        if "clean_text_excerpt" in signal_tags:
            ecommerce_signals.append("clean_text_excerpt")
        if "platform_detect" in signal_tags:
            ecommerce_signals.append("platform_detect")

    if not targets_retailers and ecommerce_signal_score > 0 and not marketplace_b2b_context and not (
        business_model_conf >= 0.62
        and business_model_customer in {"b2b", "mixed"}
        and business_model_primary in {"wholesaler", "manufacturer", "distributor", "brand"}
    ):
        if ecommerce_signal_score >= 5:
            confidence = 0.75
        elif ecommerce_signal_score >= 3:
            confidence = 0.68
        elif ecommerce_signal_score >= 2 and business_model_primary in {"retailer", "brand"} and business_model_customer == "b2c":
            confidence = 0.66
        else:
            confidence = 0.6
        decision = _build_decision(
            relevance_decision="irrelevant",
            manual_review=False,
            confidence=confidence,
            relevance_reason="Ecommerce retailer / DTC store signals dominate.",
            match_reasons=[],
            mismatch_reasons=ecommerce_mismatch,
            signals_used=_decision_signals(signal_tags, ecommerce_signals),
            business_type="Retailer / DTC",
        )
        return _apply_confidence_policy(decision, "irrelevant_ecommerce"), "irrelevant_ecommerce"

    if marketplace_b2b_context:
        if marketplace_context_score >= 7:
            confidence = 0.84
        elif marketplace_context_score >= 5:
            confidence = 0.76
        else:
            confidence = 0.68

        match_reasons: List[str] = []
        if catalog_mode in {"marketplace", "directory"}:
            match_reasons.append(f"Catalog intelligence classifies the site as {catalog_mode}.")
        if catalog_marketplace_signals:
            match_reasons.append(
                f"Marketplace signals detected: {', '.join(catalog_marketplace_signals[:4])}."
            )
        if business_model_primary == "marketplace" and business_model_conf >= 0.58:
            match_reasons.append("Business-model intelligence favors a B2B marketplace.")

        decision = _build_decision(
            relevance_decision="relevant",
            manual_review=marketplace_context_score < 6,
            confidence=confidence,
            relevance_reason="B2B marketplace / supplier directory signals detected.",
            match_reasons=match_reasons,
            mismatch_reasons=[],
            signals_used=_decision_signals(
                signal_tags,
                [
                    "catalog_present",
                    f"catalog_mode.{catalog_mode}" if catalog_mode else "",
                    "catalog.marketplace" if catalog_marketplace_like else "",
                    "catalog.directory" if catalog_directory_like else "",
                    "business_model_intel",
                ],
            ),
            business_type="B2B marketplace" if catalog_mode == "marketplace" else "Supplier directory",
        )
        return _apply_confidence_policy(decision, "relevant_b2b"), "relevant_b2b_marketplace"

    clean_excerpt = str(clean.get("text_excerpt") or "")
    structured_tokens: List[str] = []
    for item in structured.get("top_entities") or []:
        if not isinstance(item, dict):
            continue
        structured_tokens.append(str(item.get("type_hint") or ""))
        structured_tokens.append(str(item.get("name") or ""))
        structured_tokens.extend(str(key) for key in (item.get("keys") or []))
    bm_wholesale = bool(
        business_model_primary in {"wholesaler", "manufacturer", "distributor"}
        and business_model_conf >= 0.6
    )
    bm_service = business_model_primary == "service_business" and business_model_conf >= 0.6
    business_text = " ".join(
        [
            str((signals.get("business") or {}).get("category") or ""),
            str((signals.get("business") or {}).get("description") or ""),
        ]
    )
    b2b_corpus = " ".join([clean_excerpt, " ".join(structured_tokens), business_text])
    b2b_hits = _b2b_term_hits(b2b_corpus)
    has_org_schema = bool(structured.get("structured_has_organization"))
    b2b_signal_score = len(b2b_hits) + (1 if has_org_schema else 0)
    if bm_wholesale:
        b2b_signal_score += 2
    if bm_service:
        b2b_signal_score = max(0, b2b_signal_score - 1)

    if b2b_signal_score >= 2:
        if b2b_signal_score >= 5:
            confidence = 0.85
        elif b2b_signal_score >= 4:
            confidence = 0.78
        elif b2b_signal_score >= 3:
            confidence = 0.72
        else:
            confidence = 0.65

        weak_evidence = b2b_signal_score <= 2
        match_reasons: List[str] = []
        if b2b_hits:
            preview = ", ".join(b2b_hits[:4])
            match_reasons.append(f"B2B terminology detected: {preview}.")
        if has_org_schema:
            match_reasons.append("Organization schema metadata is present.")
        if weak_evidence:
            match_reasons.append("B2B evidence is limited and may need confirmation.")

        signal_labels: List[str] = []
        if clean_excerpt:
            signal_labels.append("clean_text_excerpt")
        if has_org_schema:
            signal_labels.append("jsonld_org")

        decision = _build_decision(
            relevance_decision="relevant",
            manual_review=weak_evidence,
            confidence=confidence,
            relevance_reason="B2B wholesale/manufacturing signals detected.",
            match_reasons=match_reasons,
            mismatch_reasons=[],
            signals_used=_decision_signals(signal_tags, signal_labels),
            business_type="B2B supplier",
        )
        return _apply_confidence_policy(decision, "relevant_b2b"), "relevant_b2b"

    unknown_confidence = _unknown_confidence(signal_tags, has_clean_text=bool(clean_excerpt.strip()))
    unknown = _build_decision(
        relevance_decision="unknown",
        manual_review=True,
        confidence=unknown_confidence,
        relevance_reason="Insufficient evidence to classify.",
        match_reasons=[],
        mismatch_reasons=["Insufficient evidence to classify."],
        signals_used=signal_tags,
    )
    return _apply_confidence_policy(unknown, "unknown"), "unknown"


def _llm_available() -> bool:
    return bool(str(os.getenv("OPENAI_API_KEY") or "").strip())


def _should_call_llm_refiner(
    pre_decision: LLMRelevanceDecision,
    state: RelevancyAgentState,
) -> bool:
    if _is_blocked(state, pre_decision.signals_used):
        return False
    if not _llm_available():
        return False
    return pre_decision.relevance_decision == "unknown" or float(pre_decision.confidence) < 0.65


def _filter_signals_for_contract(candidates: Sequence[str], allowed: Sequence[str]) -> List[str]:
    allowed_set = {str(item).strip() for item in allowed if str(item).strip()}
    if not allowed_set:
        return _dedupe_limited(candidates, limit=12)
    return _dedupe_limited((tag for tag in candidates if str(tag).strip() in allowed_set), limit=12)


def _merge_llm_refinement(
    base: LLMRelevanceDecision,
    llm_decision: LLMRelevanceDecision,
    available_signal_tags: Sequence[str],
    policy: str,
) -> LLMRelevanceDecision:
    payload = base.model_dump()
    candidate = llm_decision.model_dump()

    if payload.get("relevance_decision") == "unknown":
        payload["relevance_decision"] = candidate.get("relevance_decision")
        payload["manual_review"] = bool(candidate.get("manual_review"))
        payload["confidence"] = _clamp_float(candidate.get("confidence"))
        if candidate.get("relevance_reason"):
            payload["relevance_reason"] = _one_line(str(candidate.get("relevance_reason")))
        if candidate.get("match_reasons"):
            payload["match_reasons"] = _dedupe_limited(candidate.get("match_reasons") or [], limit=8)
        if candidate.get("mismatch_reasons"):
            payload["mismatch_reasons"] = _dedupe_limited(candidate.get("mismatch_reasons") or [], limit=8)
    elif candidate.get("relevance_decision") == payload.get("relevance_decision"):
        payload["confidence"] = _clamp_float(
            max(float(payload.get("confidence") or 0.0), float(candidate.get("confidence") or 0.0))
        )
        if candidate.get("relevance_reason"):
            payload["relevance_reason"] = _one_line(str(candidate.get("relevance_reason")))
        if candidate.get("match_reasons"):
            payload["match_reasons"] = _dedupe_limited(candidate.get("match_reasons") or [], limit=8)
        if candidate.get("mismatch_reasons"):
            payload["mismatch_reasons"] = _dedupe_limited(candidate.get("mismatch_reasons") or [], limit=8)

    combined_signals = _dedupe_limited(
        [
            *(_safe_list(payload.get("signals_used"))),
            *(_safe_list(candidate.get("signals_used"))),
            *(_safe_list(available_signal_tags)),
        ],
        limit=12,
    )
    payload["signals_used"] = _filter_signals_for_contract(combined_signals, available_signal_tags)
    if payload.get("relevance_decision") == "unknown":
        payload["manual_review"] = True
    payload["confidence"] = _clamp_float(payload.get("confidence"))
    payload["relevance_score"] = _confidence_to_score(
        str(payload.get("relevance_decision") or "unknown"),
        float(payload.get("confidence") or 0.0),
    )
    merged = LLMRelevanceDecision.model_validate(payload)
    return _apply_confidence_policy(merged, policy)


def _strict_contract_payload(decision: LLMRelevanceDecision) -> Dict[str, object]:
    data = decision.model_dump()
    return {
        "relevance_decision": data["relevance_decision"],
        "manual_review": bool(data["manual_review"]),
        "confidence": float(data["confidence"]),
        "relevance_reason": str(data["relevance_reason"]),
        "match_reasons": list(data.get("match_reasons") or []),
        "mismatch_reasons": list(data.get("mismatch_reasons") or []),
        "signals_used": list(data.get("signals_used") or []),
    }


def _decision_to_state_update(decision: LLMRelevanceDecision) -> Dict[str, object]:
    data = decision.model_dump()
    strict = _strict_contract_payload(decision)
    db_fields = _to_db_decision_fields(decision)
    llm_output = {
        **strict,
        "relevance_score": data.get("relevance_score"),
        "business_type": data.get("business_type"),
        "primary_niche": data.get("primary_niche"),
    }
    return {
        "llm_decision_output": llm_output,
        **db_fields,
        "relevance_decision": strict["relevance_decision"],
        "manual_review": strict["manual_review"],
        "confidence": strict["confidence"],
        "relevance_reason": strict["relevance_reason"],
        "match_reasons": strict["match_reasons"],
        "mismatch_reasons": strict["mismatch_reasons"],
        "signals_used": strict["signals_used"],
        "is_finalized": True,
    }


def llm_relevance_judge(state: RelevancyAgentState) -> Dict[str, object]:
    typed_signal_tags: List[str] = []
    try:
        signals = _compact_signals(state)
        signal_tags = signals.get("available_signal_labels") or []
        if not isinstance(signal_tags, list):
            signal_tags = []
        typed_signal_tags = [str(item).strip() for item in signal_tags if str(item).strip()]

        pre_decision, policy = _deterministic_prejudge(state, signals)
        decision = pre_decision

        if _should_call_llm_refiner(pre_decision, state):
            llm_signals = dict(signals)
            if pre_decision.relevance_decision != "unknown":
                llm_signals["pre_judge"] = {
                    "relevance_decision": pre_decision.relevance_decision,
                    "manual_review": pre_decision.manual_review,
                    "confidence": pre_decision.confidence,
                    "relevance_reason": pre_decision.relevance_reason,
                    "match_reasons": pre_decision.match_reasons,
                    "mismatch_reasons": pre_decision.mismatch_reasons,
                    "signals_used": pre_decision.signals_used,
                }
            prompt = build_relevancy_prompt(state.get("exporter_profile") or "", llm_signals)
            llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0,
                model_kwargs={"response_format": {"type": "json_object"}},
            )
            try:
                response = llm.invoke(
                    [
                        ("system", "Return strict JSON only. No markdown."),
                        ("user", prompt),
                    ]
                )
                content = response.content if isinstance(response.content, str) else str(response.content)
                payload = json.loads(content)
                parsed = LLMRelevanceDecision.model_validate(payload)
                decision = _merge_llm_refinement(pre_decision, parsed, typed_signal_tags, policy)
            except Exception as e:
                _raw = locals().get("content", "<not captured>")
                logger.warning(
                    "LLM refinement failed — falling back to pre-judge. error=%s raw=%.200s",
                    e,
                    _raw if isinstance(_raw, str) else repr(_raw),
                )
                decision = pre_decision
    except Exception as exc:
        blocked = state.get("collect_blocked") is True
        fallback_signals = typed_signal_tags or _available_signal_tags(state)
        if blocked:
            reason = f"Blocked during collection ({_blocked_reason(state)})."
            decision = _build_decision(
                relevance_decision="unknown",
                manual_review=True,
                confidence=0.0,
                relevance_reason=reason,
                match_reasons=[],
                mismatch_reasons=[reason],
                signals_used=_decision_signals(fallback_signals, ["blocked_status"]),
            )
            decision = _apply_confidence_policy(decision, "blocked")
        else:
            reason = f"Insufficient evidence to classify ({type(exc).__name__})."
            decision = _build_decision(
                relevance_decision="unknown",
                manual_review=True,
                confidence=0.25,
                relevance_reason=reason,
                match_reasons=[],
                mismatch_reasons=[reason],
                signals_used=fallback_signals,
            )
            decision = _apply_confidence_policy(decision, "unknown")
    strict_payload = _strict_contract_payload(decision)
    strict_payload["signals_used"] = _filter_signals_for_contract(
        strict_payload.get("signals_used") or [],
        typed_signal_tags or _available_signal_tags(state),
    )
    decision = LLMRelevanceDecision.model_validate({**decision.model_dump(), **strict_payload})
    decision = _apply_reason_code(decision, state)
    return _decision_to_state_update(decision)


def _apply_reason_code(decision: LLMRelevanceDecision, state: RelevancyAgentState) -> LLMRelevanceDecision:
    """Prefix relevance_reason with a standardised bracketed reason code."""
    reason = decision.relevance_reason or ""
    # Skip if already prefixed
    if reason.startswith("["):
        return decision

    rel = (decision.relevance_decision or "").lower()
    block_reason = str(state.get("collect_block_reason") or "").lower()
    catalog_out = state.get("catalog_intelligence_output") or {}
    bmi_out = state.get("business_model_intelligence_output") or {}
    node_failed = (
        catalog_out.get("node_status") == "failed"
        or bmi_out.get("node_status") == "failed"
    )

    if node_failed:
        code = "[INTERNAL_ERROR]"
    elif state.get("is_social_profile"):
        code = "[SOCIAL_PROFILE_REJECTION]"
    elif state.get("is_marketplace"):
        code = "[MARKETPLACE_REJECTION]"
    elif state.get("collect_blocked"):
        if "cloudflare" in block_reason or "turnstile" in block_reason:
            code = "[CLOUDFLARE_BLOCKED]"
        else:
            code = "[ACCESS_DENIED]"
    elif rel == "relevant":
        # Distinguish B2B supplier from retail buyer match
        bmi_customer = str((bmi_out.get("customer_model") or "")).lower()
        if bmi_customer == "b2b":
            code = "[B2B_SUPPLIER_MATCH]"
        else:
            code = "[RETAIL_BUYER_MATCH]"
    elif rel == "irrelevant":
        signals = decision.signals_used or []
        if any("storefront" in s or "b2c" in s or "retail" in s for s in signals):
            code = "[STOREFRONT_REJECTION]"
        else:
            code = "[INSUFFICIENT_EVIDENCE]"
    else:
        code = "[INSUFFICIENT_EVIDENCE]"

    updated = decision.model_dump()
    updated["relevance_reason"] = f"{code} {reason}"
    return LLMRelevanceDecision.model_validate(updated)
