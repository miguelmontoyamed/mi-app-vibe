-- Script de Inserción de Inventario para TechRepair Master
-- Generado automáticamente desde el archivo de Excel

DO $$
DECLARE
  v_workshop_id uuid;
BEGIN
  -- Obtener el workshop_id del usuario (como acordamos, jaiderpr@gmail.com)
  SELECT id INTO v_workshop_id FROM auth.users WHERE email = 'jaiderpr@gmail.com' LIMIT 1;

  IF v_workshop_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Vaciar el inventario existente para este usuario antes de importar el nuevo
  DELETE FROM public.inventory WHERE workshop_id = v_workshop_id;

  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'T377 TAB E 8.0"', 'SAMSUNG', 3, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'T280 TAB A 7.0"', 'SAMSUNG', 1, 150000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'P350 TAB A 8.0"', 'SAMSUNG', 6, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'T295 TAB A(2019) 8.0"', 'SAMSUNG', 2, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'T220/5 A7 LITE 8.7"', 'SAMSUNG', 7, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'T500 A7 10.4"', 'SAMSUNG', 6, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X200/5 A8 10.1"', 'SAMSUNG', 6, 200000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X110/5 A9', 'SAMSUNG', 7, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X210/5 A9 PLUS', 'SAMSUNG', 6, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'P615 S6 LITE ORIGINAL', 'SAMSUNG', 10, 220000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'T870 S7 11.0"', 'SAMSUNG', 2, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'T730/3 S7 FE', 'SAMSUNG', 3, 310000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X700 S8 11.0"', 'SAMSUNG', 3, 220000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X516 S9 FE', 'SAMSUNG', 2, 250000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'P670 PHABLET', 'LENOVO', 2, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'PB1 750 PHAB 2GN', 'LENOVO', 5, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'YT3 850F YOGA TAB 3', 'LENOVO', 18, 150000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'YT3 X90F YOGA TAB 3 PLUS', 'LENOVO', 1, 150000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'YT X705 YOGA SMART 10.1"', 'LENOVO', 9, 195000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, '7305 M7 2DA', 'LENOVO', 2, 100000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 8505F M8 1RA', 'LENOVO', 5, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 300F M8 2DA', 'LENOVO', 12, 120000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 300FV M8 4TA', 'LENOVO', 2, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 310 M9', 'LENOVO', 1, 140000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X505 M10', 'LENOVO', 4, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X306 M10 HD', 'LENOVO', 8, 130000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'X606 M10 HD PLUS', 'LENOVO', 4, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 328 M10 3RA', 'LENOVO', 5, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 125/8F M10 PLUS 3RA', 'LENOVO', 6, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB330 FU M11', 'LENOVO', 4, 230000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'J606 P11', 'LENOVO', 6, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'YT J706 YOGA TAB 11', 'LENOVO', 1, 250000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 350/1 TAB PLUS', 'LENOVO', 3, 255000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'TB 311 TAB 10.1', 'LENOVO', 4, 190000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'AGS W09 MEDIAPAD T3 10"', 'HUAWEI', 2, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'BAH2 W19 M5 LITE 10.1"', 'HUAWEI', 3, 210000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'AGR W09 MATEPAD T10 9.7"', 'HUAWEI', 5, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'MATEPAD T10S', 'HUAWEI', 5, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'AGS5 W09 MATEPAD 10.4"', 'HUAWEI', 5, 160000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'DBR W00 MATEPAD 11', 'HUAWEI', 6, 200000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'MRX W19/09/29  AL09/19 MATEPAD PRO 10.8"', 'HUAWEI', 2, 330000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'HONOR PAD X8A', 'HUAWEI', 3, 200000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'HONOR PAD X8', 'HUAWEI', 7, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'HONOR PAD X9', 'HUAWEI', 2, 250000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'MATEPAD SE 11"', 'HUAWEI', 7, 210000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'MATEPAD PRO', 'HUAWEI', 2, 170000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'MATEPAD 11', 'HUAWEI', 1, 180000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'REDMI PAD SE 8.7"', 'XIAOMI', 4, 205000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'REDMI PAD SE 11.0"', 'XIAOMI', 3, 230000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'REDMI PAD PRO 12.1"', 'XIAOMI', 2, 280000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'REDMI PAD S2', 'XIAOMI', 5, 280000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'MI PAD  5', 'XIAOMI', 3, 245000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'A1538/50 IPAD MINI 4', 'APPLE', 4, 240000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'IPAD MINI 5', 'APPLE', 4, 240000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'A1566/7 IPAD AIR 2', 'APPLE', 1, 420000);
  INSERT INTO public.inventory (workshop_id, name, category, stock, price)
  VALUES (v_workshop_id, 'IPAD 10.5', 'APPLE', 2, 220000);

END $$;