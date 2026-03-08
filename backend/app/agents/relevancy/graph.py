from langgraph.graph import END, StateGraph

from app.agents.relevancy.nodes import (
    catalog_intelligence_node,
    business_model_intelligence_node,
    collect_page_sources_node,
    detect_platform_node,
    end_irrelevant_node,
    extract_clean_text_and_sections_node,
    extract_structured_signals_node,
    finalize_manual_review_node,
    llm_relevance_judge_node,
    shopify_probe_node,
)
from app.agents.relevancy.state import RelevancyAgentState


def _route_after_collect(state: RelevancyAgentState) -> str:
    if state.get("collect_blocked") is True:
        return "finalize_manual_review"
    if state.get("website_exists") is False:
        return "end_irrelevant"
    return "extract_structured_signals"


def _route_after_structured(state: RelevancyAgentState) -> str:
    structured = state.get("structured_signals_output") or {}
    signal_strength = structured.get("structured_signal_strength") or state.get("structured_signal_strength")
    has_catalog = structured.get("structured_has_product_catalog")
    if has_catalog is None:
        has_catalog = state.get("structured_has_product_catalog")

    if signal_strength == "strong" and has_catalog is True:
        existing = state.get("signals_used") or []
        used = [str(item).strip() for item in existing if str(item).strip()]
        if "structured.strong_signal" not in used:
            used.append("structured.strong_signal")
        state["signals_used"] = used[:12]
        return "catalog_intelligence"
    return "extract_clean_text_and_sections"


def _route_after_platform(state: RelevancyAgentState) -> str:
    if state.get("collect_blocked") is True:
        return "finalize_manual_review"
    if state.get("should_run_shopify_probe") is True:
        return "shopify_probe"
    return "catalog_intelligence"


workflow = StateGraph(RelevancyAgentState)

workflow.add_node("collect_page_sources", collect_page_sources_node)
workflow.add_node("extract_structured_signals", extract_structured_signals_node)
workflow.add_node("extract_clean_text_and_sections", extract_clean_text_and_sections_node)
workflow.add_node("detect_platform", detect_platform_node)
workflow.add_node("shopify_probe", shopify_probe_node)
workflow.add_node("catalog_intelligence", catalog_intelligence_node)
workflow.add_node("business_model_intelligence", business_model_intelligence_node)
workflow.add_node("llm_relevance_judge", llm_relevance_judge_node)
workflow.add_node("end_irrelevant", end_irrelevant_node)
workflow.add_node("finalize_manual_review", finalize_manual_review_node)

workflow.set_entry_point("collect_page_sources")
workflow.add_conditional_edges(
    "collect_page_sources",
    _route_after_collect,
    {
        "finalize_manual_review": "finalize_manual_review",
        "end_irrelevant": "end_irrelevant",
        "extract_structured_signals": "extract_structured_signals",
    },
)
workflow.add_conditional_edges(
    "extract_structured_signals",
    _route_after_structured,
    {
        "catalog_intelligence": "catalog_intelligence",
        "extract_clean_text_and_sections": "extract_clean_text_and_sections",
    },
)
workflow.add_edge("extract_clean_text_and_sections", "detect_platform")
workflow.add_conditional_edges(
    "detect_platform",
    _route_after_platform,
    {
        "finalize_manual_review": "finalize_manual_review",
        "shopify_probe": "shopify_probe",
        "catalog_intelligence": "catalog_intelligence",
    },
)

workflow.add_edge("shopify_probe", "catalog_intelligence")
workflow.add_edge("catalog_intelligence", "business_model_intelligence")
workflow.add_edge("business_model_intelligence", "llm_relevance_judge")
workflow.add_edge("llm_relevance_judge", END)
workflow.add_edge("end_irrelevant", END)
workflow.add_edge("finalize_manual_review", END)

# Keep symbol name for API import compatibility.
relevancy_graph = workflow.compile()
