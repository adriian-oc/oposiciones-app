// Abre el compositor web de Gmail en una pestaña nueva en vez de mailto:, para que use la
// cuenta de Google ya logueada en el navegador en vez del cliente de correo por defecto del
// sistema operativo.
export function gmailComposeUrl({ to, subject = '', body = '' }) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function openGmailCompose(options) {
  window.open(gmailComposeUrl(options), '_blank', 'noopener,noreferrer');
}
