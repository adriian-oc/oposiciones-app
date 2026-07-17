// Registro estático de las 7 áreas de contenido, portado de CONTENT_AREAS en
// /Users/adrian/Desktop/Adoc/webapp/index.html:1150. A diferencia del original, las listas de
// temas por área NO están hardcodeadas aquí: se consultan en tiempo real contra
// GET /api/themes?part=SPECIFIC|GENERAL (ver themeService.js), así un admin puede añadir un
// tema nuevo sin necesitar un redeploy del frontend.
export const CONTENT_AREAS = [
  { id: 'gen', label: '📋 Supuestos Prácticos', kind: 'numbered' },
  { id: 'cuad', label: '📗 Cuadernillos de Ejercicios', kind: 'temas', prefix: 'cuad_', part: 'SPECIFIC' },
  { id: 'tesp', label: '📘 Temario Parte Específica', kind: 'temas', prefix: 'tesp_', part: 'SPECIFIC' },
  { id: 'esq', label: '📙 Esquemas Parte Específica', kind: 'temas', prefix: 'esq_', part: 'SPECIFIC' },
  { id: 'tgen', label: '📕 Temario Parte General', kind: 'temas', prefix: 'tgen_', part: 'GENERAL' },
  { id: 'ttesp', label: '✅ Test de Teoría Parte Específica', kind: 'temas', prefix: 'ttesp_', part: 'SPECIFIC' },
  { id: 'ttgen', label: '✅ Test de Teoría Parte General', kind: 'temas', prefix: 'ttgen_', part: 'GENERAL' },
];

export function getContentArea(id) {
  return CONTENT_AREAS.find((a) => a.id === id);
}
