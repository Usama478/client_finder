import re
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from typing import Dict, Any
from app.agents.verification.state import VerificationAgentState

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def scrape_full_website(state: VerificationAgentState) -> Dict[str, Any]:
    """
    SMART SCRAPER:
    1. Loads page with Playwright (JS enabled).
    2. Extracts 'mailto:' links (Hidden Emails) BEFORE cleaning.
    3. extracts text.
    4. Merges them so the regex can find the emails.
    """
    url = state.get("website")
    if not url: return {"full_site_text": ""}
    
    if not url.startswith("http"): url = f"https://{url}"
    
    print(f"   🕷️  PLAYWRIGHT: Booting browser for {url}...")
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=USER_AGENT)
            page = context.new_page()
            
            try:
                page.goto(url, timeout=30000, wait_until="domcontentloaded")
            except Exception as e:
                print(f"      ⚠️ Page load timed out (partial load): {e}")

            html_content = page.content()
            browser.close()
            
            soup = BeautifulSoup(html_content, "html.parser")
            
            # --- STEP 1: EXTRACT HIDDEN DATA ---
            hidden_emails = []
            # Find all links that start with "mailto:"
            for a in soup.find_all('a', href=True):
                if "mailto:" in a['href']:
                    # Clean the link (remove ?subject=... etc)
                    email = a['href'].replace("mailto:", "").split("?")[0]
                    hidden_emails.append(email)
            
            # --- STEP 2: CLEAN HTML ---
            for tag in soup(["script", "style", "noscript", "svg", "header", "footer"]): 
                tag.decompose()
                
            text = soup.get_text(" ", strip=True)
            
            # --- STEP 3: MERGE DATA ---
            # We add the hidden emails to the text so the Regex tool can find them later
            if hidden_emails:
                final_text = text + " | [SYSTEM: HIDDEN EMAILS FOUND]: " + ", ".join(hidden_emails)
            else:
                final_text = text
            
            print(f"   ✅  PLAYWRIGHT: Success! Extracted {len(text)} chars + {len(hidden_emails)} hidden emails.")
            return {"full_site_text": final_text[:15000]}

    except Exception as e:
        print(f"   ❌ PLAYWRIGHT FAILED: {e}")
        return {"full_site_text": ""}

# --- The other functions remain the same ---
def address_validation(state: VerificationAgentState) -> Dict[str, Any]:
    address = state.get("address") or ""
    text = (state.get("full_site_text") or "").lower()
    address_lower = address.lower()
    
    business_keywords = ['suite', 'office', 'floor', 'building', 'corp', 'inc', 'ltd', 'company', 'plaza', 'industrial', 'zone', 'warehouse', 'shop', 'store', 'mall', 'center']
    residential_keywords = ['apt', 'apartment', 'house', 'residence', 'home', 'villa', 'condo', 'flat', 'unit', 'room', 'townhouse']
    
    if any(re.search(r'\b' + re.escape(k) + r'\b', address_lower) for k in business_keywords):
        return {"address_validation": "Commercial"}
        
    if any(re.search(r'\b' + re.escape(k) + r'\b', address_lower) for k in residential_keywords):
        return {"address_validation": "Residential"}

    if any(k in text for k in ["industrial area", "factory", "manufacturing unit", "headquarters"]):
        return {"address_validation": "Commercial (Inferred)"}

    return {"address_validation": "Unknown"}

def traffic_check(state: VerificationAgentState) -> Dict[str, Any]:
    return {"traffic_level": "Medium"}

def business_legitimacy_check(state: VerificationAgentState) -> Dict[str, Any]:
    text = (state.get("full_site_text") or "").lower()
    signals = {
        "has_about": "about" in text,
        "has_contact": "contact" in text or "touch" in text,
        "has_privacy": "privacy" in text,
        "has_returns": "return" in text or "refund" in text,
        "appearance_valid": len(text) > 500 
    }
    return {"legitimacy_signals": signals}