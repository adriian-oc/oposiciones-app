from repositories.theme_repository import ThemeRepository
from models.theme import ThemeCreate, ThemeResponse
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class ThemeService:
    def __init__(self):
        self.theme_repo = ThemeRepository()
    
    def create_theme(self, theme_data: ThemeCreate) -> dict:
        theme = self.theme_repo.create(theme_data)
        return theme.model_dump()
    
    def get_all_themes(self, part: Optional[str] = None) -> List[dict]:
        return self.theme_repo.get_all(part)
    
    def get_theme_by_id(self, theme_id: str) -> dict:
        theme = self.theme_repo.get_by_id(theme_id)
        if not theme:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme not found"
            )
        return theme
    
    def seed_initial_themes(self):
        """Seed the 36 initial themes (23 general + 13 specific)"""
        existing = self.theme_repo.get_all()
        if existing:
            logger.info("Themes already exist, skipping seed")
            return
        
        themes = []
        
        # 23 General Themes
        general_themes = [
            "La Constitución Española de 1978: estructura, contenido, reforma",
            "Derechos y deberes fundamentales: garantía, suspensión",
            "El Tribunal Constitucional: organización, atribuciones",
            "La Corona: funciones, sucesión, regencia, refrendo",
            "El poder legislativo: Cortes Generales, funcionamiento, competencias",
            "El poder judicial: principios, organización del sistema judicial",
            "El poder ejecutivo: Presidente, Gobierno, relaciones con Cortes",
            "La Administración General del Estado: principios, órganos",
            "Organización territorial del Estado: CCAA, Estatutos, competencias",
            "Instituciones de la Unión Europea: estructura, competencias",
            "Fuentes del derecho de la Unión Europea y ordenamiento español",
            "Ministerio de Inclusión, Seguridad Social y Migraciones",
            "Fuentes del Derecho Administrativo: concepto, clases, jerarquía",
            "El acto administrativo: concepto, elementos, efectos, validez",
            "Procedimiento administrativo común: iniciación, instrucción, resolución",
            "Recursos administrativos y jurisdicción contencioso-administrativa",
            "Contratos del sector público: preparación, adjudicación, efectos",
            "Organización administrativa electrónica, procedimiento electrónico",
            "Régimen jurídico del personal al servicio de las Administraciones",
            "Protección de datos personales y derechos digitales",
            "Igualdad, políticas de género, discapacidad y dependencia",
            "Principios de buen gobierno, transparencia y acceso a información",
            "Régimen Jurídico del Sector Público, Ley 40/2015"
        ]
        
        for i, name in enumerate(general_themes, 1):
            themes.append(ThemeCreate(
                code=f"GENERAL_{i:02d}",
                name=name,
                part="GENERAL",
                order=i
            ))
        
        # 13 Specific Themes
        specific_themes = [
            "Seguridad Social en la Constitución y Ley General de Seguridad Social",
            "Campo de aplicación: regímenes generales y especiales",
            "Normas sobre afiliación, altas, bajas, efectos, convenios especiales",
            "Cotización: bases, tipos, liquidación, regímenes especiales",
            "Gestión recaudatoria: obligaciones, medios de pago, control",
            "Recaudación en vía ejecutiva: procedimiento, embargos, oposición",
            "Acción protectora: prestaciones y clasificación, incompatibilidades",
            "Incapacidad temporal y permanente contributiva: requisitos, cuantía",
            "Protección por nacimiento y cuidado del menor",
            "Jubilación en régimen contributivo: requisitos, cálculo, modalidades",
            "Riesgo de muerte y supervivencia: viudedad, orfandad",
            "Prestaciones no contributivas y asistenciales",
            "Recursos generales del sistema: patrimonios, gestión financiera"
        ]
        
        for i, name in enumerate(specific_themes, 1):
            themes.append(ThemeCreate(
                code=f"SPECIFIC_{i:02d}",
                name=name,
                part="SPECIFIC",
                order=i + 23
            ))
        
        self.theme_repo.bulk_create(themes)
        logger.info(f"Seeded {len(themes)} themes successfully")