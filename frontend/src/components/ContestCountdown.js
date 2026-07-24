import React, { useEffect, useState } from 'react';

const getRemaining = (endAt) => {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
};

// Cuenta atrás hasta el cierre de inscripción del concurso. Se recalcula cada segundo en el
// cliente a partir de `endAt` (fecha ISO) -- no depende de que el servidor la vaya empujando.
const ContestCountdown = ({ endAt, compact = false }) => {
  const [remaining, setRemaining] = useState(() => getRemaining(endAt));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(endAt)), 1000);
    return () => clearInterval(interval);
  }, [endAt]);

  if (!remaining) {
    return <div className="font-semibold text-red-700">El plazo de inscripción ha finalizado</div>;
  }

  const units = [
    ['Días', remaining.days],
    ['Horas', remaining.hours],
    ['Min', remaining.minutes],
    ['Seg', remaining.seconds],
  ];

  return (
    <div className={`flex gap-3 ${compact ? 'justify-start' : 'justify-center'}`}>
      {units.map(([label, value]) => (
        <div key={label} className="bg-gray-900 text-white rounded-md px-3 py-2 text-center min-w-[64px]">
          <div className="text-2xl font-bold tabular-nums">{String(value).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-300">{label}</div>
        </div>
      ))}
    </div>
  );
};

export default ContestCountdown;
