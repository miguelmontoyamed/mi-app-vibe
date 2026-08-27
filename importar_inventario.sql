-- ==============================================================================
-- TECHREPAIR MASTER - IMPORTACIÓN DEFINITIVA Y PURIFICADA DE INVENTARIO PIME
-- ==============================================================================
-- Total repuestos válidos a importar (con stock > 0): 180
-- Total repuestos omitidos (stock 0 / "NO HAY"): 40
--
-- Estructura de nombres clarificada: [Tipo de Repuesto] [Marca] [Modelo] [Referencia]
-- Ejemplos:
--   * Pantalla SAMSUNG P350 TAB A 8.0" (Stock: 6)
--   * Visor LENOVO TB 370 P12 (Stock: 6)
--   * Batería SAMSUNG EB BT355ABA GALAXY TAB A 8.0 (Stock: 8)
-- ==============================================================================

DO $$
DECLARE
  v_workshop_id uuid;
BEGIN
  -- 1. Obtener el taller de Jaider Pérez
  SELECT workshop_id INTO v_workshop_id 
  FROM public.profiles 
  WHERE id = (SELECT id FROM auth.users WHERE email = 'jaiderpr@gmail.com' LIMIT 1);

  IF v_workshop_id IS NULL THEN
    -- Fallback si no está en profiles: buscar en workshops
    SELECT id INTO v_workshop_id FROM public.workshops WHERE name ILIKE '%PIME%' LIMIT 1;
  END IF;

  IF v_workshop_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el taller de jaiderpr@gmail.com ni taller PIME.';
  END IF;

  -- 2. Limpiar inventario previo contaminado
  DELETE FROM public.inventory WHERE workshop_id = v_workshop_id;

  -- 3. Insertar repuestos clarificados con stock real
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG T377 TAB E 8.0"', 'PANTALLAS', 3, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG T280 TAB A 7.0"', 'PANTALLAS', 1, 150000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG P350 TAB A 8.0"', 'PANTALLAS', 6, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG T295 TAB A(2019) 8.0"', 'PANTALLAS', 2, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG T220/5 A7 LITE 8.7"', 'PANTALLAS', 7, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG T500 A7 10.4"', 'PANTALLAS', 6, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG X200/5 A8 10.1"', 'PANTALLAS', 6, 200000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG X110/5 A9', 'PANTALLAS', 7, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG X210/5 A9 PLUS', 'PANTALLAS', 6, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG P615 S6 LITE ORIGINAL', 'PANTALLAS', 10, 220000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG T870 S7 11.0"', 'PANTALLAS', 2, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG T730/3 S7 FE', 'PANTALLAS', 3, 310000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG X700 S8 11.0"', 'PANTALLAS', 3, 220000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla SAMSUNG X516 S9 FE', 'PANTALLAS', 2, 250000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO P670 PHABLET', 'PANTALLAS', 2, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO PB1 750 PHAB 2GN', 'PANTALLAS', 5, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO YT3 850F YOGA TAB 3', 'PANTALLAS', 18, 150000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO YT3 X90F YOGA TAB 3 PLUS', 'PANTALLAS', 1, 150000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO YT X705 YOGA SMART 10.1"', 'PANTALLAS', 9, 195000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO 7305 M7 2DA', 'PANTALLAS', 2, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 8505F M8 1RA', 'PANTALLAS', 5, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 300F M8 2DA', 'PANTALLAS', 12, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 300FV M8 4TA', 'PANTALLAS', 2, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 310 M9', 'PANTALLAS', 1, 140000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO X505 M10', 'PANTALLAS', 4, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO X306 M10 HD', 'PANTALLAS', 8, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO X606 M10 HD PLUS', 'PANTALLAS', 4, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 328 M10 3RA', 'PANTALLAS', 5, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 125/8F M10 PLUS 3RA', 'PANTALLAS', 6, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB330 FU M11', 'PANTALLAS', 4, 230000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO J606 P11', 'PANTALLAS', 6, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO YT J706 YOGA TAB 11', 'PANTALLAS', 1, 250000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 350/1 TAB PLUS', 'PANTALLAS', 3, 255000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla LENOVO TB 311 TAB 10.1', 'PANTALLAS', 4, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI AGS W09 MEDIAPAD T3 10"', 'PANTALLAS', 2, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI BAH2 W19 M5 LITE 10.1"', 'PANTALLAS', 3, 210000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI AGR W09 MATEPAD T10 9.7"', 'PANTALLAS', 5, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI MATEPAD T10S', 'PANTALLAS', 5, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI AGS5 W09 MATEPAD 10.4"', 'PANTALLAS', 5, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI DBR W00 MATEPAD 11', 'PANTALLAS', 6, 200000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI MRX W19/09/29 AL09/19 MATEPAD PRO 10.8"', 'PANTALLAS', 2, 330000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI HONOR PAD X8A', 'PANTALLAS', 3, 200000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI HONOR PAD X8', 'PANTALLAS', 7, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI HONOR PAD X9', 'PANTALLAS', 2, 250000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI MATEPAD SE 11"', 'PANTALLAS', 7, 210000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI MATEPAD PRO', 'PANTALLAS', 2, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla HUAWEI MATEPAD 11', 'PANTALLAS', 1, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla XIAOMI REDMI PAD SE 8.7"', 'PANTALLAS', 4, 205000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla XIAOMI REDMI PAD SE 11.0"', 'PANTALLAS', 3, 230000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla XIAOMI REDMI PAD PRO 12.1"', 'PANTALLAS', 2, 280000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla XIAOMI REDMI PAD S2', 'PANTALLAS', 5, 280000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla XIAOMI MI PAD 5', 'PANTALLAS', 3, 245000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla APPLE A1538/50 IPAD MINI 4', 'PANTALLAS', 4, 240000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla APPLE IPAD MINI 5', 'PANTALLAS', 4, 240000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla APPLE A1566/7 IPAD AIR 2', 'PANTALLAS', 1, 420000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Pantalla APPLE IPAD 10.5', 'PANTALLAS', 2, 220000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG T295 TAB A(2019) 8.0"', 'VISORES', 6, 30000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG T220/5 A7 LITE 8.7"', 'VISORES', 8, 30000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG T500 A7 10.4"', 'VISORES', 7, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X200/5 A8 10.1"', 'VISORES', 3, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X110/5 A9', 'VISORES', 7, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X210/5 A9 PLUS', 'VISORES', 4, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG P615 S6 LITE', 'VISORES', 14, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG T860 S6', 'VISORES', 3, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG T870 S7 11.0"', 'VISORES', 7, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG T733 S7 FE', 'VISORES', 4, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X700 S8 11.0"', 'VISORES', 2, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X900 S8 ULTRA', 'VISORES', 3, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X516 S9 FE', 'VISORES', 6, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X610 S9 FE +', 'VISORES', 5, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG X520 S10FE', 'VISORES', 6, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor SAMSUNG T830 TAB S4', 'VISORES', 1, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO X705 YOGA SMART 10.1"', 'VISORES', 12, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 8505F M8 1G', 'VISORES', 8, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 300FV M8 4G', 'VISORES', 8, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 310 M9', 'VISORES', 5, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO X328 M10', 'VISORES', 12, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO X306 M10 HD', 'VISORES', 5, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO X606 M10 HD PLUS', 'VISORES', 14, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 125/8FU M10 PLUS 3 GN', 'VISORES', 13, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 330 M11', 'VISORES', 4, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO J606 P11', 'VISORES', 6, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 350FU P11 2DA', 'VISORES', 9, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO YT J706 P11 PRO 11.5', 'VISORES', 9, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 370 P12', 'VISORES', 6, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB J706 TAB 11 PRO', 'VISORES', 10, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 350/1 TAB PLUS', 'VISORES', 9, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor LENOVO TB 311 TAB 10.1', 'VISORES', 10, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI AGS2 L09 MEDIAPAD T5', 'VISORES', 3, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI KOB2 L09 MATEPAD T8', 'VISORES', 5, 30000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI AGR W09 MATEPAD T 10 9.7"', 'VISORES', 10, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI MATEPAD T 10S', 'VISORES', 9, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI MATEPAD 10.4', 'VISORES', 3, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI DBR W00 MATEPAD 11', 'VISORES', 4, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI MATEPAD X8', 'VISORES', 10, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI MATEPAD X9', 'VISORES', 6, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI MATEPAD SE 11"', 'VISORES', 12, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor HUAWEI MATEPAD X8A', 'VISORES', 6, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor XIAOMI MI PAD 5', 'VISORES', 3, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor XIAOMI REDMI PAD SE 8.7"', 'VISORES', 7, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor XIAOMI REDMI PAD SE 11.0"', 'VISORES', 5, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor XIAOMI REDMI PAD PRO', 'VISORES', 10, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor XIAOMI REDMI PAD S2', 'VISORES', 10, 35000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor APPLE A2379 IPAD 12.9 4/5', 'VISORES', 2, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor APPLE AIR 4/5', 'VISORES', 5, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor APPLE AIR 6', 'VISORES', 6, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor APPLE IPAD PRO 11', 'VISORES', 4, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Visor APPLE IPAD PRO 12.9', 'VISORES', 2, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil SAMSUNG T510/5 TAB A 10.1"', 'TACTILES', 5, 55000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil SAMSUNG T580/5 TAB A 10.1"', 'TACTILES', 5, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil SAMSUNG P205 TAB A 8" PEN', 'TACTILES', 3, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil LENOVO YT3 X50F YOGA TAB 3', 'TACTILES', 2, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil LENOVO X505 M10', 'TACTILES', 4, 45000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD MINI', 'TACTILES', 4, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD MINI 2', 'TACTILES', 3, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE A1538/50 IPAD MINI 4', 'TACTILES', 2, 45000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD MINI 5', 'TACTILES', 2, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD 2', 'TACTILES', 3, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD 6', 'TACTILES', 1, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD 7.8', 'TACTILES', 5, 75000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD 9.7', 'TACTILES', 11, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD 11', 'TACTILES', 2, 75000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD AIR- IPAD 5', 'TACTILES', 1, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE A1566/7 AIR2', 'TACTILES', 3, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE AIR 3', 'TACTILES', 3, 65000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD AIR 4/5', 'TACTILES', 4, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD 10MA', 'TACTILES', 5, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil APPLE IPAD 7, 8 Y 9', 'TACTILES', 15, 55000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil HUAWEI M5 LITE', 'TACTILES', 7, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil HUAWEI MEDIAPAD T3', 'TACTILES', 2, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil UNIVERSALES BLU', 'TACTILES', 3, 30000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Táctil UNIVERSALES TOUCH +', 'TACTILES', 7, 30000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG HQ 3565S/N A7 LITE (T220/225/C)', 'BATERIAS', 7, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG T4000E SAMSUNG TAB 3', 'BATERIAS', 5, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG SP3770E1H Galaxy Note 8.0 (GT-N5100/N5110/N5120 3G 4G LTE WiFi SGH-I467)', 'BATERIAS', 6, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT705FBE TAB S 8.4 (T700/701/705/707)', 'BATERIAS', 2, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG T4500E GALAXY TAB 3 10.1 (GT-P5210/5200/5220/5213/ T4500C/4500U)', 'BATERIAS', 8, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT355ABA GALAXY TAB A 8.0 (SM-T350/355/355C/357W)', 'BATERIAS', 8, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT110ABE GALAXY TAB 3 LITE 7.0', 'BATERIAS', 4, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT230FBE GALAXY TAB 4 7.0 (SM-T230 (WiFi)/231 (3G y WiFi)/235 (3G, 4G/LTE y WiFi)/239/239/233)', 'BATERIAS', 2, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT280ABE GALAXY TAB A 7.0 (T280/5)', 'BATERIAS', 2, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB T515ABU GALAXY TAB A 2019 (T510/5)', 'BATERIAS', 2, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT530FBU GALAXY TAB 4 10.1 (T530/531/535)', 'BATERIAS', 2, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT561ABE GALAXY TAB E 9.6 (T560/1/565/561Y/561M)', 'BATERIAS', 1, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG EB BT810ABA GALAXXY TAB S2 9.7 (SM-T810/5/5C)', 'BATERIAS', 1, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG SP3676B1A TAB 10.1 (GT-P7500/P5100/P7510/P5110/P5113/N8000/10)', 'BATERIAS', 1, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería SAMSUNG T295', 'BATERIAS', 6, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L11C2P32 IDEATAB', 'BATERIAS', 1, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO LENM1029CWP IDEAPAD MIIX', 'BATERIAS', 2, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L15D2K31 YOGA 3', 'BATERIAS', 4, 60000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L15D2K32 YOGA TAB 3 PRO', 'BATERIAS', 6, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L13D1P31 TAB S5000/TAB 2 (A7-10/30) / A3500/F/H/HV', 'BATERIAS', 6, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L18D1P32 SMART TAB M10 (TB X605F / TB X605FC)', 'BATERIAS', 11, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L20D2P32 TAB P11 5G (TB J606F/616F/606N/606M)', 'BATERIAS', 5, 80000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L19D1P31 M8 1RA', 'BATERIAS', 7, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L16D1P32 PHAB 2/PLUS (LEPAD PB2 670N/670M/670Y)', 'BATERIAS', 8, 30000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L12T1P33/31 TAB A7 30 (A3300/HV)', 'BATERIAS', 6, 30000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L15D1P32 PB1 750/M/N', 'BATERIAS', 10, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería LENOVO L14D1P31 PHAB PLUS (PB1 770/N/M)', 'BATERIAS', 15, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería HUAWEI HB3G1H MEDIAPAD 7 LITE', 'BATERIAS', 6, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería HUAWEI HB3080G1EBW MEDIAPAD M1 8.0', 'BATERIAS', 2, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería HUAWEI HB2899C0ECW MEDIAPAD M3 8.4/ T5 10', 'BATERIAS', 4, 70000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1484/74/75 IPAD AIR/ IPAD 5', 'BATERIAS', 5, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1389/1416/30/03/58/59/60 IPAD 3/4', 'BATERIAS', 4, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1547/67/66 IPAD AIR 2/ IPAD 6', 'BATERIAS', 5, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1664/73/74/75 IPAD PRO 9.7', 'BATERIAS', 7, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1798/1852/2134/1701/1709 IPAD PRO 10.5', 'BATERIAS', 2, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1376/95/96/97 IPAD 2', 'BATERIAS', 2, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1445/32/54/55 IPAD MINI 1G', 'BATERIAS', 6, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería APPLE A1546/38/46/50 IPAD MINI 4', 'BATERIAS', 2, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería UNIVERSALES A1376 6500MhA', 'BATERIAS', 27, 20000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería UNIVERSALES HST 356495P 4000MhA', 'BATERIAS', 1, 20000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería UNIVERSALES GD 357090P 3800MhA', 'BATERIAS', 7, 20000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería UNIVERSALES BW 347588P 3800MhA', 'BATERIAS', 3, 20000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería UNIVERSALES BW 357090P 3500MhA', 'BATERIAS', 3, 20000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería UNIVERSALES ZL 30105130P 5000MhA', 'BATERIAS', 3, 40000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería ASUS C11 ME172V FONEPAD 7', 'BATERIAS', 1, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Batería ASUS C11 ME370TG NEXUS 7 1G', 'BATERIAS', 1, 50000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'OCA Universal 10"', 'INSUMOS', 15, 0);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'Polarizado Universal 10"', 'INSUMOS', 4, 0);

  RAISE NOTICE 'Inventario PIME importado con éxito: % repuestos cargados.', 180;
END $$;
