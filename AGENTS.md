# Reglas permanentes del proyecto

- Idioma de la interfaz: español (Chile). Código y nombres de tablas en inglés o español consistente (elegir uno y mantenerlo).
- Moneda: CLP, enteros, sin decimales. Guardar montos como integer. Formato $1.234.567.
- Fechas: zona horaria America/Santiago.
- Toda tabla de negocio lleva clinic_id (preparado para multi-clínica y monetización futura) y created_at / updated_at.
- Row Level Security activo en TODAS las tablas. Un usuario solo ve datos de su clínica.
- Todos los cambios de base de datos van como migraciones SQL versionadas en /supabase/migrations. Nunca modificar la BD "a mano".
- Nunca borrar datos financieros: usar anulación (voided_at + motivo) para mantener auditoría.
- Nunca poner claves secretas en el repo. Usar .env.local y variables de entorno en Vercel.
- Diseño mobile-first: debe usarse cómodo desde el celular en el box.
- Cada fase termina con: lista de lo hecho, cómo probarlo y commit en GitHub.
- Antes de empezar, leer SPEC.md. No avanzar a la siguiente fase sin mi aprobación.
