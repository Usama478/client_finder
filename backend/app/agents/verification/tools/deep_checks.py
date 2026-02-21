import re
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from typing import Dict, Any, List
from app.agents.verification.state import VerificationAgentState

# Real browser header + stealthy config
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"

def extract_emails_from_text(text: str) -> set:
    text = re.sub(r'\[at\]|\(at\)|\{at\}|\s+at\s+', '@', text, flags=re.IGNORECASE)
    text = re.sub(r'\[dot\]|\(dot\)|\bdot\b', '.', text, flags=re.IGNORECASE)
    return set(re.findall(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text))

def score_and_sort_emails(emails: set) -> list:
    high_priority = {"sales", "info", "contact", "hello", "partners", "wholesale", "press"}
    low_priority = {"privacy", "careers", "jobs", "noreply", "support", "legal"}
    
    scored_emails = []
    for email in emails:
        local_part = email.split('@')[0].lower()
        score = 0
        if any(p in local_part for p in high_priority):
            score += 10
        elif any(p in local_part for p in low_priority):
            score -= 10
        scored_emails.append((score, email))
        
    scored_emails.sort(key=lambda x: x[0], reverse=True)
    return [e[1] for e in scored_emails]

def run_trust_scanner(state: VerificationAgentState) -> Dict[str, Any]:
    """
    DEEP TRUST SCANNER (Deterministic & Architectural)
    1. Launches Playwright (Single Session).
    2. Extracts Deep Evidence:
       - Full Text + Hidden Emails (mailto:)
       - Real Social Links (hrefs to fb/linkedin/instagram)
       - Policy Links (Privacy, Terms, Refund)
       - Raw Address String (from footers/contact)
    """
    url = state.get("website")
    if not url: 
        return {
            "full_site_text": "", 
            "social_links": [], 
            "legitimacy_signals": {}, 
            "address": ""
        }
    
    if not url.startswith("http"): 
        url = f"https://{url}"
        
    print(f"   🕵️‍♀️ TRUST SCANNER: Scanning {url}...")

    try:
        with sync_playwright() as p:
            # Launch with anti-bot arguments
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--disable-infobars", "--window-size=1920,1080", "--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"]
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080}
            )
            page = context.new_page()
            
            # Stealth: Add init script to mask webdriver
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

            try:
                # 30s timeout, wait for domcontentloaded is usually enough for static data
                # We can also wait for networkidle if needed, but it might hang on trackers.
                page.goto(url, timeout=30000, wait_until="domcontentloaded")
                page.wait_for_timeout(3000)
            except Exception as e:
                print(f"      ⚠️ Page load warning: {e}")
                # Continue anyway, we might have partial content

            content = page.content()
            
            # --- PARSE CONTENT ---
            soup = BeautifulSoup(content, "html.parser")
            
            # 1. Extract Hidden Emails (mailto:)
            hidden_emails = set()
            for a in soup.find_all('a', href=True):
                href = a['href']
                if href.lower().startswith("mailto:"):
                    email = href.replace("mailto:", "").split("?")[0].strip()
                    if "@" in email:
                        hidden_emails.add(email)

            # 2. Extract Social Links (Actual hrefs)
            social_domains = ["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "youtube.com", "pinterest.com"]
            social_links = set()
            for a in soup.find_all('a', href=True):
                href = a['href'].lower()
                if any(d in href for d in social_domains):
                     # Simple clean: ensure it's http
                     if href.startswith("//"): href = "https:" + href
                     if href.startswith("http"):
                         social_links.add(a['href']) # Keep original case for URL

            # 3. Legitimacy Signals (Policy Links)
            text_lower = soup.get_text(" ", strip=True).lower()
            # Also check hrefs specifically for strong signals
            all_hrefs = [a['href'].lower() for a in soup.find_all('a', href=True)]
            
            signals = {
                "has_privacy_policy": any("privacy" in h for h in all_hrefs) or "privacy policy" in text_lower,
                "has_terms": any("terms" in h for h in all_hrefs) or "terms of service" in text_lower or "terms & conditions" in text_lower,
                "has_refund_policy": any("refund" in h or "return" in h for h in all_hrefs) or "refund policy" in text_lower,
            }

            # 4. Extract Raw Address
            # heuristic: look for address text in footer or contact sections
            address_candidate = ""
            # Priority: <address> tag
            address_tags = soup.find_all("address")
            if address_tags:
                address_candidate = address_tags[0].get_text(" ", strip=True)
            else:
                # Fallback: finding text near keywords like "Address:", "Location:" in footer
                # checking footer tags
                footer = soup.find("footer")
                if footer:
                    footer_text = footer.get_text(" ", strip=True)
                    # Very naive extraction, just grabbing a chunk if it looks like an address? 
                    # The prompt asks for "Raw address text". 
                    # Let's try to simple logic: match a common pattern or just leave it empty if no strict tag?
                    # "Extract the raw address text (usually from footers/contact sections)"
                    # I'll try to find a block containing "Street", "Ave", "Rd" or digits + words. 
                    # For now, let's look for a specific container since we want high precision?
                    # Actually, let's keep it simple: Regex for Zip codes?
                    # Or just return empty if not found, to avoid hallucinations.
                    # Best attempt: 
                    pass
            
            # If no address tag, try to find a likely element text
            if not address_candidate:
                # Search for text matching typical address patterns (digits + text + zip) unfortunately complex
                # Simplification: Regex for US Zip Code 5 digits
                zip_match = re.search(r'\b\d{5}(?:-\d{4})?\b', text_lower)
                if zip_match:
                    # Try to grab the surrounding text? Hard to do on raw text.
                    # Let's try to find the parent element of the zip code in standard text
                    found_zip = False
                    for element in soup.find_all(['p', 'div', 'span', 'li', 'td']):
                         if element.string and re.search(r'\b\d{5}(?:-\d{4})?\b', element.string):
                             address_candidate = element.get_text(" ", strip=True)
                             found_zip = True
                             break
                    if not found_zip:
                         # Fallback to just the zip context?
                         pass

            # 5. Clean Text
            for tag in soup(["script", "style", "noscript", "svg", "header", "nav", "meta"]): 
                tag.decompose()
            cleaned_text = soup.get_text(" ", strip=True)
            
            # --- PRIORITY SWEEP & DEEP CRAWLING ---
            keywords = ["contact", "about", "press", "wholesale", "shipping", "faq", "team", "privacy"]
            sub_links_with_priority = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                lower_href = href.lower()
                for idx, k in enumerate(keywords):
                    if k in lower_href:
                        full_url = urljoin(url, href)
                        if full_url.startswith("http"):
                            sub_links_with_priority.append((idx, full_url))
                        break
            
            sub_links_with_priority.sort(key=lambda x: x[0])
            sub_links = []
            for _, link in sub_links_with_priority:
                if link not in sub_links:
                    sub_links.append(link)
            
            # Initial email extraction on home page
            hidden_emails.update(extract_emails_from_text(cleaned_text))
            
            subpage_texts = []
            for sub_link in sub_links[:8]:
                try:
                    print(f"      🔗 Crawling sub-page: {sub_link}")
                    # Change 1: Wait for domcontentloaded so Javascript accordions fully render after a pause
                    page.goto(sub_link, timeout=15000, wait_until="domcontentloaded")
                    page.wait_for_timeout(2000)
                    
                    # Change 2: Grab the raw HTML and let BeautifulSoup clean it to avoid CSS garbage
                    sub_content = page.content()
                    sub_soup = BeautifulSoup(sub_content, "html.parser")
                    
                    # Strip out scripts and styles from the sub-page
                    for tag in sub_soup(["script", "style", "noscript", "svg", "header", "nav", "meta"]): 
                        tag.decompose()
                        
                    # Extract the clean, human-readable text
                    clean_sub_text = sub_soup.get_text(" ", strip=True)
                    
                    if clean_sub_text:
                        subpage_texts.append(clean_sub_text)
                        hidden_emails.update(extract_emails_from_text(clean_sub_text))
                except Exception as e:
                    print(f"      ⚠️ Sub-page load warning ({sub_link}): {e}")
            
            browser.close()

            if subpage_texts:
                cleaned_text += "\n\n--- SUB-PAGES ---\n" + "\n\n".join(subpage_texts)

            # Score, Sort and Append hidden emails
            sorted_emails = score_and_sort_emails(hidden_emails)
            if sorted_emails:
                cleaned_text += " | [HIDDEN EMAILS]: " + ", ".join(sorted_emails)

            return {
                "full_site_text": cleaned_text[:30000], # Cap size
                "social_links": list(social_links),
                "legitimacy_signals": signals,
                "address": address_candidate
            }

    except Exception as e:
        print(f"   ❌ TRUST SCANNER FAILED: {e}")
        return {
            "full_site_text": "", 
            "social_links": [], 
            "legitimacy_signals": {}, 
            "address": ""
        }
