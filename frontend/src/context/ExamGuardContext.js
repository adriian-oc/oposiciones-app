import React, { createContext, useContext, useState } from 'react';

// Mientras hay un examen sin terminar montado (ver TakeExam.js), Layout.js intercepta los
// clics en su navegación para avisar antes de salir -- en vez de acoplar TakeExam.js a Layout.js
// directamente, ambos comparten este estado mínimo.
const ExamGuardContext = createContext({ guarded: false, setGuarded: () => {} });

export const ExamGuardProvider = ({ children }) => {
  const [guarded, setGuarded] = useState(false);
  return (
    <ExamGuardContext.Provider value={{ guarded, setGuarded }}>
      {children}
    </ExamGuardContext.Provider>
  );
};

export const useExamGuard = () => useContext(ExamGuardContext);
