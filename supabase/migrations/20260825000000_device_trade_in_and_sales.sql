-- ============================================================================
-- Migración: Módulo de Compra y Venta de Equipos (Celulares / Dispositivos)
-- Fecha: 2026-08-25
-- Descripción: Tabla `devices` con soporte multi-tenant por `workshop_id`,
-- tracking de compra (distribuidor, costo, garantía proveedor, IMEI) y venta
-- (cliente, precio, utilidad, garantía cliente, folio de factura).
-- ============================================================================

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  
  -- Datos de compra y especificaciones del equipo
  brand text not null,
  model text not null,
  color text,
  storage_capacity text,
  imei text not null,
  condition text not null default 'Usado',
  distributor text not null,
  purchase_price numeric not null default 0,
  supplier_warranty_months int not null default 0,
  supplier_warranty_notes text,
  purchase_date date not null default current_date,
  purchase_notes text,
  
  -- Estado y datos de venta
  status text not null default 'En Stock' check (status in ('En Stock', 'Vendido')),
  sale_price numeric,
  sale_date date,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  client_phone text,
  client_document text,
  client_warranty_months int default 0,
  client_warranty_expiry date,
  payment_method text check (payment_method is null or payment_method in ('Efectivo','Transferencia','Tarjeta')),
  invoice_folio text,
  sale_notes text,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices de alto rendimiento
create index if not exists idx_devices_workshop on public.devices(workshop_id);
create index if not exists idx_devices_status on public.devices(workshop_id, status);
create index if not exists idx_devices_imei on public.devices(workshop_id, imei);

-- Habilitar RLS
alter table public.devices enable row level security;

-- Políticas RLS multi-tenant
drop policy if exists "devices_select_policy" on public.devices;
create policy "devices_select_policy" on public.devices
  for select
  using (
    workshop_id in (
      select workshop_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "devices_insert_policy" on public.devices;
create policy "devices_insert_policy" on public.devices
  for insert
  with check (
    workshop_id in (
      select workshop_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "devices_update_policy" on public.devices;
create policy "devices_update_policy" on public.devices
  for update
  using (
    workshop_id in (
      select workshop_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    workshop_id in (
      select workshop_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "devices_delete_policy" on public.devices;
create policy "devices_delete_policy" on public.devices
  for delete
  using (
    workshop_id in (
      select workshop_id from public.profiles where id = auth.uid() and role = 'admin'
    )
  );
