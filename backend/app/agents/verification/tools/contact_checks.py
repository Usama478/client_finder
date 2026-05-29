import logging
import re
import dns.resolver
from typing import Dict, Any, List, Set
from app.agents.verification.state import VerificationAgentState

logger = logging.getLogger(__name__)

# Common junk patterns to filter out
JUNK_PATTERNS = [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", 
    "sentry", "wixpress", "example.com", "yourdomain", "email.com", 
    "noreply", "no-reply", "donotreply", "test@", "user@", "admin@"
]

# Major providers where we can skip MX lookup to save time
MAJOR_PROVIDERS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", 
    "icloud.com", "aol.com", "protonmail.com", "zoho.com"
]

def check_mx_record(domain: str) -> bool:
    """
    Checks if the domain has a valid Mail Exchange (MX) record.
    Returns True if MX records exist, False otherwise.
    """
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        return bool(answers)
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.Timeout, Exception):
        return False

def is_junk_email(email: str) -> bool:
    """
    Returns True if the email matches known junk patterns or invalid structure.
    """
    email_lower = email.lower()
    
    # 1. Check patterns
    if any(junk in email_lower for junk in JUNK_PATTERNS):
        return True
        
    # 2. Check length (too short or suspiciously long)
    if len(email) < 6 or len(email) > 100:
        return True
        
    # 3. Double check structure (basic)
    parts = email.split('@')
    if len(parts) != 2:
        return True
        
    domain = parts[1]
    if '.' not in domain:
        return True
        
    return False

def run_contact_hunter(state: VerificationAgentState) -> Dict[str, Any]:
    """
    CONTACT HUNTER MODULE
    1. Extracts emails using Regex from full site text.
    2. Cleans and filters junk emails.
    3. Validates domain existence via DNS MX records (skipping major providers).
    4. Deduplicates and formats social links.
    """
    text = state.get("full_site_text") or ""
    
    # --- 1. Regex Extraction ---
    # Robust pattern for emails
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    raw_emails = re.findall(email_pattern, text)
    
    # --- 2. Cleaning & Deduplication ---
    unique_candidates: Set[str] = set()
    for email in raw_emails:
        email = email.strip().lower() # Normalize
        if not is_junk_email(email):
            unique_candidates.add(email)
            
    # --- 3. DNS Validation ---
    valid_emails = []
    logger.info("CONTACT HUNTER: validating %d candidates", len(unique_candidates))
    
    for email in unique_candidates:
        domain = email.split('@')[-1]
        
        # Optimization: fast-track major providers
        if domain in MAJOR_PROVIDERS:
            valid_emails.append(email)
            continue
            
        # DNS Check
        if check_mx_record(domain):
            valid_emails.append(email)
        else:
            logger.warning("CONTACT HUNTER: dropped %s — no MX records for %s", email, domain)

    # --- 4. Social Link Audit ---
    # We assume 'deep_checks' might have populated this, but let's re-verify from state or dedupe
    social_links_in = state.get("social_links") or []
    
    # If deep_checks didn't run or found nothing, we can try a quick regex fallback on text?
    # But usually deep_checks is better. Let's just dedupe and clean what we have.
    # Also, the prompt says "ensure any social media URLs are deduplicated"
    
    clean_socials = sorted(list(set(social_links_in)))
    
    return {
        "emails_found": sorted(valid_emails),
        "email_valid": len(valid_emails) > 0,
        "social_links": clean_socials 
    }
