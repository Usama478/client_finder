import whois
import requests
from datetime import datetime
from typing import Dict, Any
from urllib.parse import urlparse
from app.agents.verification.state import VerificationAgentState

# Real browser header to avoid getting blocked immediately
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def fetch_website_status(state: VerificationAgentState) -> Dict[str, Any]:
    """
    Checks if the website is actually online (Status < 400).
    Uses a strict 10s timeout to fail fast.
    """
    url = state.get("website")
    if not url: 
        return {"website_alive": False}
    
    # Ensure URL has schema
    if not url.startswith("http"): 
        url = f"https://{url}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        # Consider alive if status code is less than 400 (2xx, 3xx)
        is_alive = response.status_code < 400
        return {"website_alive": is_alive}
    except Exception:
        # Catch connection errors, timeouts, SSL errors, etc.
        return {"website_alive": False}

def domain_age_check(state: VerificationAgentState) -> Dict[str, Any]:
    """
    Uses WHOIS to find the domain age in years.
    Returns 0 if lookup fails or domain not found.
    """
    url = state.get("website")
    if not url: 
        return {"domain_age_years": 0}
    
    # Extract root domain (e.g. "example.com" from "https://www.example.com/foo")
    try:
        if not url.startswith("http"):
            url = f"https://{url}"
        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "")
        if not domain:
            # Fallback if parsing fails or url was just "example.com"
             domain = url.replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "")
    except Exception:
        return {"domain_age_years": 0}

    try:
        w = whois.whois(domain)
        creation_date = w.creation_date
        
        # Handle list of dates (sometimes WHOIS returns a list)
        if isinstance(creation_date, list):
            creation_date = creation_date[0]
            
        if creation_date:
            # Handle string dates if the library considers them so (edge case), 
            # but usually it's a datetime object.
            if isinstance(creation_date, str):
                # Attempt parse if it's a string, though whois usually returns datetime
                try:
                    creation_date = datetime.strptime(creation_date, "%Y-%m-%d %H:%M:%S") # Common format
                except:
                    return {"domain_age_years": 0}

            year = creation_date.year
            current_year = datetime.now().year
            age = current_year - year
            return {"domain_age_years": max(0, age)} # Ensure no negative age
            
    except Exception:
        pass
        
    return {"domain_age_years": 0}

def run_gatekeeper_checks(state: VerificationAgentState) -> Dict[str, Any]:
    """
    Orchestrator for pure Python gatekeeper checks.
    1. Check if website is alive.
    2. If alive, check domain age.
    3. If dead, return immediately to save time.
    """
    # 1. Check Status
    status_result = fetch_website_status(state)
    
    if not status_result["website_alive"]:
        # Website is dead, skip WHOIS and return failure
        return {
            "website_alive": False,
            "domain_age_years": 0
        }
        
    # 2. Check Domain Age (only if alive)
    age_result = domain_age_check(state)
    
    # Merge results
    return {**status_result, **age_result}
