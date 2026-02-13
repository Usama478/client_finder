from typing import Dict, Any, List
from app.agents.verification.state import VerificationAgentState

def run_metric_analyst(state: VerificationAgentState) -> Dict[str, Any]:
    """
    DETERMINISTIC ANALYST:
    Calculates a verification score based on hard evidence collected by previous tools.
    Returns: Score (0-100), Risk Flags, Evidence Summary, and Final Status.
    """
    score = 0
    flags = []
    evidence = []
    
    # 1. Domain Age (Max 20 pts)
    age = state.get("domain_age_years") or 0
    if age > 0:
        age_score = min(20, age * 2) # 2 pts per year up to 10 years
        score += age_score
        evidence.append(f"Domain is {age} years old (+{age_score})")
    else:
        flags.append("Domain is very new or age unknown")

    # 2. Website Status (Max 20 pts)
    if state.get("website_alive"):
        score += 20
        evidence.append("Website is active and reachable (+20)")
    else:
        flags.append("Website is unreachable or dead")
        # If dead, score stays low, but graph should have stopped anyway.

    # 3. Legitimacy Signals (Max 30 pts)
    signals = state.get("legitimacy_signals") or {}
    if signals.get("has_privacy_policy"):
        score += 10
        evidence.append("Privacy Policy found (+10)")
    if signals.get("has_terms"):
        score += 10
        evidence.append("Terms of Service found (+10)")
    if signals.get("has_refund_policy"):
        score += 10
        evidence.append("Refund Policy found (+10)")
    
    # 4. Social Presence (Max 15 pts)
    socials = state.get("social_links") or []
    if socials:
        social_score = min(15, len(socials) * 5)
        score += social_score
        evidence.append(f"Found {len(socials)} social profiles (+{social_score})")
    else:
        flags.append("No social media profiles found")

    # 5. Contact Info (Max 15 pts)
    emails = state.get("emails_found") or []
    if emails:
        score += 15
        evidence.append(f"Found {len(emails)} valid emails (+15)")
    else:
        flags.append("No valid business emails found")
        
    # 6. Address (Bonus 10 pts)
    address = state.get("address")
    if address and len(address) > 10:
        score += 10
        evidence.append("Physical address detected (+10)")

    # Normalize Score (Cap at 100)
    final_score = min(100, score)
    
    # Summary
    summary_text = f"Verified with Score {final_score}/100. " + "; ".join(evidence) + "."
    
    return {
        "verification_score": final_score,
        "risk_flags": flags,
        "evidence_summary": summary_text,
        "manual_review": final_score < 50, # Flag for review if score is low
        "is_finalized": True
    }
