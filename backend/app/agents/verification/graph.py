from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.agents.verification.state import VerificationAgentState


# ------------------------------------------------------------------ #
# Node placeholders                                                   #
# Full implementations will be dropped in during the tool build steps.#
# Each placeholder is a valid LangGraph node: accepts state, returns  #
# a partial dict (or the full state) to be merged by the runtime.    #
# ------------------------------------------------------------------ #

def input_preparation_node(state: VerificationAgentState) -> dict:
    """Normalises and validates inputs received from the runner."""
    return {}


def gatekeeper_node(state: VerificationAgentState) -> dict:
    """
    Lightweight liveness check (HTTP HEAD / GET) + WHOIS domain-age lookup.
    Sets: website_alive, collection_blocked, status_code, final_url, domain_age_years.
    """
    return {}


def site_collector_node(state: VerificationAgentState) -> dict:
    """
    Deep Playwright crawl of homepage + priority sub-pages (/contact, /about, /wholesale …).
    Sets: full_site_text, contact_page_url, domain_canonical.
    """
    return {}


def identity_resolver_node(state: VerificationAgentState) -> dict:
    """
    Deterministic identity cross-check: does the scraped site text match the listed business?
    Sets: company_name_verified, domain_matches_listing, country_detected.
    """
    return {}


def contact_extractor_node(state: VerificationAgentState) -> dict:
    """
    Extracts and validates all contactability signals from full_site_text.
    Sets: emails_found, primary_email, phone_numbers, contact_form_present,
          linkedin_company_url, social_links.
    """
    return {}


def legitimacy_analyzer_node(state: VerificationAgentState) -> dict:
    """
    Detects legitimacy signals: privacy policy, terms, refund policy, physical address.
    Sets: is_real_company, legitimacy_score, wholesale_available, company_type_verified.
    """
    return {}


def size_estimator_node(state: VerificationAgentState) -> dict:
    """
    Best-effort estimation of company size from scraped signals and relevancy artifacts.
    Sets: employee_range, revenue_estimate_band.
    """
    return {}


def metric_analyst_node(state: VerificationAgentState) -> dict:
    """
    Deterministic composite scorer. Aggregates all upstream signals into a
    verification_score (0–100) and initial verification_result bucket.
    No LLM call. Fully reproducible.
    Sets: verification_score, verification_result (initial), legitimacy_score.
    """
    return {}


def risk_flagger_node(state: VerificationAgentState) -> dict:
    """
    Assembles risk_flags from all upstream signals. Runs on EVERY path,
    including dead-site exits, so the DB always has a populated risk_flags list.
    Sets: risk_flags, verification_manual_review.
    """
    return {}


def llm_analyst_node(state: VerificationAgentState) -> dict:
    """
    LLM gap-filler. Only runs after deterministic tools have had their say.
    Fills in fields that couldn't be extracted deterministically:
    company_name_verified (if still None), employee_range, revenue_estimate_band,
    and refines verification_result / verification_score if the LLM finds
    disqualifying or upgrading evidence.
    Sets: evidence_summary, and may update verification_result / verification_score.
    """
    return {}


def final_contract_builder_node(state: VerificationAgentState) -> dict:
    """
    Validates the populated state against VerificationFinalContract (Pydantic).
    On validation failure: sets verification_result="failed", is_finalized=False.
    On success: sets is_finalized=True.
    This node never writes to the DB — that is the runner's responsibility.
    """
    return {}


# ------------------------------------------------------------------ #
# Routing                                                             #
# ------------------------------------------------------------------ #

def _route_after_gatekeeper(state: VerificationAgentState) -> str:
    """
    Single deterministic branch point.
    Dead or blocked sites skip straight to risk_flagger so they always get
    a structured (if minimal) output — never silent NULL columns.
    """
    if state.get("website_alive") is False:
        return "risk_flagger"
    return "site_collector"


# ------------------------------------------------------------------ #
# Graph assembly                                                      #
# ------------------------------------------------------------------ #

workflow = StateGraph(VerificationAgentState)

# --- Register nodes ---
workflow.add_node("input_preparation",      input_preparation_node)
workflow.add_node("gatekeeper",             gatekeeper_node)
workflow.add_node("site_collector",         site_collector_node)
workflow.add_node("identity_resolver",      identity_resolver_node)
workflow.add_node("contact_extractor",      contact_extractor_node)
workflow.add_node("legitimacy_analyzer",    legitimacy_analyzer_node)
workflow.add_node("size_estimator",         size_estimator_node)
workflow.add_node("metric_analyst",         metric_analyst_node)
workflow.add_node("risk_flagger",           risk_flagger_node)
workflow.add_node("llm_analyst",            llm_analyst_node)
workflow.add_node("final_contract_builder", final_contract_builder_node)

# --- Entry ---
workflow.set_entry_point("input_preparation")

# --- Linear: input_preparation → gatekeeper ---
workflow.add_edge("input_preparation", "gatekeeper")

# --- Branch: gatekeeper → site_collector OR risk_flagger ---
workflow.add_conditional_edges(
    "gatekeeper",
    _route_after_gatekeeper,
    {
        "site_collector": "site_collector",
        "risk_flagger":   "risk_flagger",
    },
)

# --- Happy path: full evidence pipeline ---
workflow.add_edge("site_collector",      "identity_resolver")
workflow.add_edge("identity_resolver",   "contact_extractor")
workflow.add_edge("contact_extractor",   "legitimacy_analyzer")
workflow.add_edge("legitimacy_analyzer", "size_estimator")
workflow.add_edge("size_estimator",      "metric_analyst")
workflow.add_edge("metric_analyst",      "risk_flagger")

# --- risk_flagger merges both paths → LLM → contract → END ---
workflow.add_edge("risk_flagger",            "llm_analyst")
workflow.add_edge("llm_analyst",             "final_contract_builder")
workflow.add_edge("final_contract_builder",  END)

# --- Compile ---
verification_graph = workflow.compile()
# --- Compile ---
verification_graph = workflow.compile()

# ADD THESE 3 LINES AT THE VERY BOTTOM:
def build_verification_graph():
    """Returns the compiled verification graph for the runner."""
    return verification_graph