import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';

const MIN_MINUTES = 1;
const MAX_MINUTES = 90;

// Beep generado con Web Audio API en vez de un archivo de audio -- así no hace falta alojar ni
// cargar ningún asset binario solo para una alarma de dos tonos.
const playAlarm = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const playBeep = (startTime) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    };
    const now = ctx.currentTime;
    playBeep(now);
    playBeep(now + 0.5);
  } catch (e) {
    // Si el navegador bloquea audio (p.ej. sin interacción previa), no debe romper el temporizador.
  }
};

const FocusMode = () => {
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [phase, setPhase] = useState('work'); // 'work' | 'break'
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  useEffect(() => {
    if (!running) return undefined;
    if (secondsLeft <= 0) {
      playAlarm();
      const nextPhase = phase === 'work' ? 'break' : 'work';
      if (phase === 'work') setCyclesCompleted((c) => c + 1);
      setPhase(nextPhase);
      setSecondsLeft((nextPhase === 'work' ? workMinutes : breakMinutes) * 60);
      return undefined;
    }
    const timeout = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timeout);
  }, [running, secondsLeft, phase, workMinutes, breakMinutes]);

  const handleReset = useCallback(() => {
    setRunning(false);
    setPhase('work');
    setSecondsLeft(workMinutes * 60);
    setCyclesCompleted(0);
  }, [workMinutes]);

  const handleWorkMinutesChange = (value) => {
    const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, value || MIN_MINUTES));
    setWorkMinutes(clamped);
    if (!running && phase === 'work') setSecondsLeft(clamped * 60);
  };

  const handleBreakMinutesChange = (value) => {
    const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, value || MIN_MINUTES));
    setBreakMinutes(clamped);
    if (!running && phase === 'break') setSecondsLeft(clamped * 60);
  };

  const minutesDisplay = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secondsDisplay = String(secondsLeft % 60).padStart(2, '0');
  const isWork = phase === 'work';

  return (
    <Layout>
      <div className="max-w-lg mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🎯 Modo Foco</h1>
        <p className="text-gray-600 text-sm mb-8">
          Estudia con la técnica Pomodoro: bloques de estudio concentrado con descansos cortos.
        </p>

        <div
          className={`rounded-2xl shadow-md p-10 mb-6 transition-colors ${
            isWork ? 'bg-primary-50 border-2 border-primary-200' : 'bg-green-50 border-2 border-green-200'
          }`}
        >
          <div className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isWork ? 'text-primary-700' : 'text-green-700'}`}>
            {isWork ? 'Tiempo de estudio' : 'Descanso'}
          </div>
          <div className="text-7xl font-bold text-gray-900 tabular-nums" data-testid="focus-clock">
            {minutesDisplay}:{secondsDisplay}
          </div>
          <div className="text-xs text-gray-500 mt-3">Pomodoros completados hoy: {cyclesCompleted}</div>
        </div>

        <div className="flex justify-center gap-3 mb-8">
          {running ? (
            <button
              onClick={() => setRunning(false)}
              className="px-6 py-2.5 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700"
            >
              Pausar
            </button>
          ) : (
            <button
              onClick={() => setRunning(true)}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700"
            >
              {secondsLeft === (isWork ? workMinutes : breakMinutes) * 60 ? 'Empezar' : 'Continuar'}
            </button>
          )}
          <button
            onClick={handleReset}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200"
          >
            Reiniciar
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Configurar tiempos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minutos de estudio</label>
              <input
                type="number"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                value={workMinutes}
                disabled={running}
                onChange={(e) => handleWorkMinutesChange(parseInt(e.target.value, 10))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minutos de descanso</label>
              <input
                type="number"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                value={breakMinutes}
                disabled={running}
                onChange={(e) => handleBreakMinutesChange(parseInt(e.target.value, 10))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FocusMode;
