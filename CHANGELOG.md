# Changelog

Todas las cambios notables de **TechRepair Master** se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [1.1.0] - 2026-08-19

### Added
- **Gestión de técnicos**: el dueño puede editar el % de comisión de cada
  técnico en cualquier momento (edición inline en la tarjeta "Gestión de
  Técnicos").
- **Ingresos por técnico**: cada técnico muestra cuánto generó (trabajos
  entregados) y su ganancia según el % de comisión.
- **Valor de repuesto (opcional)**: al recibir un equipo se puede registrar el
  valor del repuesto usado; se resta del presupuesto para calcular la utilidad
  real. El técnico puede editarlo después desde el detalle de la orden.
- **Utilidad Neta** en el Control de Ingresos del panel Admin (ingresos menos
  repuestos).
- **Compartir PDF por WhatsApp** desde el recibo (menú nativo en móvil con el
  PDF adjunto; en web abre WhatsApp con el resumen del recibo).
- Migración de base de datos `supabase/add-parts-cost.sql` (columna
  `parts_cost` en `repairs`).

### Fixed
- Texto desbordado en iconos circulares y pills en Safari (avatar, botones de
  inventario, badges de estado, chips, etc.).

### Changed
- La comisión del técnico ahora se calcula sobre la **utilidad** (presupuesto
  − repuesto) en lugar del presupuesto bruto.
- El recibo muestra la línea "Repuesto" cuando aplica, en pantalla y en el PDF.

## [1.0.0] - 2026

### Added
- **Monetización**: panel de pago con Bre-B, periodo de prueba de 3 meses,
  renovación por WhatsApp y días acumulativos de suscripción.
- **Super Admin**: panel privado del dueño con búsqueda de perfiles por correo
  y activación de días de pago.
- **Control de Ingresos**: ingresos cobrados, en trámite y valor del inventario
  en piezas.
- **RBAC estricto**: técnicos ven solo sus órdenes, tab Admin oculto,
  inventario de solo lectura para técnicos y restricción del panel de ajustes
  al rol Admin.
- **Recibo imprimible / PDF** con membrete del taller (NIT, dirección, teléfono).
- Invitación de técnicos por enlace con límite de 5 técnicos por taller.

### Fixed
- Pantallas en blanco en navegadores antiguos (ErrorBoundary + polyfill de
  `structuredClone` + smoke test cross-engine).
- Botones de acción rápida del dashboard en web (aplanado de `Link asChild`).
- Confirmación de NIT/IVA con validación módulo 11 DIAN.

### Changed
- **Diseño Material Design 3 + Liquid Glass** aplicado al dashboard y al
  esqueleto global (tokens MD3, capas de estado y tarjetas Glass).
- WhatsApp como único canal de contacto comercial (se eliminaron datos
  ficticios).

### Security
- Script de endurecimiento RLS (`supabase/rls-hardening.sql`) y auditoría de
  seguridad documentada.
