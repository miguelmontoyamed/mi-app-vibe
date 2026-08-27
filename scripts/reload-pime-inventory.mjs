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
  console.error('❌ Error: Credenciales de Supabase no encontradas (SUPABASE_SERVICE_ROLE_KEY requerida).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const excelPath = 'C:\\Users\\TORETO\\Desktop\\LISTA DE PRECIOS SEPTIEMBRE.xlsx';
const fallbackExcelPath = 'C:\\Users\\MIGUEL\\Downloads\\inventario reouestos PIME.xlsx';
const fallbackPath2 = './inventario reouestos PIME.xlsx';
const finalPath = fs.existsSync(excelPath) ? excelPath : (fs.existsSync(fallbackExcelPath) ? fallbackExcelPath : fallbackPath2);

if (!fs.existsSync(finalPath)) {
  console.error(`❌ Error: Archivo Excel no encontrado en ${excelPath}`);
  process.exit(1);
}

const SHEET_TYPE_MAP = {
  'PANTALLAS': 'Pantalla',
  'VISORES': 'Visor',
  'TACTILES': 'Táctil',
  'DISPLAY': 'Display',
  'BATERIAS': 'Batería',
  'OCAS Y POLARIZADOS': 'Insumo'
};

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

  // 1. LIMPIEZA TOTAL DEL INVENTARIO EXISTENTE
  console.log('🧹 Vaciando inventario actual de este taller...');
  const { error: delErr } = await supabase.from('inventory').delete().eq('workshop_id', workshopId);
  if (delErr) {
    console.error('Error al limpiar el inventario:', delErr);
    process.exit(1);
  }
  console.log('✅ Inventario previo eliminado correctamente.');

  // 2. PARSEO EXHAUSTIVO DE TODAS LAS HOJAS DEL EXCEL
  console.log(`📊 Leyendo Excel desde: ${finalPath}`);
  const workbook = xlsx.readFile(finalPath);
  const itemsToInsert = [];
  let skippedZero = 0;

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rawRows.length === 0) continue;

    const defaultType = SHEET_TYPE_MAP[sheetName.trim().toUpperCase()] || sheetName;
    let currentBrand = '';

    if (sheetName === 'OCAS Y POLARIZADOS') {
      let currentInsumo = 'OCA';
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const col0 = String(row[0] || '').trim();
        const col1 = String(row[1] || '').trim();
        if (!col0 && !col1) continue;

        if (col0.toUpperCase().includes('OCA')) {
          currentInsumo = 'OCA';
          continue;
        }
        if (col0.toUpperCase().includes('POLARIZADO')) {
          currentInsumo = 'Polarizado';
          continue;
        }
        if (col0.toUpperCase().includes('UNIDADES') || col1.toUpperCase().includes('PULGADAS')) {
          continue;
        }

        const qty = parseInt(col0.replace(/[^\d]/g, ''), 10);
        const inches = col1.replace(/¨|"|''/g, '').trim();
        if (!isNaN(qty) && qty > 0 && inches) {
          itemsToInsert.push({
            workshop_id: workshopId,
            name: `${currentInsumo} Universal ${inches}"`,
            category: 'INSUMOS',
            stock: qty,
            price: 0
          });
        }
      }
      continue;
    }

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const col0 = String(row[0] || '').trim();
      const col1 = String(row[1] || '').trim();
      const col2 = String(row[2] || '').trim();
      const col3 = String(row[3] || '').trim();
      const col4 = String(row[4] || '').trim();

      // Encabezado de marca
      if (col0 && !col1 && !col3 && isNaN(Number(col0))) {
        const upper = col0.toUpperCase();
        if (!upper.includes('INVENTARIO') && !upper.includes('MODELO') && !upper.includes('TOTAL') && !upper.includes('USADA')) {
          currentBrand = upper;
          continue;
        }
      }

      if (col0.toUpperCase().includes('MODELO') || col1.toUpperCase().includes('REFERENCIA') || col0.toUpperCase().includes('TOTAL') || col1.toUpperCase().includes('TOTAL')) {
        continue;
      }
      if (col0.toUpperCase().includes('USADA') || col1.toUpperCase().includes('USADA')) {
        continue;
      }

      if (!col0 && !col1) continue;

      if ((col0 === 'SAMSUNG' || col0 === 'LENOVO' || col0 === 'HUAWEI' || col0 === 'APPLE' || col0 === 'XIAOMI' || col0 === 'UNIVERSALES' || col0 === 'ASUS') && !col3) {
        currentBrand = col0;
        continue;
      }

      let rawStock = '';
      let rawCost = '';

      if (sheetName === 'BATERIAS') {
        rawStock = col2;
        rawCost = col3;
      } else if (sheetName === 'DISPLAY') {
        rawCost = col3;
        rawStock = col4;
      } else {
        rawStock = col4 !== '' ? col4 : col2;
        rawCost = col3;
      }

      // Stock
      let stock = 0;
      const stockStr = String(rawStock || '').trim().toLowerCase();
      if (stockStr && !stockStr.includes('no hay') && !stockStr.includes('sin stock') && stockStr !== 'no' && stockStr !== '0') {
        const parsed = parseInt(stockStr.replace(/[^\d-]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          stock = parsed;
        }
      }

      // Costo
      let cost = 0;
      const costStr = String(rawCost || '').trim();
      if (costStr) {
        const parsedCost = parseFloat(costStr.replace(/[^\d.]/g, ''));
        if (!isNaN(parsedCost)) cost = parsedCost;
      }

      // REGLA ESTRICTA: Omitir repuestos sin stock
      if (stock <= 0) {
        skippedZero++;
        continue;
      }

      const brandStr = currentBrand ? currentBrand : '';
      let cleanModel = col0;
      let cleanRef = col1;

      if (cleanModel.toUpperCase().startsWith(brandStr)) {
        cleanModel = cleanModel.substring(brandStr.length).trim();
      }

      const fullName = `${defaultType} ${brandStr} ${cleanModel} ${cleanRef}`.replace(/\s+/g, ' ').trim();
      const category = sheetName.trim().toUpperCase();

      itemsToInsert.push({
        workshop_id: workshopId,
        name: fullName,
        category: category,
        stock: stock,
        price: cost
      });
    }
  }

  console.log(`📦 Se procesaron ${itemsToInsert.length} repuestos clarificados con stock > 0 (Omitidos ${skippedZero} sin stock).`);

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

  console.log(`🎉 ÉXITO: Se insertaron ${itemsToInsert.length} repuestos limpios, categorizados y con tipo explícito.`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
