# Conexión a Supabase (guía rápida)

La app necesita una base de datos en la nube para que la información de
clientes, técnicos y reparaciones sea **accesible entre dispositivos** y
**nunca se pierda** (hoy vive solo en el navegador de cada usuario).

> No se puede crear la cuenta por ti porque requiere tu correo, verificación
> y es tu cuenta. Son **5 minutos manuales**; el resto ya está preparado en
> este repo.

## Paso 1 — Crear el proyecto (gratis)
1. https://supabase.com → "Start your project" → regístrate (GitHub o email).
2. Dashboard → "New project".
3. **Name**: `techrepair-master` · **Region**: South America (São Paulo).
4. **Plan**: Free → "Create new project" → espera 1-2 min.

## Paso 2 — Pegar el esquema de la base de datos
1. En tu proyecto, menú izquierdo → **SQL** → **New query**.
2. Abre el archivo `supabase/schema.sql` de este repo y **copia todo** su contenido.
3. Pégalo en el editor y **Run**. (Esto crea: talleres, perfiles, clientes,
   reparaciones, inventario, las reglas de seguridad RLS correctas y el
   trigger que crea tu perfil **dueño/admin automáticamente al registrarte**.)

## Paso 3 — Copiar las claves a la app
1. **Settings (⚙️) → API**.
2. Copia **Project URL** y la **anon public** key (empieza con `eyJ...`).
3. Abre el archivo **`.env`** de este repo y pega ambos valores:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://XXXXXXXX.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Reinicia el servidor (`npm start`) para que tome las variables.

## Paso 4 — Registrar tu cuenta de QA (Admin / Dueño)
Con la app configurada: en el login escoge **crear cuenta** (o **Iniciar con
Google** según lo que definamos). Como es la **primera cuenta**, el trigger la
convierte automáticamente en **Dueño/Admin (role admin)** con acceso total a
todo el taller. Sus datos ya quedan en la nube — si vuelves a entrar desde
otro dispositivo, la cuenta y toda la info siguen ahí.

## Seguridad
- La app usa la clave **`anon`** (pública por diseño). La **`service_role`**
  key **no** se comparte ni se pone en la app: solo tú la tienes en Supabase.
- Las **reglas RLS** hacen que cada usuario vea solo los datos de *su* taller,
  y que técnicos y dueños compartan la misma información de sus reparaciones.