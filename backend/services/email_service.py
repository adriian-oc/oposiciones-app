import html
import logging
from typing import List, Optional

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

    def _layout(self, body_html: str) -> str:
        """Envoltorio visual común (logo + tarjeta + pie) para todos los correos -- la URL del
        logo tiene que ser absoluta (un cliente de correo no resuelve rutas relativas como hace
        el navegador), de ahí frontend_base_url en vez de la ruta /branding/logo.png a secas."""
        logo_url = f"{settings.frontend_base_url}/branding/logo.png"
        return f"""
        <meta charset="utf-8">
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <div style="text-align: center; padding: 24px 0 12px;">
            <img src="{logo_url}" alt="ADOC" style="height: 48px;" />
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 28px; line-height: 1.5;">
            {body_html}
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            ADOC — Academia de Oposiciones
          </p>
        </div>
        """

    def _button(self, url: str, label: str) -> str:
        return (
            f'<p style="text-align:center;margin:24px 0;">'
            f'<a href="{url}" style="background:#2563eb;color:#ffffff;padding:11px 22px;'
            f'border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">{label}</a></p>'
        )

    def send_new_message_notice(
        self,
        to_email: str,
        to_name: str,
        sender_name: str,
        chat_link: str,
        count: int = 1,
        messages: Optional[List[dict]] = None,
    ) -> None:
        """messages: [{"sender_name": str, "text": str}, ...] -- el texto real de cada mensaje
        agrupado en la ventana (ver MessageService._send_digest_after_delay), no solo el aviso
        genérico de antes. Todo lo que venga de un alumno/profesor se escapa por si trae HTML."""
        if count > 1:
            subject = f"Tienes {count} mensajes nuevos de {sender_name} en ADOC"
            intro = f"<strong>{html.escape(sender_name)}</strong> te ha escrito {count} mensajes nuevos en ADOC:"
        else:
            subject = f"Tienes un mensaje nuevo de {sender_name} en ADOC"
            intro = f"<strong>{html.escape(sender_name)}</strong> te ha escrito un mensaje nuevo en ADOC:"

        messages_html = ""
        if messages:
            items = "".join(
                '<div style="margin:10px 0;padding:10px 14px;background:#f3f4f6;border-radius:8px;">'
                f'<div style="font-size:12px;color:#6b7280;margin-bottom:2px;">{html.escape(m["sender_name"])}</div>'
                f'<div>{html.escape(m["text"])}</div></div>'
                for m in messages
            )
            messages_html = f'<div style="margin:16px 0;">{items}</div>'

        body = f"""
        <p>Hola {html.escape(to_name)},</p>
        <p>{intro}</p>
        {messages_html}
        {self._button(chat_link, "Entrar y responder")}
        """
        self.send(to_email, to_name, subject, self._layout(body))

    def send_welcome_email(self, to_email: str, to_name: str, reset_link: str) -> None:
        subject = "Bienvenido/a a ADOC 🎉"
        body = f"""
        <p>¡Hola {html.escape(to_name)}!</p>
        <p>Te damos la bienvenida a <strong>ADOC</strong>. Tu cuenta ya está lista, con todo lo
        que necesitas para preparar tu oposición en un solo sitio: cuadernillos de ejercicios,
        supuestos prácticos, test de Teoría por tema, tu calendario de estudio personalizado y
        seguimiento de tu progreso.</p>
        <p>Solo falta un paso antes de entrar: fija tu contraseña.</p>
        {self._button(reset_link, "Fijar mi contraseña")}
        <p style="font-size: 13px; color: #6b7280;">Este enlace caduca en 24 horas. Si tienes
        cualquier duda al empezar, puedes escribirnos desde el chat de la propia app en cuanto
        entres.</p>
        """
        self.send(to_email, to_name, subject, self._layout(body))

    def send_password_reset_email(self, to_email: str, to_name: str, reset_link: str) -> None:
        subject = "Restablece tu contraseña en ADOC"
        body = f"""
        <p>Hola {html.escape(to_name)},</p>
        <p>Has solicitado restablecer tu contraseña en ADOC.</p>
        {self._button(reset_link, "Fijar nueva contraseña")}
        <p style="font-size: 13px; color: #6b7280;">Este enlace caduca en 24 horas. Si no lo has
        pedido tú, puedes ignorar este correo.</p>
        """
        self.send(to_email, to_name, subject, self._layout(body))

    def send_migration_announcement(self, to_email: str, to_name: str, reset_link: str, trial_days: int = 3) -> None:
        subject = "ADOC tiene web nueva — acceso completo gratis unos días"
        body = f"""
        <p>Hola {html.escape(to_name)},</p>
        <p>Hemos migrado ADOC a una plataforma nueva. Para que la pruebes a fondo, tienes
        <strong>acceso a todo el material</strong> (todos los temas, cuadernillos y supuestos)
        durante los próximos <strong>{trial_days} días</strong>, aunque tu plan normal no lo
        incluya todo.</p>
        <p>Entre quienes mejor puntuación saquen en este periodo, cederemos el acceso completo
        a toda la preparación de forma definitiva.</p>
        <p>Antes de entrar, confirma tu contraseña aquí:</p>
        {self._button(reset_link, "Fijar mi contraseña")}
        <p style="font-size: 13px; color: #6b7280;">Este enlace caduca en 24 horas.</p>
        """
        self.send(to_email, to_name, subject, self._layout(body))
