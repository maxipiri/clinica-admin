# Migraciones de Base de Datos

Todas las migraciones van en esta carpeta como archivos SQL versionados.

## Convención de nombres

```
YYYYMMDD_HHMMSS_descripcion.sql
```

Ejemplo: `20241016_000001_create_clinics_and_profiles.sql`

## Cómo aplicar migraciones

### Opción A — Supabase CLI (recomendado)

1. Instalar Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Conectar al proyecto (solo la primera vez):
   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   ```
   El `project-ref` está en la URL de tu proyecto: `https://supabase.com/dashboard/project/<project-ref>`

3. Aplicar todas las migraciones pendientes:
   ```bash
   supabase db push
   ```

### Opción B — SQL Editor de Supabase (manual)

1. Ir a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor**
2. Copiar y pegar el contenido del archivo `.sql`
3. Ejecutar

> ⚠️ **Nunca modifiques la base de datos directamente sin crear primero el archivo de migración.**

## Estado de migraciones

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| *(ninguna aún — se agregan en Fase 1)* | | |
