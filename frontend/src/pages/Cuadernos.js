import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PracticeOptionsDialog from '../components/PracticeOptionsDialog';
import { CONTENT_AREAS } from '../config/contentAreas';
import { contentUnitService } from '../services/contentUnitService';
import { examService } from '../services/examService';
import { questionService } from '../services/questionService';
import documentService from '../services/documentService';
import { useAuth } from '../context/AuthContext';
import { loadContentAreaUnits } from '../utils/contentAccessUnits';

const THEORY_AREA_IDS = ['ttesp', 'ttgen'];

const Cuadernos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightThemeId = searchParams.get('theme');
  const highlightedRowRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [openAreas, setOpenAreas] = useState(() => new Set());
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState('');
  const [areaUnits, setAreaUnits] = useState([]);
  const [unitsByArea, setUnitsByArea] = useState({});
  const [theoryCounts, setTheoryCounts] = useState({});
  const [approvedDocs, setApprovedDocs] = useState({});
  const [pendingStart, setPendingStart] = useState(null);

  // null = acceso completo (admin/profesor siempre, o alumno sin restricción).
  const hasAccess = useCallback(
    (key) => {
      if (!user) return false;
      if (user.role === 'admin' || user.role === 'profesor') return true;
      return user.allowed_content == null || user.allowed_content.includes(key);
    },
    [user]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const temaAreaIds = CONTENT_AREAS.filter((a) => a.kind === 'temas').map((a) => a.id);
      const isStudent = user?.role === 'student';
      const [{ areas }, unitsResults, countsResults, approvedDocsResult] = await Promise.all([
        loadContentAreaUnits(),
        Promise.all(temaAreaIds.map((id) => contentUnitService.getByArea(id))),
        Promise.all(THEORY_AREA_IDS.map((id) => questionService.getCounts(id))),
        isStudent ? documentService.getApprovedMine() : Promise.resolve([]),
      ]);
      setAreaUnits(areas);

      const units = {};
      temaAreaIds.forEach((areaId, i) => {
        units[areaId] = {};
        unitsResults[i].forEach((u) => {
          units[areaId][u.theme_id] = u;
        });
      });
      setUnitsByArea(units);

      const counts = {};
      THEORY_AREA_IDS.forEach((areaId, i) => {
        counts[areaId] = countsResults[i];
      });
      setTheoryCounts(counts);

      // Si venimos de "Practicar" en Analítica/Refuerzo con un tema débil concreto, abrir de
      // entrada solo las áreas donde ese tema es PRACTICABLE de verdad (Cuadernillo con
      // preguntas, o Teoría con banco propio cargado) -- no todas las áreas donde el tema
      // simplemente existe (Temario/Esquemas son documentos "Próximamente", no aportan nada
      // aquí y solo añadirían ruido al desplegable).
      if (highlightThemeId) {
        const practicableAreaIds = [];
        const cuadArea = areas.find((a) => a.area.id === 'cuad');
        if (cuadArea?.units.some((u) => u.theme?.id === highlightThemeId && u.practicalSet)) {
          practicableAreaIds.push('cuad');
        }
        THEORY_AREA_IDS.forEach((areaId) => {
          if ((counts[areaId]?.[highlightThemeId] || 0) > 0) practicableAreaIds.push(areaId);
        });
        if (practicableAreaIds.length > 0) {
          setOpenAreas(new Set(practicableAreaIds));
        }
      }

      const docs = {};
      approvedDocsResult.forEach((doc) => {
        docs[`${doc.area_id}:${doc.theme_id}`] = doc;
      });
      setApprovedDocs(docs);
    } catch (err) {
      console.error('Error loading Cuadernos:', err);
      setError('No se pudo cargar el contenido. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [user, highlightThemeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Tras abrir de entrada las áreas del tema débil (ver load()), esperar a que el DOM pinte esas
  // filas y llevar la vista hasta la primera coincidencia -- si no, el usuario llega a Cuadernos
  // con el desplegable abierto pero sin saber dónde mirar.
  useEffect(() => {
    if (!loading && highlightThemeId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, highlightThemeId]);

  const toggleArea = (areaId) => {
    setOpenAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const requestStart = (key, label, startFn) => {
    setPendingStart({ key, label, startFn });
  };

  const confirmStart = async (liveCorrection) => {
    const { key, startFn } = pendingStart;
    setPendingStart(null);
    setStartingId(key);
    setError('');
    try {
      const attempt = await startFn(liveCorrection);
      navigate(`/exams/take/${attempt.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar la práctica');
    } finally {
      setStartingId(null);
    }
  };

  const renderRow = (unit, meta) => {
    const baseClass = 'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md text-left';

    if (!hasAccess(unit.key)) {
      return (
        <div key={unit.key} className={`${baseClass} text-gray-300 cursor-default`}>
          <span>{unit.label}</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-300 flex-shrink-0">🔒 Sin acceso</span>
        </div>
      );
    }

    if (meta.kind === 'practice') {
      const isStarting = startingId === unit.key;
      const approvedDoc = meta.approvedDoc;
      return (
        <div key={unit.key} className="flex flex-col" ref={meta.highlighted ? highlightedRowRef : null}>
          <button
            type="button"
            disabled={isStarting}
            onClick={() => requestStart(unit.key, unit.label, meta.onStart)}
            className={`${baseClass} text-gray-800 hover:bg-primary-50 disabled:opacity-50 ${
              meta.highlighted ? 'ring-2 ring-primary-400 bg-primary-50' : ''
            }`}
          >
            <span>{unit.label}</span>
            <span className="text-xs font-medium text-primary-600 flex-shrink-0">
              {isStarting ? 'Iniciando...' : 'Practicar ▶'}
            </span>
          </button>
          {approvedDoc && (
            <a
              href={documentService.fileUrl(approvedDoc)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 pb-1 text-xs text-primary-600 hover:text-primary-800"
            >
              📄 Documento de tu profesor
            </a>
          )}
        </div>
      );
    }

    if (meta.kind === 'pdf') {
      return (
        <a
          key={unit.key}
          href={meta.unit.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${baseClass} text-gray-800 hover:bg-primary-50`}
        >
          <span className="flex items-center gap-2">
            {unit.label}
            {meta.unit.is_new && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white bg-red-600 rounded">
                New
              </span>
            )}
          </span>
          <span className="text-xs font-semibold text-primary-600 flex-shrink-0">⬇ PDF</span>
        </a>
      );
    }

    return (
      <div key={unit.key} className={`${baseClass} text-gray-400 cursor-default`}>
        <span>{unit.label}</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-300 flex-shrink-0">Próximamente</span>
      </div>
    );
  };

  const renderAreaContent = ({ area, units }) => {
    if (units.length === 0) {
      return (
        <p className="px-3 py-2 text-sm text-gray-400">
          {area.kind === 'numbered' ? 'Todavía no hay contenido en esta área.' : 'Todavía no hay temas en esta parte.'}
        </p>
      );
    }

    return units.map((unit) => {
      const approvedDoc = unit.theme ? approvedDocs[`${area.id}:${unit.theme.id}`] : null;
      const highlighted = !!highlightThemeId && unit.theme?.id === highlightThemeId;
      if (area.kind === 'numbered' || (area.id === 'cuad' && unit.practicalSet)) {
        return renderRow(unit, {
          kind: 'practice',
          onStart: (liveCorrection) => examService.startPractice(unit.practicalSet.id, liveCorrection),
          approvedDoc,
          highlighted,
        });
      }
      const hasManualTheory = (theoryCounts[area.id]?.[unit.theme.id] || 0) > 0;
      if (THEORY_AREA_IDS.includes(area.id) && hasManualTheory) {
        return renderRow(unit, {
          kind: 'practice',
          onStart: (liveCorrection) => examService.startTheoryPractice(area.id, unit.theme.id, liveCorrection),
          approvedDoc,
          highlighted,
        });
      }
      const contentUnit = unitsByArea[area.id]?.[unit.theme.id];
      const kind = contentUnit?.kind === 'pdf' ? 'pdf' : 'coming_soon';
      return renderRow(unit, { kind, unit: contentUnit });
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col md:flex-row gap-6" data-testid="cuadernos-page">
        <aside className="w-full md:w-80 flex-shrink-0 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-900">Cuadernos</div>
          {error && <div className="px-4 py-2 text-sm text-red-700 bg-red-50">{error}</div>}
          <div>
            {areaUnits.map(({ area, units }) => {
              const isOpen = openAreas.has(area.id);
              return (
                <div key={area.id} className="border-b border-gray-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleArea(area.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    data-testid={`area-toggle-${area.id}`}
                  >
                    <span>{area.label}</span>
                    <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && <div className="pb-2 px-1">{renderAreaContent({ area, units })}</div>}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center min-h-[400px] text-center px-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-700 mb-2">Cuadernos de Entrenamiento</h1>
            <p className="text-gray-500 text-sm">
              Elige una sección del desplegable de la izquierda para empezar a practicar.
            </p>
          </div>
        </div>
      </div>
      {pendingStart && (
        <PracticeOptionsDialog
          title={`Empezar: ${pendingStart.label}`}
          onStart={confirmStart}
          onCancel={() => setPendingStart(null)}
        />
      )}
    </Layout>
  );
};

export default Cuadernos;
