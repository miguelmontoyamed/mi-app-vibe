import fs from 'fs';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno
const loadEnv = () => {
  const envs = {};
  const readAndParse = (filePath) => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          envs[key] = val.replace(/^["']|["']$/g, '');
        }
      });
    }
  };
  readAndParse('.env');
  readAndParse('.env.local');
  return envs;
};

const env = loadEnv();
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Credenciales de Supabase no encontradas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const excelPath = 'C:\\Users\\MIGUEL\\Downloads\\inventario reouestos PIME.xlsx';
const fallbackPath = './inventario reouestos PIME.xlsx';
const finalPath = fs.existsSync(excelPath) ? excelPath : fallbackPath;

if (!fs.existsSync(finalPath)) {
  console.error(`❌ Error: Archivo Excel no encontrado en ${finalPath}`);
  process.exit(1);
}

async function main() {
  console.log('🔍 Localizando taller de jaiderpr@gmail.com...');
  const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) { console.error('Error listando usuarios:', uErr); process.exit(1); }

  const targetUser = usersData.users.find(u => u.email === 'jaiderpr@gmail.com');
  if (!targetUser) { console.error('Usuario jaiderpr@gmail.com no existe.'); process.exit(1); }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetUser.id).single();
  const workshopId = profile?.workshop_id;

  if (!workshopId) {
    console.error('El usuario no tiene workshop_id asociado.');
    process.exit(1);
  }

  console.log(`🏢 Taller ID detectado: ${workshopId}`);

  // 1. LIMPIEZA TOTAL DEL INVENTARIO EXISTENTE PARA ESTE TALLER
  console.log('🧹 Vaciando inventario actual de este taller...');
  const { error: delErr } = await supabase.from('inventory').delete().eq('workshop_id', workshopId);
  if (delErr) {
    console.error('Error al limpiar el inventario:', delErr);
    process.exit(1);
  }
  console.log('✅ Inventario previo eliminado correctamente.');

  // 2. PARSEO DE TODAS LAS HOJAS DEL EXCEL
  console.log(`📊 Leyendo Excel desde: ${finalPath}`);
  const workbook = xlsx.readFile(finalPath);
  const itemsToInsert = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rawRows.length === 0) continue;

    let currentBrand = 'Repuestos';

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const col0 = String(row[0] || '').trim();
      const col1 = String(row[1] || '').trim();
      const col2 = String(row[2] || '').trim();
      const col3 = String(row[3] || '').trim();

      // Detectar encabezado de marcas (ej: "SAMSUNG", "LENOVO", "HUAWEI", "APPLE")
      if (col0 && !col1 && !col2 && !col3 && isNaN(Number(col0))) {
        if (!col0.toLowerCase().includes('inventario') && !col0.toLowerCase().includes('modelo')) {
          currentBrand = col0.toUpperCase();
        }
        continue;
      }

      // Omitir filas de títulos
      if (col0.toLowerCase().includes('modelo') || col1.toLowerCase().includes('referencia') || col2.toLowerCase().includes('costo')) {
        continue;
      }

      if (!col0 && !col1) continue;

      // Armar nombre del repuesto
      let name = '';
      if (col0.toUpperCase().startsWith(currentBrand)) {
        name = `${col0} ${col1}`.replace(/\s+/g, ' ').trim();
      } else {
        name = `${currentBrand} ${col0} ${col1}`.replace(/\s+/g, ' ').trim();
      }

      // Parsear costo
      let cost = 0;
      const parsedCost = parseFloat(col2.replace(/[^\d.]/g, ''));
      if (!isNaN(parsedCost)) cost = parsedCost;

      // Parsear stock / recibido
      let stock = 1;
      const stockStr = col3.toLowerCase();
      if (stockStr.includes('no hay') || stockStr.includes('sin stock') || stockStr === 'no') {
        stock = 0;
      } else {
        const parsedStock = parseInt(stockStr.replace(/[^\d-]/g, ''), 10);
        if (!isNaN(parsedStock) && parsedStock >= 0) stock = parsedStock;
      }

      itemsToInsert.push({
        workshop_id: workshopId,
        name: name,
        category: currentBrand,
        stock: stock,
        price: 0 // Precio de venta inicial para cotización libre
      });
    }
  }

  console.log(`📦 Se procesaron ${itemsToInsert.length} repuestos listos para importar.`);

  // 3. INSERCIÓN MASIVA POR LOTES
  const batchSize = 100;
  for (let i = 0; i < itemsToInsert.length; i += batchSize) {
    const batch = itemsToInsert.slice(i, i + batchSize);
    const { error: insErr } = await supabase.from('inventory').insert(batch);
    if (insErr) {
      console.error(`❌ Error insertando lote ${i}:`, insErr);
      process.exit(1);
    }
  }

  console.log(`🎉 ÉXITO: Se insertaron ${itemsToInsert.length} repuestos limpios en Supabase.`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
