"""
Tests for the four deterministic Verification Agent tools.

All tests are pure-logic: no DB, no HTTP, no LLM.
Run with: pytest backend/app/agents/verification/tests/test_deterministic_tools.py -v
"""

import sys
import os

# Ensure the backend root is on sys.path so imports work without installing the package.
_BACKEND_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..")
sys.path.insert(0, os.path.abspath(_BACKEND_ROOT))

import pytest

from app.agents.verification.tools_v2.contact_extract import extract_contacts
from app.agents.verification.tools_v2.identity import resolve_identity
from app.agents.verification.tools_v2.legitimacy import compute_legitimacy
from app.agents.verification.tools_v2.size_estimate import estimate_size


# ---------------------------------------------------------------------------
# contact_extract
# ---------------------------------------------------------------------------

CONTACT_HTML = """
<html>
<body>
  <p>Email us: <a href="mailto:buying@brandname.com">buying@brandname.com</a></p>
  <p>WhatsApp: <a href="https://wa.me/447911123456">Chat on WhatsApp</a></p>
  <p>
    Follow us on
    <a href="https://www.instagram.com/brandname">Instagram</a> and
    connect on <a href="https://www.linkedin.com/company/brandname">LinkedIn</a>.
  </p>
  <p>info@brandname.com</p>
</body>
</html>
"""


def test_contact_extract_emails():
    result = extract_contacts(CONTACT_HTML, base_url="https://brandname.com")
    assert "buying@brandname.com" in result["all_emails"], (
        f"Expected buying@brandname.com in all_emails, got: {result['all_emails']}"
    )


def test_contact_extract_primary_email_type():
    result = extract_contacts(CONTACT_HTML, base_url="https://brandname.com")
    assert result["primary_email"] == "buying@brandname.com", (
        f"Expected primary_email='buying@brandname.com', got: {result['primary_email']}"
    )
    assert result["email_type"] == "buying", (
        f"Expected email_type='buying', got: {result['email_type']}"
    )
    assert result["email_confidence"] == 90, (
        f"Expected email_confidence=90, got: {result['email_confidence']}"
    )


def test_contact_extract_whatsapp():
    result = extract_contacts(CONTACT_HTML, base_url="https://brandname.com")
    assert result["whatsapp_number"] is not None, "Expected a WhatsApp number to be extracted"
    assert "447911123456" in result["whatsapp_number"].replace("+", ""), (
        f"Expected digits 447911123456 in whatsapp_number, got: {result['whatsapp_number']}"
    )


def test_contact_extract_linkedin():
    result = extract_contacts(CONTACT_HTML, base_url="https://brandname.com")
    assert result["linkedin_company_url"] is not None, "Expected a LinkedIn company URL"
    assert "brandname" in result["linkedin_company_url"], (
        f"Expected 'brandname' in linkedin_company_url, got: {result['linkedin_company_url']}"
    )


def test_contact_extract_social_instagram():
    result = extract_contacts(CONTACT_HTML, base_url="https://brandname.com")
    assert "instagram" in result["social_links"], (
        f"Expected 'instagram' in social_links, got keys: {list(result['social_links'].keys())}"
    )


# ---------------------------------------------------------------------------
# identity
# ---------------------------------------------------------------------------

IDENTITY_HTML = """
<html>
<head>
  <title>Culture Kings | Street Wear</title>
</head>
<body>
  <h1>Culture Kings</h1>
  <p>We are Culture Kings, the world's best street wear retailer.</p>
  <p>Based in Brisbane, Australia.</p>
</body>
</html>
"""


def test_identity_company_name_from_title():
    result = resolve_identity(
        business_name="Culture Kings",
        website="https://culturekings.com.au",
        text=IDENTITY_HTML,
        address="Brisbane, Australia",
    )
    assert result["company_name_confirmed"] is not None, "Expected company name to be confirmed"
    assert "Culture Kings" in result["company_name_confirmed"], (
        f"Expected 'Culture Kings' in company_name_confirmed, got: {result['company_name_confirmed']}"
    )


def test_identity_domain_match_high_confidence():
    result = resolve_identity(
        business_name="Culture Kings",
        website="https://culturekings.com.au",
        text=IDENTITY_HTML,
        address="Brisbane, Australia",
    )
    assert result["domain_matches_business"] is True, (
        "Expected domain_matches_business=True for an exact name match"
    )
    assert result["domain_match_confidence"] >= 0.8, (
        f"Expected confidence >= 0.8, got: {result['domain_match_confidence']}"
    )


def test_identity_country_detected():
    result = resolve_identity(
        business_name="Culture Kings",
        website="https://culturekings.com.au",
        text=IDENTITY_HTML,
        address="Brisbane, Australia",
    )
    assert result["country_confirmed"] == "Australia", (
        f"Expected country_confirmed='Australia', got: {result['country_confirmed']}"
    )


# ---------------------------------------------------------------------------
# legitimacy
# ---------------------------------------------------------------------------

LEGIT_TEXT = """
About us: We were founded in 2005. Our story begins in a small town.
Privacy Policy | Terms of Service
123 High Street, London, United Kingdom
Contact us at sales@mybrand.com or call +44 20 7946 0958.
"""


def test_legitimacy_high_score():
    result = compute_legitimacy(
        text=LEGIT_TEXT,
        about_html="<html>About us page</html>",
        contact_html="<html>Contact page</html>",
        email_found="sales@mybrand.com",
        phone_found="+44 20 7946 0958",
        social_count=2,
        ssl_valid=True,
        website_live=True,
        domain_age_years=10,
    )
    assert result["legitimacy_score"] >= 80, (
        f"Expected legitimacy_score >= 80 with all positive signals, got: {result['legitimacy_score']}"
    )


def test_legitimacy_has_about_and_contact():
    result = compute_legitimacy(
        text=LEGIT_TEXT,
        about_html="<html>About us page</html>",
        contact_html="<html>Contact page</html>",
        email_found="sales@mybrand.com",
        phone_found="+44 20 7946 0958",
        social_count=2,
        ssl_valid=True,
        website_live=True,
        domain_age_years=10,
    )
    assert result["has_about_page"] is True
    assert result["has_contact_page"] is True
    assert result["has_policy_pages"] is True


def test_legitimacy_risk_flag_no_email():
    result = compute_legitimacy(
        text="Welcome to our site.",
        about_html="",
        contact_html="",
        email_found=None,
        phone_found=None,
        social_count=0,
        ssl_valid=False,
        website_live=True,
        domain_age_years=5,
    )
    assert "no domain email found" in result["risk_flags"], (
        f"Expected 'no domain email found' risk flag, got: {result['risk_flags']}"
    )


# ---------------------------------------------------------------------------
# size_estimate
# ---------------------------------------------------------------------------

def test_size_estimate_family_business():
    result = estimate_size("We are a family business based in London.", platform="")
    assert result["employee_range"] == "1-10", (
        f"Expected employee_range='1-10', got: {result['employee_range']}"
    )
    assert result["revenue_band"] == "small", (
        f"Expected revenue_band='small', got: {result['revenue_band']}"
    )


def test_size_estimate_enterprise():
    result = estimate_size("We are a global company with enterprise solutions worldwide.", platform="")
    assert result["employee_range"] == "200+", (
        f"Expected employee_range='200+', got: {result['employee_range']}"
    )
    assert result["revenue_band"] == "large"


def test_size_estimate_platform_fallback():
    result = estimate_size("No size signals here.", platform="shopify")
    assert result["employee_range"] == "1-50", (
        f"Expected employee_range='1-50' from Shopify signal, got: {result['employee_range']}"
    )


def test_size_estimate_unknown():
    result = estimate_size("Welcome to our store.", platform="")
    assert result["employee_range"] == "unknown"
    assert result["revenue_band"] == "unknown"
