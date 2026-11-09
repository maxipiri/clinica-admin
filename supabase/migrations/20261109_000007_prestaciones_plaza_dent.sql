-- ============================================================
-- Migración 007: Prestaciones reales de Clínica Plaza Dent
-- Proyecto: Clínica Admin
-- Fecha   : 2026-11-09
-- Aplicar : SQL Editor de Supabase (pegar y ejecutar completo)
--
-- - Carga 96 prestaciones (general y ortodoncia). Las prótesis
--   ya estaban (migración 005). Sin controles de ortodoncia con mes.
-- - Desactiva (no borra) las 12 prestaciones de ejemplo iniciales.
-- - Precios editables luego en la pantalla Prestaciones.
-- ============================================================

insert into public.treatments_catalog (clinic_id, name, default_price, category)
select c.id, t.name, t.price, t.category
from public.clinics c
cross join (values
    ('Ajuste Oclusal', 36500, 'general'),
    ('Aplicación Fluor boca Completa', 35000, 'general'),
    ('Blanqueamiento sector estético por sesión', 70000, 'general'),
    ('Blanqueamiento con cubetas', 200000, 'general'),
    ('Blanqueamiento intracameral más eliminación parcial de gutapercha', 120000, 'general'),
    ('Carilla de resina directa estética / mano alzada', 150000, 'general'),
    ('Carilla indirecta alta estética', 220000, 'general'),
    ('Carillas Directas Resina Prom', 54990, 'general'),
    ('Cementación (corona - incrustación definitiva y/o prov)', 35000, 'general'),
    ('Cierre de Diastema (por pieza)', 60000, 'general'),
    ('Cirugía alta complejidad - tercer molar incluido', 150000, 'general'),
    ('Cirugía media complejidad - tercer molar semierupcionado', 99000, 'general'),
    ('Contención', 35000, 'orthodontics'),
    ('Contención Superior en Laboratorio', 40000, 'orthodontics'),
    ('Control Mensual Brackets', 35000, 'orthodontics'),
    ('Corona de acrílico para PFP', 120000, 'general'),
    ('Corona de resina directa total (corona completa)', 170000, 'general'),
    ('Corona disilicato', 250000, 'general'),
    ('Corona metal cerámica', 190000, 'general'),
    ('Corona Metal Cerámica Rehabilitación de implante', 230000, 'general'),
    ('Corona Metal Porcelana', 180000, 'general'),
    ('Corona Provisoria de Acrílico', 55000, 'general'),
    ('Desgaste oclusal', 12990, 'general'),
    ('Destartraje supra y subgingival - Boca completa', 35000, 'general'),
    ('Elevación de margen gingival', 45000, 'general'),
    ('Eliminación Adhesivo ortodoncia', 35000, 'orthodontics'),
    ('Endocrown indirecto', 250000, 'general'),
    ('Endodoncia Anterior + MTA', 250000, 'general'),
    ('Endodoncia diente anterior', 150000, 'general'),
    ('Endodoncia molar', 200000, 'general'),
    ('Endodoncia pre-molar', 170000, 'general'),
    ('Estudio Ortodoncia', 30000, 'orthodontics'),
    ('Estudio para Procedimiento Quirúrgico y rehabilitador de implante oseointegrado', 0, 'general'),
    ('Evaluación', 10000, 'general'),
    ('Exodoncia c.c', 45000, 'general'),
    ('Exodoncia s.c', 40000, 'general'),
    ('Ferulización (por grupo)', 35000, 'general'),
    ('Ferulización (por traumatismo)', 55000, 'general'),
    ('Gengivectomía', 25000, 'general'),
    ('Gingivectomía', 68000, 'general'),
    ('Hueso Particulado', 150000, 'general'),
    ('Implante Oseointegrado', 350000, 'general'),
    ('Incrustación Inlay', 210000, 'general'),
    ('Incrustación Onlay', 250000, 'general'),
    ('Incrustación Overlay', 270000, 'general'),
    ('Inlay indirecto', 200000, 'general'),
    ('Instalación de ortodoncia', 180000, 'orthodontics'),
    ('Laboratorio prótesis acrílica', 59600, 'general'),
    ('Limpieza + Flúor', 22990, 'general'),
    ('Medicación y/o cambio de medicación', 38000, 'general'),
    ('Medicación Endodoncia', 40000, 'general'),
    ('Membrana de Colágeno', 150000, 'general'),
    ('Onlay / Overlay indirecto', 250000, 'general'),
    ('PFP metal cerámica intermediario', 120000, 'general'),
    ('PFU alta estética - disilicato de litio', 350000, 'general'),
    ('PFU cerómero', 250000, 'general'),
    ('PFU metal - cerámica', 320000, 'general'),
    ('Pilar PFP metal cerámica intermediario', 320000, 'general'),
    ('Poste de Fibra de Vidrio intra radicular', 90000, 'general'),
    ('Poste de fibra y/o malla de fibra V.', 90000, 'general'),
    ('Preparación para Corona Fija Unitaria', 55000, 'general'),
    ('Provisional estético', 65000, 'general'),
    ('Provisorio acrílico (corona / incrustación)', 60000, 'general'),
    ('Pulido de restauración boca completa', 35000, 'general'),
    ('Pulido Radicular por sextante', 35000, 'general'),
    ('Radiografía Bite wing', 10000, 'general'),
    ('Radiografía Panorámica', 18000, 'general'),
    ('Radiografía Periapical', 7000, 'general'),
    ('Rebasado', 50000, 'general'),
    ('Rebasado Lab', 98000, 'general'),
    ('Recementación corona o incrustación def o prov', 59900, 'general'),
    ('Reconstrucción de Muñón para Prótesis Fija Unitaria', 60000, 'general'),
    ('Reconstrucción Dental (resina)', 70000, 'general'),
    ('Refuerzo metálico prótesis total acrílica', 55000, 'general'),
    ('Regularización de reborde', 65000, 'general'),
    ('Reparación prótesis', 55000, 'general'),
    ('Reparación prótesis acrílica con lab', 85000, 'general'),
    ('Reposición brackets', 15000, 'orthodontics'),
    ('Restauración cara libre', 42000, 'general'),
    ('Restauración Comp Simple Clase 1', 40000, 'general'),
    ('Restauración Composite Clase 4', 51000, 'general'),
    ('Restauración Compuesta Clase 2', 48000, 'general'),
    ('Restauración Compuesta Clase 3', 47000, 'general'),
    ('Restauración Defectos estructurales y/o Clase V (flow)', 35000, 'general'),
    ('Restauración provisoria', 33000, 'general'),
    ('Retiro Brackets', 90000, 'orthodontics'),
    ('Retiro contenciones', 35000, 'orthodontics'),
    ('Retiro Contenciones + limpieza', 45000, 'orthodontics'),
    ('Retiro de Ortodoncia + Contención', 150000, 'orthodontics'),
    ('Retratamiento endodóntico anterior', 178000, 'general'),
    ('Retratamiento de Endodoncia Premolar', 178000, 'general'),
    ('Sellado (borde incisal)', 35000, 'general'),
    ('Sellado de perforación parcial con material biocerámico', 200000, 'general'),
    ('Sellante de resina 1 cara', 15000, 'general'),
    ('Tallado Incrustación o corona', 25000, 'general'),
    ('Trepanación Urgencia', 55000, 'general')
) as t(name, price, category)
where not exists (
    select 1 from public.treatments_catalog tc
    where tc.clinic_id = c.id and lower(tc.name) = lower(t.name)
);

-- Prestaciones de ejemplo de la migración 004: se ocultan del catálogo
update public.treatments_catalog
set active = false
where category = 'general'
  and name in ('Evaluación inicial / Diagnóstico', 'Destartraje + Profilaxis', 'Restauración composite simple (1 superficie)', 'Restauración composite compleja (2+ superficies)', 'Extracción simple', 'Extracción tercer molar (quirúrgica)', 'Endodoncia unirradicular', 'Endodoncia multirradicular', 'Blanqueamiento dental LED', 'Corona de porcelana sobre metal', 'Corona Zirconio monolítico', 'Plano de relajación / Brujismo');
