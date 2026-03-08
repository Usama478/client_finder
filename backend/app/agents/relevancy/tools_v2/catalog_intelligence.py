from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Sequence, Set

from app.agents.relevancy.schemas import CatalogIntelligenceOutput
from app.agents.relevancy.state import RelevancyAgentState

PRODUCT_TYPE_TOKENS: Sequence[str] = ("product", "offer")
CATALOG_TYPE_TOKENS: Sequence[str] = (
    "itemlist",
    "offercatalog",
    "collectionpage",
    "productgroup",
)
ORGANIZATION_TYPE_TOKENS: Sequence[str] = ("organization", "localbusiness", "store")

PRODUCT_KEY_TOKENS: Sequence[str] = (
    "sku",
    "mpn",
    "gtin",
    "brand",
    "offers",
    "price",
    "pricecurrency",
    "availability",
)
CATALOG_KEY_TOKENS: Sequence[str] = (
    "itemlistelement",
    "numberofitems",
    "itemlistorder",
    "offercatalog",
    "hasoffercatalog",
    "category",
    "collections",
    "products",
)
ORGANIZATION_KEY_TOKENS: Sequence[str] = (
    "sameas",
    "telephone",
    "address",
    "openinghours",
    "logo",
)

STOREFRONT_ACTION_MARKERS: Sequence[str] = (
    "add to cart",
    "add to bag",
    "add to basket",
    "buy now",
    "shop now",
    "view cart",
    "checkout",
    "shopping bag",
    "shopping cart",
    "wishlist",
    "quick add",
    "quick shop",
)
STORE_NAV_MARKERS: Sequence[str] = (
    "shop by category",
    "shop all",
    "browse products",
    "featured products",
    "featured collections",
    "collections",
    "new arrivals",
    "sale",
    "store locator",
    "find a store",
)
PDP_MARKERS: Sequence[str] = (
    "size",
    "size chart",
    "size guide",
    "select size",
    "color",
    "colour",
    "select color",
    "select colour",
    "in stock",
    "out of stock",
)
BRAND_CATALOG_MARKERS: Sequence[str] = (
    "our collection",
    "signature line",
    "new arrivals",
    "featured products",
    "featured collections",
    "store locator",
    "find a store",
)
PRICING_WORD_MARKERS: Sequence[str] = (
    "price",
    "pricing",
    "sale",
    "discount",
    "special offer",
    "best price",
    "starting at",
    "from",
    "now",
    "from $",
    "from £",
)
MARKETPLACE_MARKERS: Sequence[str] = (
    "supplier",
    "suppliers",
    "manufacturer",
    "manufacturers",
    "wholesaler",
    "wholesalers",
    "buyers",
    "request for quotation",
    "request a quotation",
    "rfq",
    "list your products",
    "seller",
    "sellers",
    "vendor",
    "vendors",
    "source now",
    "marketplace",
    "multi-supplier",
    "trade platform",
    "industry categories",
    "global suppliers",
    "factory",
    "factories",
    "manufacturer listings",
    "supplier listings",
    "verified suppliers",
    "find suppliers",
    "find manufacturers",
)
DIRECTORY_MARKERS: Sequence[str] = (
    "directory",
    "product directory",
    "supplier directory",
    "vendor directory",
    "manufacturer directory",
    "company directory",
    "industry directory",
    "factory listings",
    "manufacturer listings",
)
LISTING_PATTERN_MARKERS: Sequence[str] = (
    "sort by",
    "filter",
    "filters",
    "showing",
    "results",
    "per page",
    "view all",
    "grid view",
    "list view",
    "compare",
)
CATEGORY_MENU_TOKENS: Sequence[str] = (
    "men",
    "women",
    "kids",
    "sale",
    "new arrivals",
    "accessories",
    "collections",
)
SERVICE_NEGATIVE_MARKERS: Sequence[str] = (
    "consulting",
    "installation",
    "booking",
    "appointment",
    "case study",
    "portfolio",
    "our services",
    "service area",
    "book now",
)
INFORMATIONAL_NEGATIVE_MARKERS: Sequence[str] = (
    "about us",
    "our story",
    "blog",
    "newsroom",
    "press release",
    "investor relations",
    "careers",
    "privacy policy",
    "terms of use",
    "contact us",
)
NOISY_PRODUCT_CANDIDATE_MARKERS: Sequence[str] = (
    "page not found",
    "404",
    "not found",
    "cookie",
    "cookie policy",
    "accept all",
    "privacy policy",
    "privacy notice",
    "terms of",
    "policy",
    "refund policy",
    "returns policy",
    "shipping policy",
    "impressum",
    "all rights reserved",
)
CONTACT_CANDIDATE_MARKERS: Sequence[str] = (
    "contact us",
    "address",
    "phone",
    "telephone",
    "tel:",
    "call us",
    "email",
)
COMMERCE_ROUTE_TOKENS: Sequence[str] = (
    "/shop",
    "/store",
    "/products",
    "/product",
    "/collections",
    "/collection",
    "/category",
    "/catalog",
    "/sale",
    "/new",
)
MARKETPLACE_ROUTE_TOKENS: Sequence[str] = (
    "/suppliers",
    "/supplier",
    "/manufacturers",
    "/manufacturer",
    "/wholesale",
    "/buyers",
    "/rfq",
    "/request-for-quotation",
    "/source",
    "/marketplace",
    "/vendors",
    "/sellers",
)
DIRECTORY_ROUTE_TOKENS: Sequence[str] = (
    "/directory",
    "/product-directory",
    "/supplier-directory",
    "/vendor-directory",
    "/manufacturer-directory",
)
PRODUCT_ROUTE_TOKENS: Sequence[str] = ("/products/", "/product/", "/item/", "/p/")
CATEGORY_ROUTE_TOKENS: Sequence[str] = ("/collections", "/collection", "/category", "/catalog", "/shop/")

CURRENCY_RE = re.compile(
    r"(?:[$€£¥]|usd|eur|gbp|aed|aud|cad|inr|pkr|cny)\s?(?:\d|[0-9]{1,3}(?:[,.\s][0-9]{3})*)(?:\.\d{2})?",
    re.IGNORECASE,
)
PRICE_ADJACENT_PRODUCT_RE = re.compile(
    r"\b([A-Z][A-Za-z0-9'&\-]{2,}(?:\s+[A-Z0-9][A-Za-z0-9'&\-]{1,}){0,4})\b[^.\n]{0,55}"
    r"(?:[$€£¥]|usd|eur|gbp|aed|aud|cad|inr|pkr|cny)\s?\d",
    re.IGNORECASE,
)
CATEGORY_PHRASE_PATTERNS: Sequence[re.Pattern[str]] = (
    re.compile(r"\b(?:shop|browse|discover)\s+(?:all\s+)?([a-z0-9&/\-,\s]{4,90})", re.IGNORECASE),
    re.compile(r"\b(?:categories|collections?)\s*[:\-]\s*([a-z0-9&/\-,\s]{4,90})", re.IGNORECASE),
    re.compile(r"\b(?:shop by|product categories?)\s*[:\-]?\s*([a-z0-9&/\-,\s]{4,90})", re.IGNORECASE),
)
PAGINATION_RE = re.compile(
    r"(?:page\s+\d+|showing\s+\d+\s*[-–]\s*\d+|showing\s+\d+\s+of\s+\d+|results?\s+\d+)",
    re.IGNORECASE,
)
LISTING_COUNT_RE = re.compile(
    r"(?:\d+\s+products|\d+\s+suppliers|\d+\s+manufacturers|\d+\s+items)",
    re.IGNORECASE,
)
PHONE_RE = re.compile(r"(?:\+?\d[\d\-\s().]{6,}\d)")
ADDRESS_HINT_RE = re.compile(
    r"\b(?:street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd|suite|ste\.|floor|city|state|zip|postal)\b",
    re.IGNORECASE,
)
LINE_SPLIT_RE = re.compile(r"[\n\r]+|(?<=[.!?])\s+")
SEPARATOR_SPLIT_RE = re.compile(r"[,/;|]")

GENERIC_LABELS: Set[str] = {
    "all",
    "our",
    "shop",
    "store",
    "home",
    "products",
    "product",
    "collections",
    "collection",
    "categories",
    "category",
    "item",
    "items",
    "view all",
    "shop all",
    "learn more",
    "featured",
    "discover",
}


def _clamp_float(value: Any, lower: float = 0.0, upper: float = 1.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = lower
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


def _normalize_ws(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _clean_label(value: Any, max_len: int = 90) -> str:
    text = _normalize_ws(value)
    text = re.sub(r"^[\-\|\s]+|[\-\|\s]+$", "", text)
    text = re.sub(r"[^\w\s&/\-']", " ", text)
    text = _normalize_ws(text)
    if not text or len(text) < 2:
        return ""
    if len(text) > max_len:
        text = text[:max_len].strip()
    if text.lower() in GENERIC_LABELS:
        return ""
    if text.islower():
        return text.title()
    return text


def _dedupe_limited(items: Iterable[str], limit: int, max_len: int = 90) -> List[str]:
    seen: Set[str] = set()
    output: List[str] = []
    for item in items:
        cleaned = _clean_label(item, max_len=max_len)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(cleaned)
        if len(output) >= limit:
            break
    return output


def _dedupe_raw_limited(items: Iterable[str], limit: int, max_len: int = 70) -> List[str]:
    seen: Set[str] = set()
    output: List[str] = []
    for item in items:
        text = _normalize_ws(item)
        if not text:
            continue
        if len(text) > max_len:
            text = text[:max_len].strip()
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(text)
        if len(output) >= limit:
            break
    return output


def _split_label_candidates(value: str) -> List[str]:
    text = _normalize_ws(value)
    if not text:
        return []
    text = re.sub(r"\b(and|or)\b", ",", text, flags=re.IGNORECASE)
    parts = SEPARATOR_SPLIT_RE.split(text)
    return [candidate for candidate in (_clean_label(part, max_len=60) for part in parts) if candidate]


def _find_markers(text: str, markers: Sequence[str]) -> List[str]:
    lowered = text.lower()
    hits: List[str] = []
    for marker in markers:
        if marker and marker in lowered:
            hits.append(marker)
    return hits


def _score_hits(count: int, step: float, cap: float) -> float:
    return min(max(count, 0) * step, cap)


def _empty_evidence() -> Dict[str, Any]:
    return {
        "ledger": {},
        "mode_scores": {
            "storefront": 0.0,
            "marketplace": 0.0,
            "directory": 0.0,
            "brand_catalog": 0.0,
        },
        "signals_used": [],
        "supporting_notes": [],
        "limiting_notes": [],
        "product_families": [],
        "sample_products": [],
        "retail_storefront_signals": [],
        "marketplace_signals": [],
        "pricing_signals": [],
        "category_signals": [],
        "product_entity_count": 0,
        "catalog_entity_count": 0,
        "organization_entity_count": 0,
        "storefront_marker_count": 0,
        "pricing_marker_count": 0,
        "category_phrase_count": 0,
        "marketplace_marker_count": 0,
        "directory_marker_count": 0,
        "listing_pattern_count": 0,
        "product_candidate_count": 0,
        "route_hits": 0,
        "marketplace_route_hits": 0,
        "directory_route_hits": 0,
        "product_route_hits": 0,
        "category_route_hits": 0,
        "shopify_detected": False,
    }


def _add_contribution(evidence: Dict[str, Any], key: str, delta: float) -> None:
    ledger = evidence["ledger"]
    ledger[key] = float(ledger.get(key, 0.0)) + float(delta)


def _add_mode_score(evidence: Dict[str, Any], mode: str, delta: float) -> None:
    modes = evidence["mode_scores"]
    modes[mode] = float(modes.get(mode, 0.0)) + float(delta)


def _add_signal(evidence: Dict[str, Any], signal: str) -> None:
    signal_text = str(signal).strip()
    if not signal_text:
        return
    existing = evidence["signals_used"]
    if signal_text not in existing:
        existing.append(signal_text)


def _add_support_note(evidence: Dict[str, Any], text: str) -> None:
    cleaned = _normalize_ws(text)
    if cleaned:
        evidence["supporting_notes"].append(cleaned)


def _add_limiting_note(evidence: Dict[str, Any], text: str) -> None:
    cleaned = _normalize_ws(text)
    if cleaned:
        evidence["limiting_notes"].append(cleaned)


def _classify_structured_entity(entity: Dict[str, Any]) -> Dict[str, Any]:
    type_hint = str(entity.get("type_hint") or "").lower()
    keys = {str(key).strip().lower() for key in _safe_list(entity.get("keys")) if str(key).strip()}
    product_type = any(token in type_hint for token in PRODUCT_TYPE_TOKENS)
    catalog_type = any(token in type_hint for token in CATALOG_TYPE_TOKENS)
    organization_type = any(token in type_hint for token in ORGANIZATION_TYPE_TOKENS)
    person_type = "person" in type_hint or "profilepage" in type_hint or "profile" in type_hint
    product_key = any(token in keys for token in PRODUCT_KEY_TOKENS)
    catalog_key = any(token in keys for token in CATALOG_KEY_TOKENS)
    organization_key = any(token in keys for token in ORGANIZATION_KEY_TOKENS)
    contact_only = (
        any(token in keys for token in ("telephone", "address", "email", "contactpoint"))
        and not product_type
        and not catalog_type
        and not product_key
        and not catalog_key
    )
    blob = " ".join(
        [
            type_hint,
            str(entity.get("name") or ""),
            str(entity.get("url") or ""),
            " ".join(sorted(keys)),
        ]
    ).lower()
    return {
        "product_like": (product_type or product_key) and not person_type and not contact_only,
        "catalog_like": (catalog_type or catalog_key) and not person_type and not contact_only,
        "organization_like": organization_type or organization_key,
        "person_like": person_type,
        "contact_only": contact_only,
        "marketplace_hits": _find_markers(blob, MARKETPLACE_MARKERS),
        "directory_hits": _find_markers(blob, DIRECTORY_MARKERS),
    }


def _extract_structured_catalog_evidence(structured: Dict[str, Any]) -> Dict[str, Any]:
    evidence = _empty_evidence()
    entities = structured.get("entities") or []
    signal_flags = {flag.lower() for flag in _safe_list(structured.get("signal_flags"))}
    structured_used = {item.lower() for item in _safe_list(structured.get("structured_signals_used"))}
    has_catalog = structured.get("structured_has_product_catalog") is True
    signal_strength = str(structured.get("structured_signal_strength") or "").lower()

    if has_catalog:
        _add_contribution(evidence, "structured.has_catalog_flag", 0.28)
        _add_mode_score(evidence, "storefront", 0.20)
        _add_signal(evidence, "structured.structured_has_product_catalog")

    if signal_strength == "strong":
        _add_contribution(evidence, "structured.signal_strength.strong", 0.18)
        _add_mode_score(evidence, "storefront", 0.10)
        _add_signal(evidence, "structured.signal_strength.strong")
    elif signal_strength == "weak":
        _add_contribution(evidence, "structured.signal_strength.weak", 0.08)
        _add_signal(evidence, "structured.signal_strength.weak")

    if "jsonld_catalog" in signal_flags:
        _add_contribution(evidence, "structured.signal_flag.jsonld_catalog", 0.18)
        _add_mode_score(evidence, "storefront", 0.10)
        _add_signal(evidence, "structured.signal_flag.jsonld_catalog")
    if "jsonld_products" in signal_flags:
        _add_contribution(evidence, "structured.signal_flag.jsonld_products", 0.20)
        _add_mode_score(evidence, "storefront", 0.12)
        _add_signal(evidence, "structured.signal_flag.jsonld_products")
    if "jsonld_catalog" in structured_used:
        _add_contribution(evidence, "structured.signal_used.jsonld_catalog", 0.10)
        _add_signal(evidence, "structured.signal_used.jsonld_catalog")
    if "jsonld_product" in structured_used:
        _add_contribution(evidence, "structured.signal_used.jsonld_product", 0.10)
        _add_signal(evidence, "structured.signal_used.jsonld_product")

    person_entity_count = 0
    contact_only_entity_count = 0
    for entity in entities[:30]:
        if not isinstance(entity, dict):
            continue
        classification = _classify_structured_entity(entity)
        name = _clean_label(entity.get("name"), max_len=90)

        if classification["person_like"]:
            person_entity_count += 1
        if classification["contact_only"]:
            contact_only_entity_count += 1

        if classification["product_like"]:
            evidence["product_entity_count"] += 1
            if name:
                evidence["sample_products"].append(name)
        if classification["catalog_like"]:
            evidence["catalog_entity_count"] += 1
            if name:
                evidence["product_families"].append(name)
                evidence["category_signals"].append(name)
        if classification["organization_like"] and not classification["product_like"] and not classification["catalog_like"]:
            evidence["organization_entity_count"] += 1

        evidence["marketplace_signals"].extend(classification["marketplace_hits"])
        evidence["marketplace_marker_count"] += len(classification["marketplace_hits"])
        evidence["directory_marker_count"] += len(classification["directory_hits"])

    if evidence["product_entity_count"] > 0:
        _add_contribution(
            evidence,
            "structured.product_entities",
            _score_hits(evidence["product_entity_count"], 0.06, 0.34),
        )
        _add_mode_score(evidence, "storefront", _score_hits(evidence["product_entity_count"], 0.08, 0.36))
        _add_signal(evidence, "structured.entities.product_like")
    if evidence["catalog_entity_count"] > 0:
        _add_contribution(
            evidence,
            "structured.catalog_entities",
            _score_hits(evidence["catalog_entity_count"], 0.08, 0.32),
        )
        _add_mode_score(evidence, "storefront", _score_hits(evidence["catalog_entity_count"], 0.10, 0.30))
        _add_signal(evidence, "structured.entities.catalog_like")
    if evidence["product_entity_count"] >= 3 or evidence["catalog_entity_count"] >= 2:
        _add_contribution(evidence, "structured.product_density", 0.12)
        _add_signal(evidence, "structured.product_density")

    if evidence["marketplace_marker_count"] > 0:
        _add_contribution(
            evidence,
            "structured.marketplace_markers",
            _score_hits(evidence["marketplace_marker_count"], 0.04, 0.18),
        )
        _add_mode_score(
            evidence,
            "marketplace",
            _score_hits(evidence["marketplace_marker_count"], 0.08, 0.30),
        )
        _add_signal(evidence, "structured.marketplace_markers")
    if evidence["directory_marker_count"] > 0:
        _add_contribution(
            evidence,
            "structured.directory_markers",
            _score_hits(evidence["directory_marker_count"], 0.04, 0.16),
        )
        _add_mode_score(
            evidence,
            "directory",
            _score_hits(evidence["directory_marker_count"], 0.10, 0.36),
        )
        _add_signal(evidence, "structured.directory_markers")

    if evidence["product_entity_count"] or evidence["catalog_entity_count"]:
        _add_support_note(
            evidence,
            "Structured entities include product/catalog types "
            f"(products={evidence['product_entity_count']}, catalogs={evidence['catalog_entity_count']}).",
        )

    if (
        evidence["organization_entity_count"] > 0
        and evidence["product_entity_count"] == 0
        and evidence["catalog_entity_count"] == 0
    ):
        _add_contribution(evidence, "negative.structured.organization_only", -0.20)
        _add_limiting_note(evidence, "Structured data is organization-only with no product/catalog objects.")
        _add_signal(evidence, "negative.structured.organization_only")

    if (
        person_entity_count >= 1 or contact_only_entity_count >= 1
    ) and evidence["product_entity_count"] == 0 and evidence["catalog_entity_count"] == 0:
        _add_contribution(evidence, "negative.structured.person_or_contact_only", -0.16)
        _add_limiting_note(evidence, "Structured entities are person/contact oriented, not product/catalog objects.")
        _add_signal(evidence, "negative.structured.person_or_contact_only")

    if not entities and not signal_flags and not structured_used:
        _add_contribution(evidence, "negative.structured.empty", -0.10)
        _add_limiting_note(evidence, "No meaningful structured catalog signals were extracted.")
        _add_signal(evidence, "negative.structured.empty")

    return evidence


def _extract_text_blob(
    clean: Dict[str, Any],
    business_name: str,
    category: Any,
    description: Any,
    website: str,
) -> str:
    excerpt = str(clean.get("text_excerpt") or "")
    sections = clean.get("sections") or {}
    chunks: List[str] = []
    if excerpt:
        chunks.append(excerpt)
    if isinstance(sections, dict):
        for text in list(sections.values())[:8]:
            normalized = str(text or "").strip()
            if normalized:
                chunks.append(normalized)
    for extra in (business_name, category, description, website):
        normalized = _normalize_ws(extra)
        if normalized:
            chunks.append(normalized)
    return "\n".join(chunks)[:6500]


def _extract_pricing_markers(text_blob: str) -> List[str]:
    lowered = text_blob.lower()
    hits: List[str] = []
    for marker in PRICING_WORD_MARKERS:
        if marker in lowered:
            hits.append(marker)
    if CURRENCY_RE.search(text_blob):
        hits.append("currency amounts")
    return _dedupe_limited(hits, limit=10, max_len=45)


def _extract_category_phrases(text_blob: str) -> List[str]:
    candidates: List[str] = []
    lowered = text_blob.lower()
    for pattern in CATEGORY_PHRASE_PATTERNS:
        for match in pattern.findall(text_blob):
            candidates.extend(_split_label_candidates(match))
    if any(marker in lowered for marker in STORE_NAV_MARKERS):
        for token in CATEGORY_MENU_TOKENS:
            if re.search(rf"\b{re.escape(token)}\b", lowered):
                candidates.append(token)
    filtered = [candidate for candidate in candidates if not _is_noise_product_candidate(candidate)]
    return _dedupe_limited(filtered, limit=12, max_len=65)


def _is_noise_product_candidate(text: str) -> bool:
    normalized = _normalize_ws(text)
    lowered = normalized.lower()
    if not normalized:
        return True
    if any(marker in lowered for marker in NOISY_PRODUCT_CANDIDATE_MARKERS):
        return True
    if any(marker in lowered for marker in CONTACT_CANDIDATE_MARKERS):
        return True
    if PHONE_RE.search(normalized):
        return True
    if "@" in lowered:
        return True
    if ADDRESS_HINT_RE.search(normalized) and any(ch.isdigit() for ch in normalized):
        return True
    words = [token.strip(".,:;!?()[]{}\"'").lower() for token in normalized.split() if token.strip()]
    if words and all(token in GENERIC_LABELS for token in words):
        return True
    return False


def _is_noise_context_text(text: str) -> bool:
    normalized = _normalize_ws(text)
    lowered = normalized.lower()
    if not lowered:
        return False
    if any(marker in lowered for marker in NOISY_PRODUCT_CANDIDATE_MARKERS):
        return True
    if any(marker in lowered for marker in CONTACT_CANDIDATE_MARKERS):
        return True
    if PHONE_RE.search(normalized):
        return True
    if "@" in lowered:
        return True
    return False


def _looks_like_product_title(text: str) -> bool:
    if _is_noise_product_candidate(text):
        return False
    words = text.split()
    if len(words) < 2 or len(words) > 8:
        return False
    lower = text.lower()
    if any(term in lower for term in SERVICE_NEGATIVE_MARKERS):
        return False
    if any(term in lower for term in INFORMATIONAL_NEGATIVE_MARKERS):
        return False
    meaningful_words = [word for word in words if len(word) >= 3 and word.lower() not in GENERIC_LABELS]
    if len(meaningful_words) < 2:
        return False
    upperish = sum(1 for word in words if word[:1].isupper() or any(ch.isdigit() for ch in word))
    return upperish >= max(1, len(words) // 2)


def _extract_listing_heading_candidates(text_blob: str) -> List[str]:
    candidates: List[str] = []
    for chunk in LINE_SPLIT_RE.split(text_blob):
        line = _clean_label(chunk, max_len=90)
        if not line:
            continue
        if len(line) < 8 or len(line) > 70:
            continue
        if _is_noise_product_candidate(line):
            continue
        if _looks_like_product_title(line):
            candidates.append(line)
        if len(candidates) >= 25:
            break
    return _dedupe_limited(candidates, limit=15, max_len=90)


def _extract_price_adjacent_products(text_blob: str) -> List[str]:
    candidates = PRICE_ADJACENT_PRODUCT_RE.findall(text_blob)
    filtered = [candidate for candidate in candidates if not _is_noise_product_candidate(candidate)]
    return _dedupe_limited(filtered, limit=12, max_len=90)


def _extract_listing_pattern_hits(text_blob: str) -> List[str]:
    lowered = text_blob.lower()
    hits = [marker for marker in LISTING_PATTERN_MARKERS if marker in lowered]
    if PAGINATION_RE.search(text_blob):
        hits.append("pagination markers")
    if LISTING_COUNT_RE.search(text_blob):
        hits.append("listing counts")
    return _dedupe_limited(hits, limit=8, max_len=45)


def _extract_clean_text_catalog_evidence(
    clean: Dict[str, Any],
    business_name: str,
    category: Any,
    description: Any,
    website: str,
) -> Dict[str, Any]:
    evidence = _empty_evidence()
    text_blob = _extract_text_blob(clean, business_name, category, description, website)
    lowered = text_blob.lower()

    storefront_hits = _dedupe_limited(
        [
            *(_find_markers(lowered, STOREFRONT_ACTION_MARKERS)),
            *(_find_markers(lowered, STORE_NAV_MARKERS)),
            *(_find_markers(lowered, PDP_MARKERS)),
        ],
        limit=12,
        max_len=45,
    )
    brand_hits = _dedupe_limited(_find_markers(lowered, BRAND_CATALOG_MARKERS), limit=8, max_len=45)
    pricing_hits = _extract_pricing_markers(text_blob)
    category_hits = _extract_category_phrases(text_blob)
    marketplace_hits = _dedupe_limited(_find_markers(lowered, MARKETPLACE_MARKERS), limit=10, max_len=45)
    directory_hits = _dedupe_limited(_find_markers(lowered, DIRECTORY_MARKERS), limit=8, max_len=45)
    listing_hits = _extract_listing_pattern_hits(text_blob)
    price_products = _extract_price_adjacent_products(text_blob)
    listing_products = _extract_listing_heading_candidates(text_blob)
    candidate_products = _dedupe_limited([*price_products, *listing_products], limit=20, max_len=90)
    has_listing_context = bool(storefront_hits or category_hits or pricing_hits or price_products or CURRENCY_RE.search(text_blob))
    if listing_hits and not has_listing_context:
        listing_hits = []
    if candidate_products and not has_listing_context:
        candidate_products = []

    evidence["retail_storefront_signals"].extend(storefront_hits)
    evidence["pricing_signals"].extend(pricing_hits)
    evidence["product_families"].extend(category_hits)
    evidence["category_signals"].extend(category_hits)
    evidence["marketplace_signals"].extend(marketplace_hits)
    evidence["marketplace_signals"].extend(directory_hits)
    evidence["sample_products"].extend(candidate_products)
    evidence["storefront_marker_count"] += len(storefront_hits)
    evidence["pricing_marker_count"] += len(pricing_hits)
    evidence["category_phrase_count"] += len(category_hits)
    evidence["marketplace_marker_count"] += len(marketplace_hits)
    evidence["directory_marker_count"] += len(directory_hits)
    evidence["listing_pattern_count"] += len(listing_hits)
    evidence["product_candidate_count"] += len(candidate_products)

    if storefront_hits:
        _add_contribution(
            evidence,
            "clean.storefront_markers",
            _score_hits(len(storefront_hits), 0.05, 0.26),
        )
        _add_mode_score(evidence, "storefront", _score_hits(len(storefront_hits), 0.10, 0.42))
        _add_signal(evidence, "clean_text.storefront_markers")
    if brand_hits:
        _add_contribution(evidence, "clean.brand_markers", _score_hits(len(brand_hits), 0.04, 0.16))
        _add_mode_score(evidence, "brand_catalog", _score_hits(len(brand_hits), 0.11, 0.34))
        _add_signal(evidence, "clean_text.brand_markers")
    if pricing_hits:
        _add_contribution(evidence, "clean.pricing_markers", _score_hits(len(pricing_hits), 0.05, 0.20))
        _add_mode_score(evidence, "storefront", _score_hits(len(pricing_hits), 0.04, 0.12))
        _add_signal(evidence, "clean_text.pricing_markers")
    if category_hits:
        _add_contribution(evidence, "clean.category_phrases", _score_hits(len(category_hits), 0.04, 0.20))
        _add_mode_score(evidence, "storefront", _score_hits(len(category_hits), 0.06, 0.20))
        _add_mode_score(evidence, "brand_catalog", _score_hits(len(category_hits), 0.04, 0.16))
        _add_signal(evidence, "clean_text.category_phrases")
    if candidate_products:
        if has_listing_context:
            _add_contribution(
                evidence,
                "clean.product_candidates",
                _score_hits(len(candidate_products), 0.02, 0.14),
            )
            _add_mode_score(evidence, "storefront", 0.08)
            _add_signal(evidence, "clean_text.product_candidates")
        else:
            _add_limiting_note(evidence, "Product-name candidates lacked storefront context and were down-weighted.")
    if listing_hits:
        _add_contribution(evidence, "clean.listing_patterns", _score_hits(len(listing_hits), 0.02, 0.08))
        _add_signal(evidence, "clean_text.listing_patterns")
    if marketplace_hits:
        _add_contribution(evidence, "clean.marketplace_markers", _score_hits(len(marketplace_hits), 0.07, 0.40))
        _add_mode_score(evidence, "marketplace", _score_hits(len(marketplace_hits), 0.14, 0.66))
        _add_signal(evidence, "clean_text.marketplace_markers")
    if directory_hits:
        _add_contribution(evidence, "clean.directory_markers", _score_hits(len(directory_hits), 0.06, 0.24))
        _add_mode_score(evidence, "directory", _score_hits(len(directory_hits), 0.18, 0.64))
        _add_mode_score(evidence, "marketplace", _score_hits(len(directory_hits), 0.06, 0.18))
        _add_signal(evidence, "clean_text.directory_markers")

    if storefront_hits or pricing_hits or category_hits:
        _add_support_note(
            evidence,
            "Clean text includes storefront cues "
            f"(storefront={len(storefront_hits)}, pricing={len(pricing_hits)}, categories={len(category_hits)}).",
        )
    if marketplace_hits or directory_hits:
        _add_support_note(
            evidence,
            "Clean text includes marketplace cues "
            f"(marketplace={len(marketplace_hits)}, directory={len(directory_hits)}).",
        )

    service_hits = _find_markers(lowered, SERVICE_NEGATIVE_MARKERS)
    info_hits = _find_markers(lowered, INFORMATIONAL_NEGATIVE_MARKERS)
    has_positive = bool(
        storefront_hits
        or pricing_hits
        or category_hits
        or marketplace_hits
        or directory_hits
        or candidate_products
    )

    if len(service_hits) >= 2 and not has_positive:
        _add_contribution(evidence, "negative.clean_text.service_heavy", -0.22)
        _add_limiting_note(evidence, "Text is service-focused without product/storefront cues.")
        _add_signal(evidence, "negative.clean_text.service_heavy")
    if len(info_hits) >= 4 and not has_positive:
        _add_contribution(evidence, "negative.clean_text.informational", -0.12)
        _add_limiting_note(evidence, "Text is mostly informational and lacks catalog language.")
        _add_signal(evidence, "negative.clean_text.informational")
    if len(_normalize_ws(text_blob)) < 120 and not has_positive:
        _add_contribution(evidence, "negative.clean_text.sparse", -0.10)
        _add_limiting_note(evidence, "Insufficient clean text to verify catalog presence.")
        _add_signal(evidence, "negative.clean_text.sparse")

    return evidence


def _page_blob(page: Dict[str, Any]) -> str:
    html_excerpt = _normalize_ws(str(page.get("html") or ""))[:1200]
    rendered_text_excerpt = _normalize_ws(str(page.get("rendered_text_excerpt") or ""))[:700]
    text_excerpt = rendered_text_excerpt or _normalize_ws(str(page.get("text_excerpt") or ""))[:700]
    rendered_title = _normalize_ws(str(page.get("rendered_title") or ""))
    title = rendered_title or _normalize_ws(str(page.get("title") or ""))
    return " ".join(
        part
        for part in [
            str(page.get("label") or ""),
            title,
            str(page.get("requested_url") or ""),
            str(page.get("final_url") or ""),
            text_excerpt,
            html_excerpt,
        ]
        if str(part).strip()
    ).lower()


def _extract_collect_source_evidence(collect_sources: Dict[str, Any]) -> Dict[str, Any]:
    evidence = _empty_evidence()
    homepage = collect_sources.get("homepage") or {}
    pages = collect_sources.get("pages") or []

    page_entries: List[Dict[str, Any]] = []
    if isinstance(homepage, dict):
        page_entries.append(homepage)
    if isinstance(pages, list):
        page_entries.extend(item for item in pages if isinstance(item, dict))

    info_routes = 0
    for page in page_entries[:12]:
        fetched = page.get("fetched") is True
        if not fetched:
            continue

        label = str(page.get("label") or "").strip().lower()
        preferred_title = page.get("rendered_title") or page.get("title")
        title = _clean_label(preferred_title, max_len=70)
        blob = _page_blob(page)
        requested_url = str(page.get("requested_url") or "").lower()
        final_url = str(page.get("final_url") or "").lower()
        route_text = " ".join([label, requested_url, final_url, blob])
        if "page not found" in route_text or re.search(r"\b404\b", route_text):
            info_routes += 1
            _add_limiting_note(evidence, "Collected page appears to be a 404/not-found page.")
            continue

        route_noise = _is_noise_context_text(route_text)
        raw_route_hit = any(token in route_text for token in COMMERCE_ROUTE_TOKENS) or label in {
            "shop",
            "store",
            "products",
            "collections",
            "catalog",
            "sale",
        }
        product_route_hit = any(token in route_text for token in PRODUCT_ROUTE_TOKENS)
        category_route_hit = any(token in route_text for token in CATEGORY_ROUTE_TOKENS)
        route_hit = raw_route_hit and not (route_noise and not (product_route_hit or category_route_hit))
        marketplace_route_hit = any(token in route_text for token in MARKETPLACE_ROUTE_TOKENS)
        directory_route_hit = any(token in route_text for token in DIRECTORY_ROUTE_TOKENS) or "directory" in label
        listing_hit = bool(PAGINATION_RE.search(route_text) or LISTING_COUNT_RE.search(route_text))
        has_storefront_context = bool(
            route_hit
            or product_route_hit
            or category_route_hit
            or _find_markers(route_text, STOREFRONT_ACTION_MARKERS)
            or CURRENCY_RE.search(route_text)
        )
        if listing_hit and not has_storefront_context:
            listing_hit = False

        if route_hit or product_route_hit or category_route_hit or marketplace_route_hit or directory_route_hit:
            evidence["route_hits"] += 1
        if product_route_hit:
            evidence["product_route_hits"] += 1
        if category_route_hit:
            evidence["category_route_hits"] += 1
        if marketplace_route_hit:
            evidence["marketplace_route_hits"] += 1
        if directory_route_hit:
            evidence["directory_route_hits"] += 1
        if listing_hit:
            evidence["listing_pattern_count"] += 1

        if label in {"about", "contact", "support"}:
            info_routes += 1

        if title and route_hit:
            evidence["category_signals"].append(title)
            evidence["product_families"].append(title)
        if marketplace_route_hit:
            evidence["marketplace_signals"].append(label or "marketplace route")
        if directory_route_hit:
            evidence["marketplace_signals"].append(label or "directory route")

    if evidence["route_hits"] > 0:
        _add_contribution(evidence, "collect.commerce_routes", _score_hits(evidence["route_hits"], 0.06, 0.30))
        _add_mode_score(evidence, "storefront", _score_hits(evidence["route_hits"], 0.08, 0.30))
        evidence["retail_storefront_signals"].append("catalog routes")
        _add_signal(evidence, "collect_sources.commerce_routes")
    if evidence["product_route_hits"] > 0:
        _add_contribution(evidence, "collect.product_routes", _score_hits(evidence["product_route_hits"], 0.05, 0.18))
        _add_mode_score(evidence, "storefront", _score_hits(evidence["product_route_hits"], 0.08, 0.24))
        _add_signal(evidence, "collect_sources.product_routes")
    if evidence["category_route_hits"] > 0:
        _add_contribution(evidence, "collect.category_routes", _score_hits(evidence["category_route_hits"], 0.05, 0.20))
        _add_mode_score(evidence, "storefront", _score_hits(evidence["category_route_hits"], 0.08, 0.24))
        _add_signal(evidence, "collect_sources.category_routes")
    if evidence["marketplace_route_hits"] > 0:
        _add_contribution(
            evidence,
            "collect.marketplace_routes",
            _score_hits(evidence["marketplace_route_hits"], 0.08, 0.36),
        )
        _add_mode_score(
            evidence,
            "marketplace",
            _score_hits(evidence["marketplace_route_hits"], 0.18, 0.82),
        )
        _add_signal(evidence, "collect_sources.marketplace_routes")
    if evidence["directory_route_hits"] > 0:
        _add_contribution(
            evidence,
            "collect.directory_routes",
            _score_hits(evidence["directory_route_hits"], 0.07, 0.28),
        )
        _add_mode_score(
            evidence,
            "directory",
            _score_hits(evidence["directory_route_hits"], 0.20, 0.78),
        )
        _add_mode_score(
            evidence,
            "marketplace",
            _score_hits(evidence["directory_route_hits"], 0.06, 0.18),
        )
        _add_signal(evidence, "collect_sources.directory_routes")

    if evidence["route_hits"] or evidence["marketplace_route_hits"] or evidence["directory_route_hits"]:
        _add_support_note(
            evidence,
            "Collected routes show catalog navigation "
            f"(commerce={evidence['route_hits']}, marketplace={evidence['marketplace_route_hits']}, "
            f"directory={evidence['directory_route_hits']}).",
        )

    if evidence["route_hits"] == 0 and info_routes >= 2:
        _add_contribution(evidence, "negative.collect_sources.informational_routes", -0.08)
        _add_limiting_note(evidence, "Fetched pages are mostly informational routes.")
        _add_signal(evidence, "negative.collect_sources.informational_routes")

    return evidence


def _extract_platform_shopify_evidence(
    platform: Dict[str, Any],
    shopify_probe: Dict[str, Any],
) -> Dict[str, Any]:
    evidence = _empty_evidence()
    platform_name = str(platform.get("platform") or "").lower()
    platform_confidence = _clamp_float(platform.get("confidence"))
    shopify_detected = platform.get("shopify_detected") is True or shopify_probe.get("detected") is True
    shopify_signals = _safe_list(shopify_probe.get("signals"))

    if shopify_detected:
        evidence["shopify_detected"] = True
        _add_contribution(evidence, "shopify.detected", 0.24)
        _add_mode_score(evidence, "storefront", 0.28)
        _add_signal(evidence, "shopify_probe.detected")
        _add_support_note(evidence, "Shopify probe detected catalog endpoints.")

    for raw_signal in shopify_signals:
        signal = raw_signal.strip().lower()
        if signal == "products-json-endpoint":
            _add_contribution(evidence, "shopify.products_json", 0.12)
            _add_mode_score(evidence, "storefront", 0.10)
        elif signal == "collections-all-view":
            _add_contribution(evidence, "shopify.collections_view", 0.10)
            _add_mode_score(evidence, "storefront", 0.08)
            evidence["category_signals"].append("Collections")
        elif signal == "cdn-shop-assets":
            _add_contribution(evidence, "shopify.cdn_assets", 0.06)
        else:
            _add_contribution(evidence, "shopify.other_signal", 0.04)
        _add_signal(evidence, f"shopify_probe.{signal}")

    if platform_name == "shopify":
        _add_contribution(evidence, "platform.shopify", 0.08 + (platform_confidence * 0.10))
        _add_mode_score(evidence, "storefront", 0.18)
        _add_signal(evidence, "platform.shopify")
    elif platform_name == "woocommerce":
        _add_contribution(evidence, "platform.woocommerce", 0.06 + (platform_confidence * 0.08))
        _add_mode_score(evidence, "storefront", 0.14)
        _add_signal(evidence, "platform.woocommerce")
    elif platform_name == "wordpress" and platform_confidence >= 0.6:
        _add_contribution(evidence, "platform.wordpress", 0.03)
        _add_signal(evidence, "platform.wordpress")

    return evidence


def _extract_marketplace_directory_evidence(
    clean: Dict[str, Any],
    collect_sources: Dict[str, Any],
    business_name: str,
    category: Any,
    description: Any,
    website: str,
) -> Dict[str, Any]:
    evidence = _empty_evidence()
    page_blobs: List[str] = []
    homepage = collect_sources.get("homepage") or {}
    pages = collect_sources.get("pages") or []
    if isinstance(homepage, dict):
        page_blobs.append(_page_blob(homepage))
    if isinstance(pages, list):
        page_blobs.extend(_page_blob(page) for page in pages[:8] if isinstance(page, dict))

    corpus = "\n".join(
        [
            _extract_text_blob(clean, business_name, category, description, website),
            "\n".join(page_blobs),
        ]
    ).lower()
    marketplace_hits = _dedupe_limited(_find_markers(corpus, MARKETPLACE_MARKERS), limit=10, max_len=45)
    directory_hits = _dedupe_limited(_find_markers(corpus, DIRECTORY_MARKERS), limit=8, max_len=45)

    evidence["marketplace_signals"].extend(marketplace_hits)
    evidence["marketplace_signals"].extend(directory_hits)
    evidence["marketplace_marker_count"] += len(marketplace_hits)
    evidence["directory_marker_count"] += len(directory_hits)

    if marketplace_hits:
        _add_contribution(
            evidence,
            "marketplace.language",
            _score_hits(len(marketplace_hits), 0.06, 0.36),
        )
        _add_mode_score(
            evidence,
            "marketplace",
            _score_hits(len(marketplace_hits), 0.14, 0.74),
        )
        _add_signal(evidence, "marketplace.language")
    if directory_hits:
        _add_contribution(
            evidence,
            "directory.language",
            _score_hits(len(directory_hits), 0.05, 0.22),
        )
        _add_mode_score(
            evidence,
            "directory",
            _score_hits(len(directory_hits), 0.18, 0.74),
        )
        _add_mode_score(
            evidence,
            "marketplace",
            _score_hits(len(directory_hits), 0.06, 0.18),
        )
        _add_signal(evidence, "directory.language")
    if marketplace_hits and directory_hits:
        _add_contribution(evidence, "marketplace.directory_synergy", 0.08)
        _add_mode_score(evidence, "marketplace", 0.12)
        _add_mode_score(evidence, "directory", 0.12)

    if marketplace_hits or directory_hits:
        _add_support_note(
            evidence,
            "Marketplace/directory language detected: "
            f"{', '.join((marketplace_hits + directory_hits)[:5])}.",
        )

    return evidence


def _apply_negative_site_adjustments(
    evidence: Dict[str, Any],
    clean: Dict[str, Any],
    collect_sources: Dict[str, Any],
    business_name: str,
    category: Any,
    description: Any,
    website: str,
) -> None:
    text_blob = _extract_text_blob(clean, business_name, category, description, website).lower()
    total_positive_hints = sum(
        [
            1 if int(evidence.get("product_entity_count") or 0) > 0 else 0,
            1 if int(evidence.get("catalog_entity_count") or 0) > 0 else 0,
            1 if int(evidence.get("route_hits") or 0) > 0 else 0,
            1 if int(evidence.get("storefront_marker_count") or 0) > 1 else 0,
            1 if int(evidence.get("pricing_marker_count") or 0) > 0 else 0,
            1 if int(evidence.get("marketplace_marker_count") or 0) > 0 else 0,
            1 if int(evidence.get("directory_marker_count") or 0) > 0 else 0,
            1 if int(evidence.get("product_candidate_count") or 0) > 0 else 0,
        ]
    )

    service_hits = _find_markers(text_blob, SERVICE_NEGATIVE_MARKERS)
    info_hits = _find_markers(text_blob, INFORMATIONAL_NEGATIVE_MARKERS)
    homepage = collect_sources.get("homepage") or {}
    pages = collect_sources.get("pages") or []
    fetched_pages = 0
    if isinstance(homepage, dict) and homepage.get("fetched") is True:
        fetched_pages += 1
    if isinstance(pages, list):
        fetched_pages += sum(1 for page in pages[:8] if isinstance(page, dict) and page.get("fetched") is True)

    if len(service_hits) >= 2 and total_positive_hints <= 1:
        _add_contribution(evidence, "negative.service_only", -0.20)
        _add_limiting_note(evidence, "Service language outweighs catalog evidence.")
        _add_signal(evidence, "negative.service_only")
    if len(info_hits) >= 4 and total_positive_hints == 0:
        _add_contribution(evidence, "negative.informational_only", -0.14)
        _add_limiting_note(evidence, "Informational pages dominate without catalog proof.")
        _add_signal(evidence, "negative.informational_only")
    if fetched_pages == 0 and total_positive_hints == 0:
        _add_contribution(evidence, "negative.no_fetched_pages", -0.10)
        _add_limiting_note(evidence, "No fetched pages provided deterministic catalog evidence.")
        _add_signal(evidence, "negative.no_fetched_pages")
    if len(_normalize_ws(text_blob)) < 120 and total_positive_hints == 0:
        _add_contribution(evidence, "negative.sparse_site", -0.10)
        _add_limiting_note(evidence, "Site evidence is sparse across structured, text, and route layers.")
        _add_signal(evidence, "negative.sparse_site")


def _merge_evidence(parts: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    merged = _empty_evidence()
    for part in parts:
        for key, value in (part.get("ledger") or {}).items():
            _add_contribution(merged, str(key), float(value))
        for mode, value in (part.get("mode_scores") or {}).items():
            _add_mode_score(merged, str(mode), float(value))
        for signal in part.get("signals_used") or []:
            _add_signal(merged, str(signal))

        merged["supporting_notes"].extend(_safe_list(part.get("supporting_notes")))
        merged["limiting_notes"].extend(_safe_list(part.get("limiting_notes")))
        merged["product_families"].extend(_safe_list(part.get("product_families")))
        merged["sample_products"].extend(_safe_list(part.get("sample_products")))
        merged["retail_storefront_signals"].extend(_safe_list(part.get("retail_storefront_signals")))
        merged["marketplace_signals"].extend(_safe_list(part.get("marketplace_signals")))
        merged["pricing_signals"].extend(_safe_list(part.get("pricing_signals")))
        merged["category_signals"].extend(_safe_list(part.get("category_signals")))

        for key in (
            "product_entity_count",
            "catalog_entity_count",
            "organization_entity_count",
            "storefront_marker_count",
            "pricing_marker_count",
            "category_phrase_count",
            "marketplace_marker_count",
            "directory_marker_count",
            "listing_pattern_count",
            "product_candidate_count",
            "route_hits",
            "marketplace_route_hits",
            "directory_route_hits",
            "product_route_hits",
            "category_route_hits",
        ):
            merged[key] += int(part.get(key) or 0)
        merged["shopify_detected"] = merged["shopify_detected"] or (part.get("shopify_detected") is True)

    merged["product_families"] = _dedupe_limited(merged["product_families"], limit=10, max_len=80)
    merged["sample_products"] = _dedupe_limited(merged["sample_products"], limit=15, max_len=95)
    merged["retail_storefront_signals"] = _dedupe_limited(merged["retail_storefront_signals"], limit=10, max_len=45)
    merged["marketplace_signals"] = _dedupe_limited(merged["marketplace_signals"], limit=10, max_len=45)
    merged["pricing_signals"] = _dedupe_limited(merged["pricing_signals"], limit=10, max_len=45)
    merged["category_signals"] = _dedupe_limited(merged["category_signals"], limit=10, max_len=70)
    merged["supporting_notes"] = _dedupe_raw_limited(merged["supporting_notes"], limit=6, max_len=130)
    merged["limiting_notes"] = _dedupe_raw_limited(merged["limiting_notes"], limit=6, max_len=130)
    return merged


def _infer_listing_density(evidence: Dict[str, Any]) -> str:
    density_score = (
        (int(evidence.get("product_entity_count") or 0) * 1.8)
        + (int(evidence.get("catalog_entity_count") or 0) * 2.0)
        + (int(evidence.get("route_hits") or 0) * 1.2)
        + (int(evidence.get("marketplace_route_hits") or 0) * 1.5)
        + (int(evidence.get("directory_route_hits") or 0) * 1.4)
        + (int(evidence.get("product_candidate_count") or 0) * 0.9)
        + (int(evidence.get("category_phrase_count") or 0) * 0.7)
        + (int(evidence.get("listing_pattern_count") or 0) * 0.8)
    )
    if density_score >= 16:
        return "high"
    if density_score >= 8:
        return "medium"
    if density_score >= 3:
        return "low"
    return "none"


def _infer_breadth(evidence: Dict[str, Any], has_catalog: bool) -> str:
    if not has_catalog:
        return "none"

    richness = (
        (int(evidence.get("product_entity_count") or 0) * 1.7)
        + (int(evidence.get("catalog_entity_count") or 0) * 2.2)
        + (len(evidence.get("product_families") or []) * 1.3)
        + (len(evidence.get("sample_products") or []) * 0.9)
        + (int(evidence.get("route_hits") or 0) * 1.0)
        + (int(evidence.get("marketplace_route_hits") or 0) * 1.2)
        + (int(evidence.get("directory_route_hits") or 0) * 1.1)
        + (int(evidence.get("storefront_marker_count") or 0) * 0.3)
        + (int(evidence.get("marketplace_marker_count") or 0) * 0.5)
    )

    if richness >= 18:
        return "broad"
    if richness >= 9:
        return "medium"
    return "narrow"


def _derive_catalog_mode(evidence: Dict[str, Any], has_catalog: bool) -> str:
    mode_scores = evidence.get("mode_scores") or {}
    storefront_score = float(mode_scores.get("storefront", 0.0))
    marketplace_score = float(mode_scores.get("marketplace", 0.0))
    directory_score = float(mode_scores.get("directory", 0.0))
    brand_score = float(mode_scores.get("brand_catalog", 0.0))

    if not has_catalog and max(storefront_score, marketplace_score, directory_score, brand_score) < 0.9:
        return "unknown"
    if (
        directory_score >= 0.95
        and int(evidence.get("directory_marker_count") or 0) > 0
        and directory_score + 0.10 >= marketplace_score
    ):
        return "directory"
    if marketplace_score >= 1.0 and marketplace_score >= storefront_score + 0.10 and marketplace_score >= brand_score:
        return "marketplace"
    if (
        brand_score >= 0.90
        and int(evidence.get("marketplace_marker_count") or 0) == 0
        and int(evidence.get("directory_marker_count") or 0) == 0
        and brand_score + 0.05 >= storefront_score
    ):
        return "brand_catalog"
    if storefront_score >= 0.75:
        return "storefront"
    if directory_score >= 0.85 and int(evidence.get("directory_marker_count") or 0) > 0:
        return "directory"
    if marketplace_score >= 0.85 and int(evidence.get("marketplace_marker_count") or 0) > 0:
        return "marketplace"
    return "unknown"


def _build_evidence_summary(
    evidence: Dict[str, Any],
    has_catalog: bool,
    catalog_mode: str,
    listing_density: str,
) -> str:
    if not has_catalog:
        opener = "Catalog evidence is limited."
    elif catalog_mode == "marketplace":
        opener = "Marketplace catalog evidence is strong."
    elif catalog_mode == "directory":
        opener = "Directory-style catalog evidence is strong."
    elif catalog_mode == "brand_catalog":
        opener = "Brand-led storefront evidence is strong."
    else:
        opener = "Storefront catalog evidence is strong."

    support_bits: List[str] = []
    if int(evidence.get("product_entity_count") or 0) or int(evidence.get("catalog_entity_count") or 0):
        support_bits.append(
            "structured product/catalog entities="
            f"{int(evidence.get('product_entity_count') or 0)}/{int(evidence.get('catalog_entity_count') or 0)}"
        )
    if int(evidence.get("route_hits") or 0) or int(evidence.get("marketplace_route_hits") or 0):
        support_bits.append(
            "routes="
            f"{int(evidence.get('route_hits') or 0)} commerce, "
            f"{int(evidence.get('marketplace_route_hits') or 0)} marketplace"
        )
    if evidence.get("retail_storefront_signals"):
        support_bits.append(f"storefront cues: {', '.join((evidence.get('retail_storefront_signals') or [])[:3])}")
    if evidence.get("marketplace_signals") and catalog_mode in {"marketplace", "directory"}:
        support_bits.append(f"marketplace cues: {', '.join((evidence.get('marketplace_signals') or [])[:4])}")
    if listing_density != "none":
        support_bits.append(f"listing density={listing_density}")

    parts = [opener]
    if support_bits:
        parts.append(f"Support: {'; '.join(support_bits[:3])}.")
    limiting = _dedupe_raw_limited(evidence.get("limiting_notes") or [], limit=2, max_len=120)
    if limiting:
        parts.append(f"Limits: {' '.join(limiting)}")
    summary = " ".join(_normalize_ws(part) for part in parts if _normalize_ws(part))
    return summary[:600]


def _finalize_catalog_output(evidence: Dict[str, Any]) -> Dict[str, Any]:
    ledger = evidence.get("ledger") or {}
    positive_score = sum(value for value in ledger.values() if value > 0)
    negative_score = abs(sum(value for value in ledger.values() if value < 0))
    listing_density = _infer_listing_density(evidence)

    direct_signal_count = sum(
        [
            1 if int(evidence.get("product_entity_count") or 0) > 0 else 0,
            1 if int(evidence.get("catalog_entity_count") or 0) > 0 else 0,
            1 if int(evidence.get("route_hits") or 0) > 0 else 0,
            1 if int(evidence.get("marketplace_route_hits") or 0) > 0 else 0,
            1 if int(evidence.get("directory_route_hits") or 0) > 0 else 0,
            1 if int(evidence.get("storefront_marker_count") or 0) >= 2 else 0,
            1 if int(evidence.get("pricing_marker_count") or 0) > 0 else 0,
            1 if int(evidence.get("marketplace_marker_count") or 0) > 0 else 0,
            1 if int(evidence.get("directory_marker_count") or 0) > 0 else 0,
            1 if int(evidence.get("product_candidate_count") or 0) > 0 else 0,
            1 if evidence.get("shopify_detected") is True else 0,
        ]
    )

    marketplace_like = bool(
        int(evidence.get("marketplace_marker_count") or 0) >= 2
        or int(evidence.get("marketplace_route_hits") or 0) > 0
        or float((evidence.get("mode_scores") or {}).get("marketplace", 0.0)) >= 0.95
    )
    directory_like = bool(
        int(evidence.get("directory_marker_count") or 0) >= 1
        or int(evidence.get("directory_route_hits") or 0) > 0
        or float((evidence.get("mode_scores") or {}).get("directory", 0.0)) >= 0.95
    )

    has_catalog = (
        (direct_signal_count >= 2 and positive_score >= 0.50)
        or (direct_signal_count >= 3 and positive_score >= 0.40)
        or (
            marketplace_like
            and positive_score >= 0.46
            and (
                int(evidence.get("marketplace_route_hits") or 0) > 0
                or listing_density in {"medium", "high"}
                or int(evidence.get("marketplace_marker_count") or 0) >= 2
            )
        )
    )
    if direct_signal_count == 0:
        has_catalog = False
    if negative_score >= 0.35 and positive_score < 0.80:
        has_catalog = False

    catalog_mode = _derive_catalog_mode(evidence, has_catalog=has_catalog)
    raw_confidence = (
        0.05
        + positive_score
        - negative_score
        + (0.05 if listing_density in {"medium", "high"} else 0.0)
        + (0.04 if catalog_mode in {"marketplace", "directory"} else 0.0)
    )
    confidence = _clamp_float(raw_confidence)
    if has_catalog and confidence < 0.55:
        confidence = 0.55
    if not has_catalog:
        confidence = min(confidence, 0.49)

    category_signals = evidence.get("category_signals") or []
    if not category_signals:
        category_signals = _dedupe_limited(evidence.get("product_families") or [], limit=10, max_len=70)

    payload = {
        "has_catalog": has_catalog,
        "catalog_confidence": confidence,
        "marketplace_like": marketplace_like,
        "directory_like": directory_like,
        "catalog_mode": catalog_mode,
        "listing_density": listing_density,
        "catalog_breadth": _infer_breadth(evidence, has_catalog=has_catalog),
        "product_families": _dedupe_limited(evidence.get("product_families") or [], limit=10, max_len=80),
        "sample_products": _dedupe_limited(evidence.get("sample_products") or [], limit=15, max_len=95),
        "retail_storefront_signals": _dedupe_limited(
            evidence.get("retail_storefront_signals") or [],
            limit=10,
            max_len=45,
        ),
        "marketplace_signals": _dedupe_limited(evidence.get("marketplace_signals") or [], limit=10, max_len=45),
        "pricing_signals": _dedupe_limited(evidence.get("pricing_signals") or [], limit=10, max_len=45),
        "category_signals": _dedupe_limited(category_signals, limit=10, max_len=70),
        "evidence_summary": _build_evidence_summary(
            evidence,
            has_catalog=has_catalog,
            catalog_mode=catalog_mode,
            listing_density=listing_density,
        ),
        "signals_used": _dedupe_raw_limited(evidence.get("signals_used") or [], limit=12, max_len=70),
    }
    return CatalogIntelligenceOutput.model_validate(payload).model_dump()


def catalog_intelligence(state: RelevancyAgentState) -> Dict[str, object]:
    """
    Deterministic catalog/storefront intelligence engine for Tool 5.
    Uses upstream tool outputs only and never calls an LLM.
    """
    default_output = CatalogIntelligenceOutput().model_dump()

    if state.get("collect_blocked") is True or state.get("website_exists") is False:
        return {"catalog_intelligence_output": default_output}

    try:
        shopify_probe = state.get("shopify_probe_output") or {}
        structured = state.get("structured_signals_output") or {}
        clean = state.get("clean_text_output") or {}
        platform = state.get("platform_detection_output") or {}
        collect_sources = state.get("collect_sources_output") or {}
        business_name = str(state.get("business_name") or "")
        category = state.get("category")
        description = state.get("description")
        website = str(state.get("website") or "")

        structured_evidence = _extract_structured_catalog_evidence(structured)
        clean_evidence = _extract_clean_text_catalog_evidence(
            clean=clean,
            business_name=business_name,
            category=category,
            description=description,
            website=website,
        )
        collect_evidence = _extract_collect_source_evidence(collect_sources)
        platform_evidence = _extract_platform_shopify_evidence(platform=platform, shopify_probe=shopify_probe)
        marketplace_evidence = _extract_marketplace_directory_evidence(
            clean=clean,
            collect_sources=collect_sources,
            business_name=business_name,
            category=category,
            description=description,
            website=website,
        )

        merged = _merge_evidence(
            [
                structured_evidence,
                clean_evidence,
                collect_evidence,
                platform_evidence,
                marketplace_evidence,
            ]
        )
        _apply_negative_site_adjustments(
            evidence=merged,
            clean=clean,
            collect_sources=collect_sources,
            business_name=business_name,
            category=category,
            description=description,
            website=website,
        )
        output = _finalize_catalog_output(merged)
        return {"catalog_intelligence_output": output}
    except Exception:
        return {"catalog_intelligence_output": default_output}
