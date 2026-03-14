from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Sequence, Set, Tuple

logger = logging.getLogger(__name__)

from app.agents.relevancy.schemas import BusinessModelIntelligenceOutput
from app.agents.relevancy.state import RelevancyAgentState

STRUCTURED_PRODUCT_TYPE_TOKENS: Sequence[str] = ("product", "offer")
STRUCTURED_CATALOG_TYPE_TOKENS: Sequence[str] = (
    "itemlist",
    "offercatalog",
    "collectionpage",
    "productgroup",
)
STRUCTURED_ORGANIZATION_TYPE_TOKENS: Sequence[str] = ("organization", "localbusiness", "store")
STRUCTURED_PRODUCT_KEY_TOKENS: Sequence[str] = (
    "sku",
    "mpn",
    "gtin",
    "brand",
    "offers",
    "price",
    "availability",
)
STRUCTURED_CATALOG_KEY_TOKENS: Sequence[str] = (
    "itemlistelement",
    "numberofitems",
    "itemlistorder",
    "offercatalog",
    "hasoffercatalog",
    "category",
    "collections",
    "products",
)
STRUCTURED_ORGANIZATION_KEY_TOKENS: Sequence[str] = (
    "sameas",
    "telephone",
    "address",
    "openinghours",
    "logo",
)

MODEL_SCORE_KEYS: Tuple[str, ...] = (
    "retailer",
    "wholesaler",
    "manufacturer",
    "distributor",
    "brand",
    "marketplace",
    "service_business",
)

B2B_MARKERS: Sequence[str] = (
    "wholesale",
    "distributor",
    "dealer",
    "reseller",
    "trade account",
    "moq",
    "minimum order",
    "private label",
    "oem",
    "bulk order",
    "request quote",
    "quote request",
    "trade program",
    "stockist",
    "commercial supply",
    "trade partner",
    "commercial supply",
)

B2C_MARKERS: Sequence[str] = (
    "add to cart",
    "wishlist",
    "checkout",
    "shopping bag",
    "view cart",
    "shopping cart",
    "sale",
    "size",
    "size chart",
    "color",
    "colour",
    "fashion",
    "product presentation",
    "direct consumer",
    "shop now",
    "direct to consumer",
    "d2c",
)

MANUFACTURER_MARKERS: Sequence[str] = (
    "factory",
    "manufacturing",
    "made by us",
    "production",
    "oem",
    "private label",
    "mill",
    "workshop",
    "made-to-order",
    "our factory",
    "crafted in-house",
    "in-house production",
)

BRAND_MARKERS: Sequence[str] = (
    "our brand",
    "branded collections",
    "editorial",
    "campaign",
    "brand story",
    "our brand",
    "dtc",
    "brand-driven",
    "our collection",
    "own brand",
    "signature line",
)

WHOLESALE_MARKERS: Sequence[str] = (
    "dealer locator",
    "become a stockist",
    "wholesale enquiries",
    "distribution network",
    "trade partners",
    "supply chain",
    "bulk purchasing",
    "bulk purchase",
    "stockist",
    "reseller",
)

MARKETPLACE_MARKERS: Sequence[str] = (
    "multiple sellers",
    "vendor marketplace",
    "marketplace",
    "sell with us",
    "seller onboarding",
    "list your products",
    "seller dashboard",
    "commission",
    "marketplace route",
)

SERVICE_MARKERS: Sequence[str] = (
    "consulting",
    "booking",
    "appointment",
    "design service",
    "installation",
    "quote request",
    "portfolio",
    "case studies",
    "service",
    "book now",
)

STORE_SIGNALS: Sequence[str] = (
    "store locator",
    "find us",
    "our stores",
    "store locations",
    "store hours",
    "opening hours",
    "head office",
    "shop address",
    "branch",
    "locations",
    "stores near",
)

PLATFORM_ECOMMERCE: Set[str] = {"shopify", "woocommerce", "magento"}
MARKUP_ECOMMERCE_MARKERS: Sequence[str] = (
    "/products/",
    "/collections/",
    "cdn.shopify.com",
    "shop.json",
    "products.json",
)

WEAK_CATALOG_THRESHOLD = 2
STRUCTURED_WEIGHT = 1.0
CATALOG_WEIGHT = 1.0
CLEAN_TEXT_WEIGHT = 0.78
PLATFORM_WEIGHT = 0.45
METADATA_WEIGHT = 0.35


def _normalize_ws(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _clip(value: Any, limit: int) -> str:
    text = _normalize_ws(value)
    if not text:
        return ""
    if len(text) <= limit:
        return text
    return f"{text[:limit-3]}..."


def _clamp_float(value: Any, lower: float = 0.0, upper: float = 1.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return lower
    return max(lower, min(upper, parsed))


def _safe_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    output: List[str] = []
    for item in value:
        text = str(item).strip()
        if text:
            output.append(text)
    return output


def _dedupe_limited(items: Iterable[str], limit: int, max_len: int = 90) -> List[str]:
    seen: Set[str] = set()
    output: List[str] = []
    for item in items:
        text = _normalize_ws(item)
        if not text:
            continue
        text = _clip(text, max_len)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(text)
        if len(output) >= limit:
            break
    return output


def _find_markers(text: str, markers: Sequence[str]) -> List[str]:
    lowered = text.lower()
    matches: List[str] = []
    for marker in markers:
        if not marker:
            continue
        if marker in lowered:
            matches.append(marker)
    return matches


def _add_contribution(ledger: Dict[str, float], key: str, delta: float) -> None:
    ledger[key] = float(ledger.get(key, 0.0)) + float(delta)


def _add_signal(signals: List[str], signal: str) -> None:
    if not signal:
        return
    normalized = str(signal).strip()
    if normalized and normalized not in signals:
        signals.append(normalized)


def _add_note(notes: List[str], text: str, limit: int = 6) -> None:
    value = _clip(text, 130)
    if value and value not in notes:
        notes.append(value)
        if len(notes) > limit:
            del notes[limit:]


def _empty_evidence() -> Dict[str, Any]:
    return {
        "ledger": {},
        "signals_used": [],
        "supporting_notes": [],
        "limiting_notes": [],
        "model_scores": {key: 0.0 for key in MODEL_SCORE_KEYS},
        "b2b_signals": [],
        "b2c_signals": [],
        "wholesale_signals": [],
        "manufacturing_signals": [],
        "retail_signals": [],
        "marketplace_signals": [],
        "store_signals": [],
        "service_signals": [],
        "catalog_present": False,
        "service_heavy": False,
    }


def _classify_structured_entity(entity: Dict[str, Any]) -> Dict[str, bool]:
    type_hint = str(entity.get("type_hint") or "").lower()
    keys = {str(key).strip().lower() for key in entity.get("keys", []) if str(key).strip()}

    product_type = any(token in type_hint for token in STRUCTURED_PRODUCT_TYPE_TOKENS)
    catalog_type = any(token in type_hint for token in STRUCTURED_CATALOG_TYPE_TOKENS)
    organization_type = any(token in type_hint for token in STRUCTURED_ORGANIZATION_TYPE_TOKENS)

    product_key = any(token in keys for token in STRUCTURED_PRODUCT_KEY_TOKENS)
    catalog_key = any(token in keys for token in STRUCTURED_CATALOG_KEY_TOKENS)
    organization_key = any(token in keys for token in STRUCTURED_ORGANIZATION_KEY_TOKENS)

    return {
        "product_like": product_type or product_key,
        "catalog_like": catalog_type or catalog_key,
        "organization_like": organization_type or organization_key,
    }


def _add_model_score(
    evidence: Dict[str, Any],
    model: str,
    delta: float,
) -> None:
    evidence["model_scores"][model] = float(evidence["model_scores"].get(model, 0.0)) + float(delta)


def _collect_clean_text_blob(
    clean: Dict[str, Any],
    business_name: str,
    category: Any,
    description: Any,
    website: str,
) -> str:
    sections = clean.get("sections") if isinstance(clean, dict) else {}
    excerpt = str((clean or {}).get("text_excerpt") or "")
    parts: List[str] = []
    if excerpt:
        parts.append(excerpt)
    if isinstance(sections, dict):
        parts.extend(str(text) for text in list(sections.values())[:8] if str(text).strip())
    if business_name:
        parts.append(str(business_name))
    if category:
        parts.append(str(category))
    if description:
        parts.append(str(description))
    if website:
        parts.append(str(website))
    return "\n".join(parts)[:7000]


def _extract_structured_model_evidence(
    structured: Dict[str, Any],
    evidence: Dict[str, Any],
) -> None:
    if not isinstance(structured, dict):
        _add_contribution(evidence["ledger"], "negative.structured_empty", -0.32)
        _add_note(evidence["supporting_notes"], "Structured output missing.")
        _add_signal(evidence["signals_used"], "negative.structured_missing")
        return

    entities = _safe_list(structured.get("signal_flags"))
    entities = structured.get("entities") if isinstance(structured.get("entities"), list) else []
    has_catalog = structured.get("structured_has_product_catalog") is True
    has_org = structured.get("structured_has_organization") is True
    signal_strength = str(structured.get("structured_signal_strength") or "").lower()

    organization_count = 0
    product_count = 0
    catalog_count = 0
    text_blob = []
    for entity in entities[:30]:
        if not isinstance(entity, dict):
            continue
        classification = _classify_structured_entity(entity)
        text_blob.append(str(entity.get("type_hint") or ""))
        text_blob.append(str(entity.get("name") or ""))
        if isinstance(entity.get("keys"), list):
            text_blob.extend(str(item) for item in entity.get("keys", []))
        if classification["product_like"]:
            product_count += 1
        if classification["catalog_like"]:
            catalog_count += 1
        if classification["organization_like"] and not classification["product_like"] and not classification["catalog_like"]:
            organization_count += 1

    blob = _normalize_ws(" ".join(text_blob)).lower()

    if has_catalog:
        _add_contribution(evidence["ledger"], "structured.has_product_catalog", 0.62 * STRUCTURED_WEIGHT)
        _add_model_score(evidence, "retailer", 1.05 * STRUCTURED_WEIGHT)
        _add_signal(evidence["signals_used"], "structured.product_catalog")
        evidence["catalog_present"] = True
    if signal_strength == "strong":
        _add_contribution(evidence["ledger"], "structured.strong_signal", 0.24 * STRUCTURED_WEIGHT)
        _add_model_score(evidence, "retailer", 0.32 * STRUCTURED_WEIGHT)
        _add_signal(evidence["signals_used"], "structured.signal_strength.strong")
        _add_note(evidence["supporting_notes"], "Structured signal strength is strong.")
    elif signal_strength == "weak":
        _add_contribution(evidence["ledger"], "structured.weak_signal", 0.12 * STRUCTURED_WEIGHT)
        _add_model_score(evidence, "retailer", 0.12 * STRUCTURED_WEIGHT)
        _add_signal(evidence["signals_used"], "structured.signal_strength.weak")

    if product_count > 0:
        _add_contribution(evidence["ledger"], "structured.product_entities", min(product_count * 0.06, 0.35))
        _add_model_score(evidence, "retailer", min(product_count * 0.06, 0.32))
        _add_signal(evidence["signals_used"], "structured.entities.product_like")
    if catalog_count > 0:
        _add_contribution(evidence["ledger"], "structured.catalog_entities", min(catalog_count * 0.08, 0.35))
        _add_model_score(evidence, "retailer", min(catalog_count * 0.08, 0.35))
        _add_signal(evidence["signals_used"], "structured.entities.catalog_like")
    if organization_count > 0 and product_count == 0 and catalog_count == 0:
        _add_contribution(evidence["ledger"], "negative.structured_org_only", -0.3 * STRUCTURED_WEIGHT)
        _add_signal(evidence["signals_used"], "negative.structured.org_only")
        _add_note(
            evidence["limiting_notes"],
            "Structured data is organization-only with no product/catalog entities.",
        )

    if not blob:
        if not product_count and not catalog_count:
            _add_contribution(evidence["ledger"], "negative.structured_sparse", -0.16 * STRUCTURED_WEIGHT)
            _add_note(
                evidence["limiting_notes"],
                "No meaningful structured entities to establish business model.",
            )
            _add_signal(evidence["signals_used"], "negative.structured.sparse")

    # Secondary hints from structured names/fields
    evidence["b2b_signals"].extend(_find_markers(blob, B2B_MARKERS))
    evidence["retail_signals"].extend(_find_markers(blob, B2C_MARKERS))
    evidence["retail_signals"].extend(_find_markers(blob, STORE_SIGNALS))
    evidence["wholesale_signals"].extend(_find_markers(blob, WHOLESALE_MARKERS))
    evidence["manufacturing_signals"].extend(_find_markers(blob, MANUFACTURER_MARKERS))
    brand_hits = _find_markers(blob, BRAND_MARKERS)
    evidence["retail_signals"].extend(brand_hits)
    evidence["marketplace_signals"].extend(_find_markers(blob, MARKETPLACE_MARKERS))

    for hit in evidence["b2b_signals"]:
        if hit in {"wholesale", "distributor", "stockist", "trade account", "request quote", "moq"}:
            _add_model_score(evidence, "wholesaler", 0.24 * STRUCTURED_WEIGHT)
            _add_model_score(evidence, "distributor", 0.18 * STRUCTURED_WEIGHT)
    for hit in brand_hits:
        if hit:
            _add_model_score(evidence, "brand", 0.2 * STRUCTURED_WEIGHT)
    for hit in evidence["wholesale_signals"]:
        if hit in {"distributor", "stockist", "wholesale", "trade partner", "trade program"}:
            _add_model_score(evidence, "distributor", 0.28 * STRUCTURED_WEIGHT)
        _add_model_score(evidence, "wholesaler", 0.17 * STRUCTURED_WEIGHT)
    for hit in evidence["manufacturing_signals"]:
        if hit in {"factory", "manufacturing", "made-to-order", "our factory", "crafted in-house", "oem"}:
            _add_model_score(evidence, "manufacturer", 0.35 * STRUCTURED_WEIGHT)
    for hit in evidence["retail_signals"]:
        if hit in {"shopping bag", "add to cart", "checkout", "wishlist", "shop now", "size", "color"}:
            _add_model_score(evidence, "retailer", 0.28 * STRUCTURED_WEIGHT)


def _extract_catalog_model_evidence(
    catalog: Dict[str, Any],
    evidence: Dict[str, Any],
) -> None:
    if not isinstance(catalog, dict):
        _add_contribution(evidence["ledger"], "negative.catalog_missing", -0.08 * CATALOG_WEIGHT)
        _add_signal(evidence["signals_used"], "negative.catalog_missing")
        return

    has_catalog = catalog.get("has_catalog") is True
    catalog_confidence = _clamp_float(catalog.get("catalog_confidence"), 0.0, 1.0)
    catalog_mode = str(catalog.get("catalog_mode") or "").strip().lower()
    listing_density = str(catalog.get("listing_density") or "").strip().lower()
    marketplace_like = catalog.get("marketplace_like") is True
    directory_like = catalog.get("directory_like") is True
    retail_storefront_signals = _safe_list(catalog.get("retail_storefront_signals"))
    marketplace_signals = _safe_list(catalog.get("marketplace_signals"))
    category_signals = _safe_list(catalog.get("category_signals"))
    pricing_signals = _safe_list(catalog.get("pricing_signals"))
    sample_products = _safe_list(catalog.get("sample_products"))

    if catalog_mode in {"marketplace", "directory"} or marketplace_like or directory_like:
        evidence["marketplace_signals"].extend(marketplace_signals)
        evidence["b2b_signals"].extend(marketplace_signals)
        evidence["wholesale_signals"].extend(marketplace_signals)
        evidence["retail_signals"].extend(category_signals[:2])
    else:
        evidence["retail_signals"].extend(category_signals)
        evidence["retail_signals"].extend(retail_storefront_signals)
        evidence["retail_signals"].extend(pricing_signals)
        evidence["b2c_signals"].extend(retail_storefront_signals)

    if has_catalog:
        evidence["catalog_present"] = True
        _add_contribution(evidence["ledger"], "catalog.has_catalog", 0.72 * CATALOG_WEIGHT)
        _add_contribution(evidence["ledger"], "catalog.confidence", catalog_confidence * 0.14)
        if catalog_mode == "marketplace":
            _add_model_score(evidence, "marketplace", 1.20 * CATALOG_WEIGHT)
            _add_model_score(evidence, "wholesaler", 0.18 * CATALOG_WEIGHT)
            _add_model_score(evidence, "distributor", 0.14 * CATALOG_WEIGHT)
            _add_signal(evidence["signals_used"], "catalog.mode.marketplace")
            _add_note(
                evidence["supporting_notes"],
                f"Catalog mode is marketplace with signals: {', '.join(marketplace_signals[:4])}.",
            )
        elif catalog_mode == "directory":
            _add_model_score(evidence, "marketplace", 1.00 * CATALOG_WEIGHT)
            _add_model_score(evidence, "distributor", 0.22 * CATALOG_WEIGHT)
            _add_model_score(evidence, "wholesaler", 0.18 * CATALOG_WEIGHT)
            _add_signal(evidence["signals_used"], "catalog.mode.directory")
            _add_note(
                evidence["supporting_notes"],
                f"Catalog mode is directory with signals: {', '.join(marketplace_signals[:4])}.",
            )
        elif catalog_mode == "brand_catalog":
            _add_model_score(evidence, "brand", 0.98 * CATALOG_WEIGHT)
            _add_model_score(evidence, "retailer", 0.58 * CATALOG_WEIGHT)
            _add_signal(evidence["signals_used"], "catalog.mode.brand_catalog")
        else:
            _add_model_score(evidence, "retailer", 1.05 * CATALOG_WEIGHT)
            _add_signal(evidence["signals_used"], "catalog.mode.storefront")

        if marketplace_like:
            _add_model_score(evidence, "marketplace", 0.30 * CATALOG_WEIGHT)
        if directory_like:
            _add_model_score(evidence, "marketplace", 0.18 * CATALOG_WEIGHT)
            _add_model_score(evidence, "distributor", 0.10 * CATALOG_WEIGHT)
        if listing_density in {"medium", "high"}:
            if catalog_mode in {"marketplace", "directory"}:
                _add_model_score(evidence, "marketplace", 0.18 * CATALOG_WEIGHT)
            elif catalog_mode == "brand_catalog":
                _add_model_score(evidence, "brand", 0.18 * CATALOG_WEIGHT)
            else:
                _add_model_score(evidence, "retailer", 0.25 * CATALOG_WEIGHT)
        if catalog.get("catalog_breadth") in {"medium", "broad"} and catalog_mode not in {"marketplace", "directory"}:
            _add_model_score(evidence, "retailer", 0.18 * CATALOG_WEIGHT)
        _add_signal(evidence["signals_used"], "catalog.has_catalog")
        if retail_storefront_signals:
            _add_note(
                evidence["supporting_notes"],
                f"Catalog shows storefront signals: {', '.join(retail_storefront_signals[:4])}.",
            )
        if sample_products:
            _add_note(evidence["supporting_notes"], f"Catalog sample products detected: {', '.join(sample_products[:3])}.")
    else:
        _add_contribution(evidence["ledger"], "negative.catalog_absent", -0.20 * CATALOG_WEIGHT)
        _add_note(evidence["limiting_notes"], "Catalog intelligence did not find deterministic catalog presence.")
        _add_signal(evidence["signals_used"], "negative.catalog_absent")

    if sample_products:
        if catalog_mode in {"marketplace", "directory"}:
            _add_model_score(evidence, "marketplace", min(len(sample_products) * 0.04, 0.16) * CATALOG_WEIGHT)
        else:
            _add_model_score(evidence, "retailer", min(len(sample_products) * 0.05, 0.2) * CATALOG_WEIGHT)

    if category_signals and catalog_mode not in {"marketplace", "directory"}:
        _add_model_score(evidence, "brand", 0.06 * min(len(category_signals), 4))


def _extract_clean_text_model_evidence(
    clean: Dict[str, Any],
    business_name: str,
    category: Any,
    description: Any,
    website: str,
    evidence: Dict[str, Any],
) -> None:
    if not isinstance(clean, dict):
        _add_contribution(evidence["ledger"], "negative.clean_missing", -0.12 * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "negative.clean_missing")
        return

    text_blob = _collect_clean_text_blob(clean, business_name, category, description, website).lower()
    if not text_blob:
        _add_contribution(evidence["ledger"], "negative.clean_sparse", -0.18 * CLEAN_TEXT_WEIGHT)
        _add_note(evidence["limiting_notes"], "Clean text extraction is too small to infer business model.")
        _add_signal(evidence["signals_used"], "negative.clean_sparse")
        return

    service_hits = _find_markers(text_blob, SERVICE_MARKERS)
    b2c_hits = _find_markers(text_blob, B2C_MARKERS)
    b2b_hits = _find_markers(text_blob, B2B_MARKERS)
    wholesale_hits = _find_markers(text_blob, WHOLESALE_MARKERS)
    manufacturing_hits = _find_markers(text_blob, MANUFACTURER_MARKERS)
    brand_hits = _find_markers(text_blob, BRAND_MARKERS)
    marketplace_hits = _find_markers(text_blob, MARKETPLACE_MARKERS)
    store_hits = _find_markers(text_blob, STORE_SIGNALS)

    evidence["service_signals"].extend(service_hits)
    evidence["b2c_signals"].extend(b2c_hits)
    evidence["b2b_signals"].extend(b2b_hits)
    evidence["wholesale_signals"].extend(wholesale_hits)
    evidence["manufacturing_signals"].extend(manufacturing_hits)
    evidence["retail_signals"].extend(store_hits)
    evidence["marketplace_signals"].extend(marketplace_hits)

    if b2b_hits:
        _add_contribution(evidence["ledger"], "clean.b2b_markers", min(len(b2b_hits) * 0.09, 0.35) * CLEAN_TEXT_WEIGHT)
        _add_model_score(evidence, "wholesaler", min(len(b2b_hits) * 0.12, 0.4) * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.b2b_markers")
    if b2c_hits:
        _add_contribution(evidence["ledger"], "clean.b2c_markers", min(len(b2c_hits) * 0.10, 0.4) * CLEAN_TEXT_WEIGHT)
        _add_model_score(evidence, "retailer", min(len(b2c_hits) * 0.15, 0.45) * CLEAN_TEXT_WEIGHT)
        _add_model_score(evidence, "brand", 0.06 * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.b2c_markers")
    if wholesale_hits:
        _add_contribution(
            evidence["ledger"],
            "clean.wholesale_markers",
            min(len(wholesale_hits) * 0.12, 0.48) * CLEAN_TEXT_WEIGHT,
        )
        _add_model_score(evidence, "distributor", min(len(wholesale_hits) * 0.2, 0.55) * CLEAN_TEXT_WEIGHT)
        _add_model_score(evidence, "wholesaler", min(len(wholesale_hits) * 0.16, 0.45) * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.wholesale_markers")
    if manufacturing_hits:
        _add_contribution(
            evidence["ledger"],
            "clean.manufacturer_markers",
            min(len(manufacturing_hits) * 0.12, 0.44) * CLEAN_TEXT_WEIGHT,
        )
        _add_model_score(evidence, "manufacturer", min(len(manufacturing_hits) * 0.2, 0.56) * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.manufacturer_markers")
    if marketplace_hits:
        _add_contribution(
            evidence["ledger"],
            "clean.marketplace_markers",
            min(len(marketplace_hits) * 0.14, 0.4) * CLEAN_TEXT_WEIGHT,
        )
        _add_model_score(evidence, "marketplace", min(len(marketplace_hits) * 0.2, 0.55) * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.marketplace_markers")
    if store_hits:
        _add_contribution(
            evidence["ledger"],
            "clean.storefront_signals",
            min(len(store_hits) * 0.08, 0.24) * CLEAN_TEXT_WEIGHT,
        )
        _add_model_score(evidence, "retailer", min(len(store_hits) * 0.08, 0.3) * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.storefront_markers")
    if brand_hits:
        _add_contribution(
            evidence["ledger"],
            "clean.brand_markers",
            min(len(brand_hits) * 0.08, 0.25) * CLEAN_TEXT_WEIGHT,
        )
        _add_model_score(evidence, "brand", min(len(brand_hits) * 0.12, 0.4) * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.brand_markers")
    if service_hits:
        _add_contribution(
            evidence["ledger"],
            "clean.service_signals",
            min(len(service_hits) * 0.08, 0.34) * CLEAN_TEXT_WEIGHT,
        )
        _add_model_score(evidence, "service_business", min(len(service_hits) * 0.15, 0.45) * CLEAN_TEXT_WEIGHT)
        _add_signal(evidence["signals_used"], "clean.service_markers")
        if len(service_hits) >= 2 and not (b2c_hits or b2b_hits):
            _add_contribution(evidence["ledger"], "negative.service_dominant", -0.12 * CLEAN_TEXT_WEIGHT)
            _add_note(evidence["supporting_notes"], "Service-heavy language appears without strong catalog evidence.")


def _extract_platform_shopify_evidence(
    platform: Dict[str, Any],
    shopify_probe: Dict[str, Any],
    evidence: Dict[str, Any],
) -> None:
    platform_name = str(platform.get("platform") or "").lower()
    platform_confidence = _clamp_float(platform.get("confidence"), 0.0, 1.0)
    shopify_detected = platform.get("shopify_detected") is True
    shopify_performed = shopify_probe.get("performed") is True
    shopify_confirmed = shopify_probe.get("detected") is True
    shopify_signals = _safe_list(shopify_probe.get("signals"))
    has_shopify_signals = bool(shopify_signals) or shopify_detected

    if platform_name in PLATFORM_ECOMMERCE and platform_confidence >= 0.5:
        _add_contribution(evidence["ledger"], "platform.ecommerce", 0.24 * PLATFORM_WEIGHT)
        _add_model_score(evidence, "retailer", 0.28 * PLATFORM_WEIGHT)
        _add_signal(evidence["signals_used"], f"platform.{platform_name}")

    if has_shopify_signals or shopify_detected:
        _add_contribution(evidence["ledger"], "platform.shopify", 0.16 * PLATFORM_WEIGHT)
        _add_model_score(evidence, "retailer", 0.16 * PLATFORM_WEIGHT)
        _add_signal(evidence["signals_used"], "platform.shopify")
    if shopify_confirmed:
        _add_contribution(evidence["ledger"], "shopify.catalog_endpoint", 0.22 * PLATFORM_WEIGHT)
        _add_model_score(evidence, "retailer", 0.2 * PLATFORM_WEIGHT)
        _add_signal(evidence["signals_used"], "shopify.catalog_endpoint")

    if platform_name not in {"shopify", "woocommerce", "wordpress", "custom"} and not has_shopify_signals:
        _add_contribution(evidence["ledger"], "negative.platform_unknown", -0.04 * PLATFORM_WEIGHT)


def _extract_metadata_evidence(
    business_name: str,
    category: Any,
    description: Any,
    website: str,
    evidence: Dict[str, Any],
) -> None:
    metadata_blob = _normalize_ws(" ".join([str(item) for item in (business_name, category, description, website) if item]))\
        .lower()
    if not metadata_blob:
        _add_contribution(evidence["ledger"], "negative.metadata_empty", -0.10 * METADATA_WEIGHT)
        _add_signal(evidence["signals_used"], "negative.metadata_missing")
        return

    b2b_hits = _find_markers(metadata_blob, ("wholesale", "manufacturer", "distributor", "supplier", "b2b"))
    b2c_hits = _find_markers(metadata_blob, ("retail", "store", "shop", "fashion", "consumer"))
    service_hits = _find_markers(metadata_blob, ("service", "consulting", "consultancy", "installation"))
    manuf_hits = _find_markers(metadata_blob, ("factory", "manufacturing", "craft", "production"))
    brand_hits = _find_markers(metadata_blob, ("brand", "branded", "collection"))
    marketplace_hits = _find_markers(metadata_blob, ("marketplace", "seller", "vendor"))
    store_hits = _find_markers(metadata_blob, ("store", "stores", "branch", "location", "address"))

    if b2b_hits:
        _add_contribution(evidence["ledger"], "metadata.b2b_text", min(len(b2b_hits) * 0.08, 0.22) * METADATA_WEIGHT)
        _add_model_score(evidence, "wholesaler", min(len(b2b_hits) * 0.12, 0.2) * METADATA_WEIGHT)
        _add_model_score(evidence, "manufacturer", min(len(b2b_hits) * 0.08, 0.16) * METADATA_WEIGHT)
        evidence["b2b_signals"].extend(b2b_hits)
        _add_signal(evidence["signals_used"], "metadata.b2b_language")
    if b2c_hits:
        _add_contribution(evidence["ledger"], "metadata.b2c_text", min(len(b2c_hits) * 0.07, 0.2) * METADATA_WEIGHT)
        _add_model_score(evidence, "retailer", min(len(b2c_hits) * 0.1, 0.2) * METADATA_WEIGHT)
        evidence["b2c_signals"].extend(b2c_hits)
        _add_signal(evidence["signals_used"], "metadata.b2c_language")
    if manuf_hits:
        _add_contribution(
            evidence["ledger"],
            "metadata.manufacturer_text",
            min(len(manuf_hits) * 0.1, 0.22) * METADATA_WEIGHT,
        )
        _add_model_score(evidence, "manufacturer", min(len(manuf_hits) * 0.16, 0.3) * METADATA_WEIGHT)
        evidence["manufacturing_signals"].extend(manuf_hits)
        _add_signal(evidence["signals_used"], "metadata.manufacturer_language")
    if brand_hits:
        _add_contribution(
            evidence["ledger"],
            "metadata.brand_text",
            min(len(brand_hits) * 0.07, 0.2) * METADATA_WEIGHT,
        )
        _add_model_score(evidence, "brand", min(len(brand_hits) * 0.12, 0.2) * METADATA_WEIGHT)
        _add_signal(evidence["signals_used"], "metadata.brand_language")
    if marketplace_hits:
        _add_contribution(
            evidence["ledger"],
            "metadata.marketplace_text",
            min(len(marketplace_hits) * 0.07, 0.2) * METADATA_WEIGHT,
        )
        _add_model_score(evidence, "marketplace", min(len(marketplace_hits) * 0.12, 0.2) * METADATA_WEIGHT)
        evidence["marketplace_signals"].extend(marketplace_hits)
        _add_signal(evidence["signals_used"], "metadata.marketplace_language")
    if store_hits:
        _add_model_score(evidence, "retailer", min(len(store_hits) * 0.06, 0.1) * METADATA_WEIGHT)
        evidence["retail_signals"].extend(store_hits)
        _add_signal(evidence["signals_used"], "metadata.store_language")


def _detect_storefront_ecommerce(
    platform: Dict[str, Any],
    clean_text: str,
    catalog_present: bool,
) -> Tuple[bool, bool]:
    platform_name = str(platform.get("platform") or "").lower()
    platform_hint = platform_name in PLATFORM_ECOMMERCE or platform.get("shopify_detected") is True
    clean_hint = any(marker in clean_text for marker in MARKUP_ECOMMERCE_MARKERS)
    ecommerce = platform_hint or clean_hint
    storefront = "store" in clean_text or "storefront" in clean_text or "cart" in clean_text
    storefront = storefront or catalog_present
    return ecommerce, storefront


def _score_sort_map(model_scores: Dict[str, float]) -> List[Tuple[str, float]]:
    return sorted(model_scores.items(), key=lambda item: (item[1], item[0] in {"service_business", "marketplace"}), reverse=True)


def _build_business_signals(evidence: Dict[str, Any]) -> Dict[str, List[str]]:
    return {
        "b2b_signals": _dedupe_limited(evidence["b2b_signals"], limit=10, max_len=64),
        "b2c_signals": _dedupe_limited(evidence["b2c_signals"], limit=10, max_len=64),
        "wholesale_signals": _dedupe_limited(evidence["wholesale_signals"], limit=10, max_len=64),
        "manufacturing_signals": _dedupe_limited(evidence["manufacturing_signals"], limit=10, max_len=64),
        "retail_signals": _dedupe_limited(evidence["retail_signals"], limit=12, max_len=64),
        "marketplace_signals": _dedupe_limited(evidence["marketplace_signals"], limit=10, max_len=64),
    }


def _derive_customer_model(model_scores: Dict[str, float], signals: Dict[str, List[str]]) -> str:
    b2b = (
        model_scores["wholesaler"]
        + model_scores["manufacturer"]
        + model_scores["distributor"]
        + (model_scores["marketplace"] * 0.9)
    )
    b2b += len(signals["wholesale_signals"]) * 0.18
    b2b += len(signals["marketplace_signals"]) * 0.14
    b2c = model_scores["retailer"] + model_scores["brand"] + len(signals["retail_signals"]) * 0.07
    if b2b >= 1.2 and b2c >= 1.2:
        return "mixed"
    if b2b >= max(0.65, b2c * 1.15):
        return "b2b"
    if b2c >= max(0.65, b2b * 1.15):
        return "b2c"
    if b2b > 0.45 and b2c > 0.45:
        return "mixed"
    return "unknown"


def _derive_fulfillment_model(
    catalog_present: bool,
    store_signals: List[str],
    wholesale_signals: List[str],
    clean_text: str,
) -> str:
    clean = clean_text.lower()
    has_ecommerce = ("add to cart" in clean) or ("checkout" in clean) or ("shop now" in clean) or (catalog_present)
    has_storefront = "store" in clean or "shop" in clean or "location" in clean or bool(store_signals)
    has_wholesale = bool(wholesale_signals) or ("wholesale" in clean) or ("trade" in clean and "account" in clean)

    if has_ecommerce and has_wholesale:
        return "hybrid"
    if has_wholesale:
        return "wholesale"
    if has_ecommerce:
        return "ecommerce"
    if has_storefront:
        return "storefront"
    return "unknown"


def _build_evidence_summary(evidence: Dict[str, Any], signals: Dict[str, List[str]]) -> str:
    notes: List[str] = []
    notes.extend(evidence["supporting_notes"][:2])
    notes.extend(evidence["limiting_notes"][:2])
    catalog_status = "catalog detected" if evidence["catalog_present"] else "catalog not detected"
    if signals["b2b_signals"]:
        notes.append(f"b2b signals: {', '.join(signals['b2b_signals'][:3])}.")
    if signals["b2c_signals"]:
        notes.append(f"b2c signals: {', '.join(signals['b2c_signals'][:3])}.")
    notes.append(f"Model scores: {', '.join(f'{k}:{v:.2f}' for k, v in _score_sort_map(evidence['model_scores'])[:3])}.")
    notes.append(f"Catalog status: {catalog_status}.")
    return _clip(" ".join(notes), 500)


def _build_output(evidence: Dict[str, Any], clean_text: str) -> Dict[str, object]:
    model_scores: Dict[str, float] = evidence["model_scores"]
    ranked_models = _score_sort_map(model_scores)
    top_model, top_score = ranked_models[0]
    second_score = ranked_models[1][1] if len(ranked_models) > 1 else 0.0
    signals = _build_business_signals(evidence)
    service_heavy = len(signals["b2c_signals"]) < 2 and len(evidence["service_signals"]) >= 3
    evidence["service_heavy"] = bool(service_heavy)

    if top_score <= 0.15:
        primary_model = "unknown"
    else:
        strong_markets = {key for key, score in model_scores.items() if score >= max(0.6, second_score + 0.18)}
        if len(strong_markets) > 1 and "marketplace" in strong_markets and "retailer" in strong_markets:
            # Contradiction: catalog-like storefront + active seller model.
            _add_contribution(evidence["ledger"], "negative.marketplace_vs_storefront", -0.15)
        if primary := next((key for key in strong_markets if key == top_model), None):
            primary_model = primary
        else:
            primary_model = top_model

    if primary_model in {"retailer", "brand"} and second_score > 0.72 and second_score + 0.2 > top_score:
        primary_model = "unknown"

    if signals["marketplace_signals"] and model_scores["marketplace"] >= max(0.72, model_scores["retailer"] - 0.12):
        primary_model = "marketplace"
    elif (
        evidence["catalog_present"]
        and not signals["marketplace_signals"]
        and model_scores["brand"] >= max(0.82, model_scores["retailer"] - 0.08)
    ):
        primary_model = "brand"

    secondary_models = [
        model
        for model, score in ranked_models
        if model not in {primary_model, "unknown"} and score >= max(0.25, top_score - 0.28)
    ][:3]

    customer_model = _derive_customer_model(model_scores, signals)

    if service_heavy and primary_model not in {"service_business", "marketplace"}:
        service_heavy = True
    # If service dominates and no clear catalog, mark service model.
    if (
        primary_model == "unknown"
        and service_heavy
        and len(evidence["service_signals"]) >= WEAK_CATALOG_THRESHOLD
        and not evidence["catalog_present"]
    ):
        primary_model = "service_business"

    fulfillment_model = _derive_fulfillment_model(
        catalog_present=evidence["catalog_present"],
        store_signals=signals["retail_signals"],
        wholesale_signals=signals["wholesale_signals"],
        clean_text=clean_text,
    )
    if primary_model in {"manufacturer", "brand", "distributor", "wholesaler"} and customer_model == "unknown":
        # Keep manufacturer/distributor intent explicit if catalog or B2B signals exist.
        if (model_scores["manufacturer"] > 0.45 or model_scores["distributor"] > 0.45 or model_scores["wholesaler"] > 0.45):
            customer_model = "b2b"

    if primary_model == "unknown" and top_score >= 0.45 and customer_model != "unknown":
        # promote to highest score model when evidence is clear but class label is still noisy
        candidate = [m for m in ranked_models if m[0] != "service_business"]
        if candidate:
            primary_model = candidate[0][0]

    positive = sum(value for value in evidence["ledger"].values() if value > 0)
    negative = sum(-value for value in evidence["ledger"].values() if value < 0)
    margin = top_score - second_score
    if primary_model == "unknown":
        margin_boost = 0.0
    else:
        margin_boost = min(margin * 0.12, 0.24)
    raw_confidence = 0.10 + (positive * 0.15) - (negative * 0.20) + min(top_score * 0.14, 0.38) + margin_boost
    if primary_model != "unknown":
        raw_confidence += 0.04
    if evidence["catalog_present"]:
        raw_confidence += 0.06
    if signal_conflict := (len(signals["marketplace_signals"]) > 0 and len(signals["b2c_signals"]) > 3):
        raw_confidence *= 0.82
    if service_heavy and not evidence["catalog_present"]:
        raw_confidence *= 0.88
    confidence = _clamp_float(raw_confidence)
    if confidence < 0.08 and primary_model != "unknown":
        confidence = 0.08

    if primary_model not in {"unknown", "service_business"} and top_score < 0.45:
        primary_model = "unknown"
        confidence = min(confidence, 0.55)

    evidence["catalog_present"] = bool(evidence["catalog_present"])

    payload = {
        "primary_model": primary_model,
        "secondary_models": secondary_models,
        "customer_model": customer_model,
        "fulfillment_model": fulfillment_model,
        "catalog_present": bool(evidence["catalog_present"]),
        "service_heavy": bool(service_heavy),
        "confidence": confidence,
        **signals,
        "evidence_summary": _build_evidence_summary(evidence, signals),
        "signals_used": _dedupe_limited(evidence["signals_used"], limit=12, max_len=90),
    }
    return BusinessModelIntelligenceOutput.model_validate(payload).model_dump()


def business_model_intelligence(state: RelevancyAgentState) -> Dict[str, object]:
    """
    Deterministic business-model inference tool for Tool 6.
    Uses only upstream tool outputs and static metadata; no LLM calls.
    """
    default_output = BusinessModelIntelligenceOutput().model_dump()

    if state.get("collect_blocked") is True or state.get("website_exists") is False:
        return {
            "business_model_intelligence_output": {
                **default_output,
                "signals_used": ["blocked_status"],
                "evidence_summary": "Collection blocked or site unreachable; model inference is low confidence.",
            }
        }

    try:
        collect_sources = state.get("collect_sources_output") or {}
        structured = state.get("structured_signals_output") or {}
        clean = state.get("clean_text_output") or {}
        catalog = state.get("catalog_intelligence_output") or {}
        platform = state.get("platform_detection_output") or {}
        shopify = state.get("shopify_probe_output") or {}
        business_name = str(state.get("business_name") or "")
        category = state.get("category")
        description = state.get("description")
        website = str(state.get("website") or "")

        evidence = _empty_evidence()

        # Evidence hierarchy: structured -> catalog -> clean text -> platform/shopify -> metadata.
        _extract_structured_model_evidence(structured, evidence)
        _extract_catalog_model_evidence(catalog, evidence)
        _extract_clean_text_model_evidence(clean, business_name, category, description, website, evidence)
        _extract_platform_shopify_evidence(platform, shopify, evidence)
        _extract_metadata_evidence(business_name, category, description, website, evidence)

        # Dedupe and trim lists before final decisions.
        evidence["b2b_signals"] = _dedupe_limited(evidence["b2b_signals"], limit=10, max_len=70)
        evidence["b2c_signals"] = _dedupe_limited(evidence["b2c_signals"], limit=10, max_len=70)
        evidence["wholesale_signals"] = _dedupe_limited(evidence["wholesale_signals"], limit=10, max_len=70)
        evidence["manufacturing_signals"] = _dedupe_limited(evidence["manufacturing_signals"], limit=10, max_len=70)
        evidence["retail_signals"] = _dedupe_limited(evidence["retail_signals"], limit=10, max_len=70)
        evidence["marketplace_signals"] = _dedupe_limited(evidence["marketplace_signals"], limit=10, max_len=70)
        evidence["supporting_notes"] = _dedupe_limited(evidence["supporting_notes"], limit=6, max_len=130)
        evidence["limiting_notes"] = _dedupe_limited(evidence["limiting_notes"], limit=6, max_len=130)

        text_blob = _collect_clean_text_blob(clean, business_name, category, description, website).lower()
        output = _build_output(evidence, clean_text=text_blob)
        return {"business_model_intelligence_output": output}
    except Exception as exc:
        logger.error(
            "business_model_intelligence FAILED business_id=%s error=%s",
            state.get("business_id"),
            exc,
            exc_info=True,
        )
        return {
            "business_model_intelligence_output": {
                **default_output,
                "node_status": "failed",
                "error_message": f"business_model_intelligence: {type(exc).__name__}: {exc}",
            }
        }
