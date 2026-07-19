import logging

import requests

from config.settings import settings

logger = logging.getLogger(__name__)

BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"


class EmailService:
    """Envío de emails transaccionales vía la API REST de Brevo (plan gratuito, 300/día). Sin
    BREVO_API_KEY configurada, envía nada y solo lo registra -- así el flujo que dispara el
    email (p.ej. mandar un mensaje) nunca depende de tener email configurado en local/desarrollo."""

    def send(self, to_email: str, to_name: str, subject: str, html_content: str) -> None:
        if not settings.brevo_api_key:
            logger.info(f"BREVO_API_KEY no configurada, se omite email a {to_email}: {subject}")
            return
        try:
            response = requests.post(
                BREVO_ENDPOINT,
                headers={
                    "api-key": settings.brevo_api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "sender": {"name": settings.brevo_sender_name, "email": settings.brevo_sender_email},
                    "to": [{"email": to_email, "name": to_name}],
                    "subject": subject,
                    "htmlContent": html_content,
                },
                timeout=10,
            )
            if response.status_code >= 300:
                logger.error(f"Brevo devolvió {response.status_code} al enviar a {to_email}: {response.text}")
        except Exception as e:
            logger.error(f"Fallo al enviar email a {to_email}: {e}")

    def send_new_message_notice(self, to_email: str, to_name: str, sender_name: str) -> None:
        subject = f"Tienes un mensaje nuevo de {sender_name} en ADOC"
        html = f"""
        <p>Hola {to_name},</p>
        <p><strong>{sender_name}</strong> te ha escrito un mensaje nuevo en ADOC.</p>
        <p><a href="{settings.frontend_base_url}/chat">Entra aquí para leerlo y responder</a>.</p>
        """
        self.send(to_email, to_name, subject, html)
