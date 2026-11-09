-- ============================================================
-- Limpieza: borra las tablas en español creadas hoy desde el chat
-- (doctores, pacientes, tratamientos, etc.). Duplicaban las tablas
-- que clinica-admin ya tiene (dentists, patients, appointments_work...).
-- Solo tenían datos de ejemplo, no hay datos reales que perder.
-- NO toca ninguna tabla de clinica-admin.
-- ============================================================
drop view  if exists public.v_resumen_mensual;
drop view  if exists public.v_tratamientos;
drop view  if exists public.v_catalogo;

drop table if exists public.config;
drop table if exists public.gastos;
drop table if exists public.pagos;
drop table if exists public.ordenes_lab;
drop table if exists public.atenciones;
drop table if exists public.tratamientos;
drop table if exists public.catalogo_lab;
drop table if exists public.laboratorios;
drop table if exists public.pacientes;
drop table if exists public.doctores;
