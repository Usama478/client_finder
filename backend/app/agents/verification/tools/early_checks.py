import whois
import requests
from datetime import datetime
from typing import Dict, Any
from app.agents.verification.state import VerificationAgentState

# Real browser header to avoid getting blocked immediately
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def fetch_website_status(state: VerificationAgentState) -> Dict[str, Any]:
    """
    Checks if the website is actually online (Status 200).
    """
    url = state.get("website")
    if not url: return {"website_alive": False}
    
    # Fix URL if missing http
    if not url.startswith("http"): url = f"https://{url}"
    
    try:
        # Timeout set to 10s to fail fast
        response = requests.get(url, headers=HEADERS, timeout=10)
        is_alive = response.status_code < 400
        print(f"   🌐 STATUS CHECK: {url} -> {response.status_code} ({'Alive' if is_alive else 'Dead'})")
        return {"website_alive": is_alive}
    except Exception as e:
        print(f"   ❌ STATUS CHECK FAILED: {e}")
        return {"website_alive": False}

def domain_age_check(state: VerificationAgentState) -> Dict[str, Any]:
    """
    Uses WHOIS to find the real age of the domain.
    Old domains (5+ years) are trustworthy. New domains (<1 year) are risky.
    """
    url = state.get("website")
    if not url: return {"domain_age_years": 0}
    
    # Extract just the domain (e.g., "kith.com" from "https://kith.com/shop")
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    
    try:
        w = whois.whois(domain)
        creation_date = w.creation_date
        
        # Sometimes WHOIS returns a list of dates; take the first one
        if isinstance(creation_date, list):
            creation_date = creation_date[0]
            
        if creation_date:
            year = creation_date.year
            current_year = datetime.now().year
            age = current_year - year
            print(f"   📅 DOMAIN AGE: {domain} is {age} years old.")
            return {"domain_age_years": age}
            
    except Exception as e:
        print(f"   ⚠️ WHOIS FAILED: {e}")
        
    return {"domain_age_years": 0}