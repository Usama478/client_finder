import re
import dns.resolver
from typing import Dict, Any, List
from app.agents.verification.state import VerificationAgentState

def has_mx_record(domain: str) -> bool:
    """
    Checks if the domain has a valid mail server.
    """
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        return len(answers) > 0
    except Exception:
        return False

def email_extraction(state: VerificationAgentState) -> Dict[str, Any]:
    text = state.get("full_site_text") or ""
    
    # DEBUG PRINT: Check if the hidden emails are actually in the text
    if "HIDDEN EMAILS FOUND" in text:
        print(f"      👀 DEBUG: Text contains hidden emails section.")
    
    # Relaxed Regex to catch more formats
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    raw_emails = re.findall(email_pattern, text)
    
    # DEBUG PRINT: See what Regex found
    if len(raw_emails) > 0:
        print(f"      👀 DEBUG: Regex matched these raw strings: {raw_emails}")
    else:
        print("      ⚠️ DEBUG: Regex found NOTHING. The formatting might be broken.")

    unique_emails = list(set(raw_emails))
    
    clean_emails = []
    for email in unique_emails:
        # Filter junk
        if any(x in email.lower() for x in ['.png', '.jpg', '.jpeg', 'sentry', 'example.com', 'wixpress']):
            continue
        if len(email) < 50:
            clean_emails.append(email)
            
    return {"emails_found": clean_emails}

def email_validation(state: VerificationAgentState) -> Dict[str, Any]:
    emails = state.get("emails_found") or []
    valid_emails = []
    
    print(f"   📧 VALIDATING {len(emails)} EMAILS...")
    
    for email in emails:
        try:
            domain = email.split('@')[-1]
            # We skip MX check if it's a known reliable domain (gmail, etc) to save time
            if any(x in domain for x in ['gmail', 'yahoo', 'outlook']):
                valid_emails.append(email)
                continue
                
            if has_mx_record(domain):
                valid_emails.append(email)
            else:
                print(f"      ⚠️ Dropped {email}: No Mail Server for {domain}")
        except:
            continue
            
    return {
        "emails_found": valid_emails, 
        "email_valid": len(valid_emails) > 0
    }

def social_link_verification(state: VerificationAgentState) -> Dict[str, Any]:
    text = (state.get("full_site_text") or "").lower()
    links = []
    for platform in ["linkedin.com", "facebook.com", "instagram.com", "twitter.com"]:
        if platform in text: links.append(platform)
    return {"social_links": links}