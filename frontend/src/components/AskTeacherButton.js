import React from 'react';
import { Link } from 'react-router-dom';

// Siempre visible: se asume que todo alumno tiene un profesor asignado; si por lo que sea no lo
// tuviera, el hilo de /chat lo sigue viendo el admin (bypass ya existente en
// message_service._authorize), así que no hace falta ocultar el botón ni comprobar
// assigned_profesor_id en el cliente -- ver decisión de la ronda 5.
const AskTeacherButton = ({ questionText, className = '' }) => {
  const prefill = `Tengo una duda con esta pregunta: "${questionText}"`;
  return (
    <Link
      to={`/chat?prefill=${encodeURIComponent(prefill)}`}
      className={`inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 font-medium ${className}`}
      data-testid="ask-teacher-button"
    >
      💬 Preguntar a mi profesor
    </Link>
  );
};

export default AskTeacherButton;
