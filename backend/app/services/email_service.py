import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        logger.warning(f"[email_service] SMTP not configured. Email to {to_email}: {subject}")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, to_email, msg.as_string())
        logger.info(f"[email_service] Sent '{subject}' to {to_email}")
    except Exception as e:
        logger.error(f"[email_service] Failed to send email to {to_email}: {e}")


def send_verification_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/auth/verify-email?token={token}"
    logger.info(f"[email_service] Verification link for {to_email}: {link}")
    html = f"""
    <p>Welcome to Client Finder. Please verify your email address:</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link expires in 1 hour.</p>
    """
    _send_email(to_email, "Verify your Client Finder account", html)


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/auth/reset-password?token={token}"
    logger.info(f"[email_service] Password reset link for {to_email}: {link}")
    html = f"""
    <p>You requested a password reset for your Client Finder account.</p>
    <p><a href="{link}">{link}</a></p>
    <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    """
    _send_email(to_email, "Reset your Client Finder password", html)
