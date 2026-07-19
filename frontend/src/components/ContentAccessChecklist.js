import React, { useState, useEffect } from 'react';
import { loadContentAreaUnits, allContentKeys } from '../utils/contentAccessUnits';

// Árbol de checkboxes por área/tema para editar `allowed_content` de un alumno.
// `value`: string[] | null (null = acceso completo). `onChange(next)` recibe la misma forma.
const ContentAccessChecklist = ({ value, onChange }) => {
  const [areas, setAreas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContentAreaUnits().then((data) => {
      setAreas(data.areas);
      setLoading(false);
    });
  }, []);

  if (loading || !areas) {
    return <p className="text-sm text-gray-400">Cargando contenido...</p>;
  }

  const allKeys = allContentKeys(areas);
  const checked = new Set(value === null ? allKeys : value);

  const commit = (nextChecked) => {
    onChange(nextChecked.size === allKeys.length ? null : Array.from(nextChecked));
  };

  const toggleAll = (isChecked) => {
    commit(new Set(isChecked ? allKeys : []));
  };

  const toggleArea = (areaUnits, isChecked) => {
    const next = new Set(checked);
    areaUnits.forEach((u) => (isChecked ? next.add(u.key) : next.delete(u.key)));
    commit(next);
  };

  const toggleUnit = (key, isChecked) => {
    const next = new Set(checked);
    if (isChecked) next.add(key);
    else next.delete(key);
    commit(next);
  };

  const allSelected = checked.size === allKeys.length;

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-semibold mb-2">
        <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
        Seleccionar todo (todas las áreas)
      </label>
      <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
        {areas.map(({ area, units }) => {
          const allInAreaChecked = units.length > 0 && units.every((u) => checked.has(u.key));
          return (
            <div key={area.id} className="border border-gray-200 rounded-md overflow-hidden">
              <label className="flex items-center gap-2 text-sm font-semibold px-3 py-2 bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allInAreaChecked}
                  onChange={(e) => toggleArea(units, e.target.checked)}
                />
                <span>{area.label}</span>
                <span className="text-xs font-normal text-gray-400">({units.length} unidades)</span>
              </label>
              {units.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 px-3 py-2">
                  {units.map((u) => (
                    <label key={u.key} className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={checked.has(u.key)}
                        onChange={(e) => toggleUnit(u.key, e.target.checked)}
                      />
                      {u.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContentAccessChecklist;
