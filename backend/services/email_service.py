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

    def send_new_message_notice(self, to_email: str, to_name: str, sender_name: str, chat_link: str, count: int = 1) -> None:
        if count > 1:
            subject = f"Tienes {count} mensajes nuevos de {sender_name} en ADOC"
            body = f"<strong>{sender_name}</strong> te ha escrito {count} mensajes nuevos en ADOC."
        else:
            subject = f"Tienes un mensaje nuevo de {sender_name} en ADOC"
            body = f"<strong>{sender_name}</strong> te ha escrito un mensaje nuevo en ADOC."
        html = f"""
        <p>Hola {to_name},</p>
        <p>{body}</p>
        <p><a href="{chat_link}">Entra aquí para leerlo y responder</a>.</p>
        """
        self.send(to_email, to_name, subject, html)

    def send_welcome_email(self, to_email: str, to_name: str, reset_link: str) -> None:
        subject = "Bienvenido/a a ADOC — activa tu cuenta"
        html = f"""
        <p>Hola {to_name},</p>
        <p>Tu cuenta en ADOC ya está creada. Antes de entrar, fija tu contraseña:</p>
        <p><a href="{reset_link}">Fijar mi contraseña</a></p>
        <p>Este enlace caduca en 24 horas.</p>
        """
        self.send(to_email, to_name, subject, html)

    def send_password_reset_email(self, to_email: str, to_name: str, reset_link: str) -> None:
        subject = "Restablece tu contraseña en ADOC"
        html = f"""
        <p>Hola {to_name},</p>
        <p>Has solicitado restablecer tu contraseña en ADOC:</p>
        <p><a href="{reset_link}">Fijar nueva contraseña</a></p>
        <p>Este enlace caduca en 24 horas. Si no lo has pedido tú, ignora este correo.</p>
        """
        self.send(to_email, to_name, subject, html)

    def send_migration_announcement(self, to_email: str, to_name: str, reset_link: str, trial_days: int = 3) -> None:
        subject = "ADOC tiene web nueva — acceso completo gratis unos días"
        html = f"""
        <p>Hola {to_name},</p>
        <p>Hemos migrado ADOC a una plataforma nueva. Para que la pruebes a fondo, tienes
        <strong>acceso a todo el material</strong> (todos los temas, cuadernillos y supuestos)
        durante los próximos <strong>{trial_days} días</strong>, aunque tu plan normal no lo
        incluya todo.</p>
        <p>Entre quienes mejor puntuación saquen en este periodo, cederemos el acceso completo
        a toda la preparación de forma definitiva.</p>
        <p>Antes de entrar, confirma tu contraseña aquí:</p>
        <p><a href="{reset_link}">Fijar mi contraseña</a></p>
        <p>Este enlace caduca en 24 horas.</p>
        """
        self.send(to_email, to_name, subject, html)
