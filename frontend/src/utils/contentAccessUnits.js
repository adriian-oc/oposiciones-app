import { CONTENT_AREAS } from '../config/contentAreas';
import { themeService } from '../services/themeService';
import practicalSetService from '../services/practicalSetService';

const SUPUESTO_RE = /^Supuesto\s+(\d+)/i;
const CUADERNILLO_PREFIX = 'Cuadernillo';

// Claves de acceso ('allowed_content' en el backend, ver backend/models/user.py):
//   Supuestos Prácticos -> gen:<practical_set_id>
//   Cuadernillos         -> cuad:<theme_id>
//   Resto de áreas       -> <area_id>:<theme_id>
// Distinto del 'content_unit_key' que llevan los intentos (ese es siempre el practical_set id
// crudo, usado para el rollup de progreso -- ver backend/services/exam_service.py::start_practice).
export async function loadContentAreaUnits() {
  const [specificThemes, generalThemes, practicalSets] = await Promise.all([
    themeService.getThemes('SPECIFIC'),
    themeService.getThemes('GENERAL'),
    practicalSetService.getAll(0, 100),
  ]);
  const themesByPart = { SPECIFIC: specificThemes, GENERAL: generalThemes };

  const supuestos = practicalSets
    .filter((ps) => SUPUESTO_RE.test(ps.title))
    .sort((a, b) => parseInt(a.title.match(SUPUESTO_RE)[1], 10) - parseInt(b.title.match(SUPUESTO_RE)[1], 10));

  const cuadernilloByTheme = {};
  practicalSets
    .filter((ps) => ps.title.startsWith(CUADERNILLO_PREFIX))
    .forEach((ps) => {
      const themeId = ps.theme_ids?.[0];
      if (themeId) cuadernilloByTheme[themeId] = ps;
    });

  const areas = CONTENT_AREAS.map((area) => {
    if (area.kind === 'numbered') {
      return {
        area,
        units: supuestos.map((ps) => ({ key: `gen:${ps.id}`, label: ps.title, practicalSet: ps })),
      };
    }
    const themes = themesByPart[area.part] || [];
    const units = themes.map((theme) => {
      if (area.id === 'cuad') {
        return { key: `cuad:${theme.id}`, label: theme.name, theme, practicalSet: cuadernilloByTheme[theme.id] || null };
      }
      return { key: `${area.id}:${theme.id}`, label: theme.name, theme };
    });
    return { area, units };
  });

  return { areas, themesByPart, supuestos, cuadernilloByTheme, practicalSets };
}

export function allContentKeys(areas) {
  return areas.flatMap((a) => a.units.map((u) => u.key));
}
