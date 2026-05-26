import json
import logging
from langchain_openai import ChatOpenAI
from app.agents.verification.state import VerificationAgentState

logger = logging.getLogger(__name__)

def run_llm_analyst(state: VerificationAgentState) -> dict:
    """
    LLM-powered Trust & Safety Auditor.
    Analyzes gathered evidence to semantically validate if the business is a real, functioning B2B brand.
    """
    logger.debug("   🤖 LLM Analyst: Auditing business legitimacy...")

    # 1. Prepare Context
    domain_age = state.get("domain_age_years", "Unknown")
    socials = state.get("social_links", [])
    signals = state.get("legitimacy_signals", {})
    emails = state.get("emails_found", [])
    
    # Truncate text to avoid token limits, focused on the beginning where descriptions usually are
    raw_text = state.get("full_site_text", "") or ""
    site_text_sample = raw_text[:5000].replace("\n", " ")

    evidence_block = f"""
    DOMAIN AGE: {domain_age} years
    SOCIAL LINKS: {', '.join(socials) if socials else 'None'}
    LEGITIMACY SIGNALS: {json.dumps(signals)}
    EMAILS FOUND: {', '.join(emails) if emails else 'None'}
    WEBSITE CONTENT SAMPLE (First 5000 chars):
    {site_text_sample}
    """

    custom_prompt = state.get("custom_prompt")

    # 2. Initialize LLM
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        model_kwargs={"response_format": {"type": "json_object"}}
    )

    # 3. Construct Prompt
    base_instructions = f"""
    You are a Trust & Safety Auditor for a B2B Vetting Pipeline.
    Your job is to determine if this business is a LEGITIMATE, OPERATING B2B COMPANY based on the evidence provided.

    CONTEXT:
    We have scraped their website and external signals. rigid tools often miss context (e.g. they don't see an address buried in text, or they flag a valid brand as 'suspicious' because it's new).
    
    YOUR MISSION:
    Read the 'WEBSITE CONTENT SAMPLE' and 'EVIDENCE' semantically.
    - Does the text sound like a real business? (Professional language, clear services, valid physical presence mentioned?)
    - Do the signals (socials, emails, domain age) back this up?
    - Catch implied risks: generic "Lorem Ipsum" text, gambling keywords, parked domain templates, or suspicious incoherence.
    """

    if custom_prompt:
        base_instructions += f"\n\nCRITICAL CONTEXT CRITERIA TO ENFORCE:\n{custom_prompt}\n"

    prompt = f"""
    {base_instructions}

    EVIDENCE:
    {evidence_block}

    OUTPUT INSTRUCTIONS:
    Return a valid JSON object with these exact keys:
    - verification_score (int 0-100): 
        - 0-20: Obvious scam, parked domain, or junk.
        - 21-50: Weak signals, looks incomplete or abandoned.
        - 51-79: Probable business, but missing key trust markers (like address or professional email).
        - 80-100: High confidence. Established domain, clear B2B footprint, professional presence.
    - risk_flags (list of strings): Any concerns found (e.g. "No physical address found in text", "Domain too new", "Generic content").
    - evidence_summary (string): A concise (1-2 sentences) explanation of your score. Be specific about what you read.

    JSON OUTPUT:
    """

    messages = [
        ("system", "You are a specialized B2B Verification Auditor. You output strict JSON."),
        ("user", prompt)
    ]

    try:
        # --- 🔎 DEBUG: WHAT THE LLM SEES ---
        logger.debug("\n" + "="*50)
        logger.debug("🧠 DEBUG: WHAT WAS SENT TO THE LLM (EVIDENCE)")
        logger.debug("="*50)
        logger.debug(evidence_block)
        
        # 4. Invoke LLM
        response = llm.invoke(messages)
        content = str(response.content)
        
        # --- 🔎 DEBUG: WHAT THE LLM REPLIED ---
        logger.debug("\n" + "="*50)
        logger.debug("🤖 DEBUG: WHAT THE LLM REPLIED (RAW JSON)")
        logger.debug("="*50)
        logger.debug(content)
        logger.debug("="*50 + "\n")

        data = json.loads(content)

        score = data.get("verification_score", 0)
        flags = data.get("risk_flags", [])
        summary = data.get("evidence_summary", "Analysis failed to generate summary.")

        logger.debug(f"   ✅ LLM Analysis Complete. Score: {score}")

        return {
            "verification_score": score,
            "risk_flags": flags,
            "evidence_summary": summary,
            "is_finalized": True
        }

    except Exception as e:
        logger.debug(f"   ❌ LLM Analyst Failed: {e}")
        return {
            "verification_score": 0,
            "risk_flags": ["LLM Analysis Failed", str(e)],
            "evidence_summary": "Manual review required due to system error.",
            "is_finalized": True
        }
