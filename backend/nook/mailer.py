import os
import smtplib
from email.message import EmailMessage


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM", "").strip())


def send_verification(email: str, code: str) -> str:
    """Returns 'smtp' when the message is handed to a server, otherwise 'preview'."""
    if not smtp_configured():
        return "preview"
    message = EmailMessage()
    message["Subject"] = f"Your Dormsurf code is {code}"
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "Use this code to verify your school email for Dormsurf:",
                "",
                code,
                "",
                "It expires in 15 minutes. If you didn't ask for it, you can ignore this note.",
            ]
        )
    )
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=20) as server:
        server.starttls()
        user = os.getenv("SMTP_USER", "").strip()
        password = os.getenv("SMTP_PASSWORD", "").strip()
        if user:
            server.login(user, password)
        server.send_message(message)
    return "smtp"
