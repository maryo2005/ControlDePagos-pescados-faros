-- =============================================
-- CONTROL DE PAGOS - SCHEMA DE BASE DE DATOS
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Tabla de Faros (empresas/puntos de venta)
CREATE TABLE IF NOT EXISTS faros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  ruc TEXT DEFAULT '',
  color TEXT DEFAULT '#3b82f6',
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Productos (tipos de pescado/marisco)
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  orden INT DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de Registros (pedidos, despachos y precios diarios)
CREATE TABLE IF NOT EXISTS registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  faro_id UUID REFERENCES faros(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  pedido_kg NUMERIC(10,2) DEFAULT 0,
  despacho_kg NUMERIC(10,2) DEFAULT 0,
  precio_kg NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, faro_id, producto_id)
);

-- Tabla de Estado Diario (pagos y envío de facturas)
CREATE TABLE IF NOT EXISTS estado_diario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  faro_id UUID REFERENCES faros(id) ON DELETE CASCADE,
  pagado BOOLEAN DEFAULT FALSE,
  monto_pagado NUMERIC(10,2) DEFAULT 0,
  fecha_pago TIMESTAMPTZ,
  nota_pago TEXT DEFAULT '',
  enviado_factura BOOLEAN DEFAULT FALSE,
  fecha_envio_factura TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, faro_id)
);

-- Deshabilitar RLS para simplicidad (app privada)
ALTER TABLE faros ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_diario ENABLE ROW LEVEL SECURITY;

-- Politicas permisivas (acceso completo con anon key)
CREATE POLICY "Allow all on faros" ON faros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on productos" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on registros" ON registros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on estado_diario" ON estado_diario FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Insertar 3 faros con colores
INSERT INTO faros (nombre, ruc, color, orden) VALUES
  ('Faro 1', '', '#10b981', 1),
  ('Faro 2', '', '#3b82f6', 2),
  ('Faro 3', '', '#f43f5e', 3);

-- Insertar productos (pescados y mariscos comunes)
INSERT INTO productos (nombre, orden) VALUES
  ('Abanico', 1),
  ('Almeja', 2),
  ('Marucha', 3),
  ('Choro', 4),
  ('Mocochio', 5),
  ('Cangrejo', 6),
  ('Langostino', 7),
  ('Pulpo', 8),
  ('Pota Remo', 9),
  ('Pota Aleta', 10),
  ('Pota Cuerpo', 11),
  ('Gallinaza', 12),
  ('Cabinza', 13),
  ('Corvina', 14),
  ('Ojo de Uva', 15),
  ('Tollo Azul', 16),
  ('Trambollo', 17),
  ('Caballa', 18),
  ('Suco', 19),
  ('Bonito', 20),
  ('Jurel', 21),
  ('Merluza', 22);
