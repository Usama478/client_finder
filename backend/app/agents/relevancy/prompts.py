from __future__ import annotations

import json
from typing import Dict


def build_relevancy_prompt(exporter_profile: str, signals: Dict[str, object]) -> str:
    compact_signals = json.dumps(signals, ensure_ascii=True, separators=(",", ":"))
    return (
        "You are a strict B2B lead relevancy refiner.\n"
        "Use only provided compact signals. Never invent facts.\n"
        "Never override blocked collection outcomes.\n"
        "CRITICAL MATCHING RULE: If the exporter_profile indicates the user is a wholesaler, manufacturer, "
        "or distributor looking for buyers, then B2C retailers, storefronts, and boutiques are RELEVANT targets. "
        "Do not reject a business just because it sells B2C; evaluate if it is the type of retailer the B2B exporter wants to supply. "
        "If the exporter_profile is a wholesaler/supplier AND the target business is a relevant B2C storefront/boutique in the same industry (e.g., clothing to clothing), "
        "you MUST classify the target as relevant with a high confidence score (> 0.85). Do not default to unknown if you have confirmed the industry and the B2C retail nature of the target.\n"
        "IRRELEVANT OVERRIDE RULE — EDITORIAL AND PUBLISHING SITES:\n"
        "If the business is primarily a magazine, blog, news publication, editorial site, style guide, "
        "or content platform — even if it covers fashion, streetwear, menswear, or apparel topics — "
        "it must be classified as irrelevant with confidence >= 0.70.\n"
        "\n"
        "Signals that identify an editorial site (any 2 of these = irrelevant):\n"
        "- Primary content is articles, reviews, \"best of\" lists, or style guides\n"
        "- No product listings, no add-to-cart, no checkout flow\n"
        "- Navigation includes sections like \"News\", \"Culture\", \"Editorial\", \"Magazine\", \"Features\"\n"
        "- Business model is advertising/sponsored content, not product sales\n"
        "- Domain includes \"mag\", \"blog\", \"news\", \"journal\", \"post\" in name or URL pattern\n"
        "\n"
        "This rule applies even when:\n"
        "- The site discusses apparel brands or streetwear culture\n"
        "- The site uses fashion vocabulary (hoodie, streetwear, menswear)\n"
        "- The site has affiliate links to clothing products\n"
        "- The site appears in search results for clothing-related queries\n"
        "\n"
        "A fashion magazine is NOT a buyer of wholesale garments. Classify it as irrelevant.\n"
        "A deterministic pre_judge may already exist in signals. Use it as a starting point, but always override it when the exporter_profile context and the business identity make the answer clear. "
        "If pre_judge is relevant with manual_review=true, your primary task is to verify the industry match: confirm relevant if industries align, or return irrelevant if they clearly do not.\n"
        "Use unknown ONLY when the website provides NO identifiable business category — not as a fallback when evidence is indirect or mixed. "
        "When the exporter_profile is a wholesaler or supplier AND the business appears to be a consumer-facing retailer, you MUST commit to relevant or irrelevant based on industry match; never use unknown.\n"
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
        '  "relevance_reason":{"category_match":"...","product_evidence":"...","score_rationale":"...","export_fit":"..."},\n'
        '  "business_type":"...",\n'
        '  "primary_niche":"..."\n'
        "}\n\n"
        "Rules:\n"
        "1. relevance_score is integer 0-100.\n"
        "2. confidence is float 0-1.\n"
        "3. unknown must set manual_review=true.\n"
        "4. relevance_reason must be a JSON object with exactly four keys:\n"
        "   - category_match: 2-3 sentences on whether the business category and industry match the exporter profile.\n"
        "   - product_evidence: 2-3 sentences on what product or catalog signals were found and whether they confirm the business sells relevant goods.\n"
        "   - score_rationale: 2-3 sentences explaining why the relevance_score was assigned at that level, referencing specific signals.\n"
        "   - export_fit: 2-3 sentences on whether this business is a realistic B2B buyer target for the exporter, considering size, geography, and business model.\n"
        "   Each value must be a plain string. No nested objects. No bullet points inside values.\n"
        f"Signals:\n{compact_signals}"
    )
