-- v2: cancelación con motivo en texto libre. Renombra la columna legacy
-- `cancellation_reason` (CHECK de lista fija) a `motivo_cancelacion` (sin CHECK).
alter table public.repairs drop column if exists cancellation_reason;
alter table public.repairs add column if not exists motivo_cancelacion text;

-- Restricción del status incluyendo 'Cancelado / No Reparado'.
alter table public.repairs drop constraint if exists repairs_status_check;
alter table public.repairs add constraint repairs_status_check check (
  status in ('Pendiente','En Proceso','Listo','Entregado','Cancelado / No Reparado')
);
