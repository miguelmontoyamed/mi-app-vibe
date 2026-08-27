import fs from 'fs';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// 1. Cargar variables de entorno de .env y .env.local
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
          const cleanVal = val.replace(/^["']|["']$/g, '');
          envs[key] = cleanVal;
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
  console.error('❌ Error: EXPO_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos.');
  process.exit(1);
}

// 2. Inicializar cliente de Supabase (Service Role para bypass RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// 3. Buscar el archivo Excel de inventario
const excelPath = 'C:\\Users\\MIGUEL\\Downloads\\inventario reouestos PIME.xlsx';
const fallbackExcelPath = './inventario reouestos PIME.xlsx';
const finalPath = fs.existsSync(excelPath) ? excelPath : fallbackExcelPath;

if (!fs.existsSync(finalPath)) {
  console.error(`❌ Error: No se encontró el archivo Excel en ${excelPath} ni en ${fallbackExcelPath}`);
  process.exit(1);
}

console.log(`📊 Leyendo archivo Excel desde: ${finalPath}`);

// 4. Resolver el workshop_id para jaiderpr@gmail.com
async function resolveWorkshopId() {
  console.log('🔍 Consultando taller para jaiderpr@gmail.com...');
  
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('Error listando usuarios:', usersError);
    process.exit(1);
  }
  
  const targetUser = usersData.users.find(u => u.email === 'jaiderpr@gmail.com');
  if (!targetUser) {
    console.error('❌ Error: El usuario jaiderpr@gmail.com no existe en Supabase Auth.');
    process.exit(1);
  }
  
  console.log(`👤 Usuario encontrado: ${targetUser.email} (ID: ${targetUser.id})`);
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUser.id)
    .single();
    
  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Error obteniendo perfil:', profileError);
    process.exit(1);
  }
  
  if (profile && profile.workshop_id) {
    console.log(`✅ Taller existente asociado en perfil: ${profile.workshop_id}`);
    return profile.workshop_id;
  }
  
  console.log('⚠️ El usuario no tiene taller asignado. Buscando taller "PIME Accesorios"...');
  
  const { data: existingWorkshops, error: searchError } = await supabase
    .from('workshops')
    .select('*')
    .eq('name', 'PIME Accesorios');
    
  if (searchError) {
    console.error('Error buscando taller PIME:', searchError);
    process.exit(1);
  }
  
  let workshopId = null;
  if (existingWorkshops && existingWorkshops.length > 0) {
    workshopId = existingWorkshops[0].id;
    console.log(`✅ Taller "PIME Accesorios" encontrado (ID: ${workshopId})`);
  } else {
    console.log('🔨 Creando nuevo taller "PIME Accesorios"...');
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 90);
    
    const { data: newWorkshop, error: createError } = await supabase
      .from('workshops')
      .insert({
        name: 'PIME Accesorios',
        status: 'active',
        trial_ends_at: trialEndsAt.toISOString()
      })
      .select('*')
      .single();
      
    if (createError) {
      console.error('Error creando taller PIME:', createError);
      process.exit(1);
    }
    workshopId = newWorkshop.id;
    console.log(`✅ Taller "PIME Accesorios" creado (ID: ${workshopId})`);
  }
  
  console.log(`🔗 Asociando el taller ${workshopId} al perfil del usuario...`);
  if (profile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ workshop_id: workshopId })
      .eq('id', targetUser.id);
    if (updateError) {
      console.error('Error asociando perfil:', updateError);
      process.exit(1);
    }
  } else {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: targetUser.id,
        workshop_id: workshopId,
        full_name: 'Jaider Pérez',
        role: 'admin',
        is_active: true
      });
    if (insertError) {
      console.error('Error creando perfil:', insertError);
      process.exit(1);
    }
  }
  console.log('✅ Vinculación completada con éxito.');
  return workshopId;
}

// Helper para normalizar cadenas (quitar acentos, minúsculas, recortar)
const normalize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const matchesSynonyms = (key, synonyms) => {
  const normKey = normalize(key);
  return synonyms.some(syn => normalize(syn) === normKey);
};

async function main() {
  const workshopId = await resolveWorkshopId();
  
  // 5. Cargar primera hoja del Excel
  const workbook = xlsx.readFile(finalPath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Omitimos fila 0 y usamos fila 1 como encabezados
  const rawRows = xlsx.utils.sheet_to_json(worksheet, { range: 1 });
  console.log(`📦 Procesando ${rawRows.length} registros del Excel...`);
  
  let currentBrand = 'Repuestos';
  const parsedItems = [];
  
  const nameSynonyms = ['nombre', 'repuesto', 'descripcion', 'articulo', 'item', 'detalle', 'producto'];
  const catSynonyms = ['categoria', 'tipo', 'linea', 'grupo'];
  const stockSynonyms = ['cantidad', 'stock', 'cant', 'unidades', 'existencias', 'recibido', 'recivido'];
  const priceSynonyms = ['precio', 'precio venta', 'venta', 'valor', 'pvp'];
  const costSynonyms = ['costo', 'precio costo', 'valor costo', 'compra'];
  
  for (const row of rawRows) {
    const keys = Object.keys(row);
    if (keys.length === 0) continue;
    
    let rawName = null;
    let rawCategory = null;
    let rawStock = null;
    let rawPrice = null;
    let rawCost = null;
    
    for (const key of keys) {
      const val = row[key];
      if (val === undefined || val === null || val === '') continue;
      
      if (matchesSynonyms(key, nameSynonyms)) rawName = val;
      if (matchesSynonyms(key, catSynonyms)) rawCategory = val;
      if (matchesSynonyms(key, stockSynonyms)) rawStock = val;
      if (matchesSynonyms(key, priceSynonyms)) rawPrice = val;
      if (matchesSynonyms(key, costSynonyms)) rawCost = val;
    }
    
    // Detección de filas que solo son marcas/secciones (ej. SAMSUNG, LENOVO)
    const modeloVal = row['MODELO'];
    const refVal = row['REFERENCIA'];
    const costoVal = row['COSTO'];
    
    const isBrandHeader = modeloVal && !refVal && !costoVal;
    if (isBrandHeader) {
      currentBrand = String(modeloVal).trim();
      continue; // No es un repuesto, es el separador de marca
    }
    
    if (!modeloVal && !refVal && !costoVal && !rawName) continue;
    
    // Construcción del Nombre
    let name = '';
    if (rawName) {
      name = String(rawName).trim();
    } else {
      const modelStr = modeloVal ? String(modeloVal).trim() : '';
      const refStr = refVal ? String(refVal).trim() : '';
      name = `${currentBrand} ${modelStr} ${refStr}`.replace(/\s+/g, ' ').trim();
    }
    
    // Categoría
    let category = rawCategory ? String(rawCategory).trim() : currentBrand;
    if (!category) category = 'Repuestos';
    
    // Stock (cantidad)
    let stockVal = rawStock !== null ? rawStock : row['RECIVIDO'];
    let stock = 1;
    if (stockVal !== undefined && stockVal !== null) {
      const stockStr = String(stockVal).trim().toLowerCase();
      if (stockStr === 'no hay' || stockStr === 'no' || stockStr === 'sin stock') {
        stock = 0;
      } else {
        const parsedStock = parseInt(stockStr.replace(/[^\d-]/g, ''), 10);
        if (!isNaN(parsedStock) && parsedStock >= 0) {
          stock = parsedStock;
        }
      }
    }
    
    // Precio de Venta (default 0)
    let price = 0;
    if (rawPrice !== null && rawPrice !== undefined) {
      const parsedPrice = parseFloat(String(rawPrice).replace(/[^\d.]/g, ''));
      if (!isNaN(parsedPrice) && parsedPrice >= 0) {
        price = parsedPrice;
      }
    }
    
    // Costo (para logging / visualización)
    let cost = 0;
    if (rawCost !== null && rawCost !== undefined) {
      const parsedCost = parseFloat(String(rawCost).replace(/[^\d.]/g, ''));
      if (!isNaN(parsedCost) && parsedCost >= 0) {
        cost = parsedCost;
      }
    }
    
    // 🔴 REGLA DE NEGOCIO: No agregar al inventario repuestos sin stock
    if (stock <= 0) {
      continue;
    }
    
    parsedItems.push({
      name,
      category,
      stock,
      price,
      cost
    });
  }
  
  console.log(`📦 Se mapearon ${parsedItems.length} repuestos del Excel.`);
  
  // 6. Consultar los repuestos existentes en la base de datos para este taller
  const { data: existingInventory, error: fetchError } = await supabase
    .from('inventory')
    .select('*')
    .eq('workshop_id', workshopId);
    
  if (fetchError) {
    console.error('Error consultando el inventario actual:', fetchError);
    process.exit(1);
  }
  
  const existingMap = new Map();
  if (existingInventory) {
    existingInventory.forEach((item) => {
      existingMap.set(item.name.toLowerCase().trim(), item);
    });
  }
  
  const allUpserts = [];
  const consoleRows = [];
  let insertCount = 0;
  let updateCount = 0;
  
  for (const item of parsedItems) {
    const existing = existingMap.get(item.name.toLowerCase().trim());
    let status = 'Insertado';
    let upsertRow = {
      workshop_id: workshopId,
      name: item.name,
      category: item.category,
      stock: item.stock,
      price: item.price
    };
    
    if (existing) {
      status = 'Actualizado';
      upsertRow.id = existing.id;
      updateCount++;
    } else {
      insertCount++;
    }
    
    allUpserts.push(upsertRow);
    consoleRows.push({
      name: item.name,
      category: item.category,
      stock: item.stock,
      cost: item.cost,
      price: item.price,
      status: status
    });
  }
  
  // 7. Ejecutar inserción / actualización masiva (upsert) en lotes de 100
  console.log('🚀 Guardando registros en la base de datos de Supabase...');
  const batchSize = 100;
  for (let i = 0; i < allUpserts.length; i += batchSize) {
    const batch = allUpserts.slice(i, i + batchSize);
    const { error: upsertError } = await supabase
      .from('inventory')
      .upsert(batch);
      
    if (upsertError) {
      console.error(`❌ Error al guardar lote de ${i} a ${i + batch.length}:`, upsertError);
      process.exit(1);
    }
  }
  
  // 8. Imprimir tabla formateada
  const colWidths = [45, 18, 6, 12, 12, 12];
  const padRight = (str, len) => String(str).padEnd(len).substring(0, len);
  const padLeft = (str, len) => String(str).padStart(len).substring(0, len);
  
  const separator = `+${colWidths.map(w => '-'.repeat(w + 2)).join('+')}+`;
  const headers = ['Nombre', 'Categoría', 'Stock', 'Costo Excel', 'Precio Venta', 'Estado'];
  
  console.log('\n📋 LISTADO DE REPUESTOS PROCESADOS:');
  console.log(separator);
  console.log(`| ${headers.map((h, idx) => padRight(h, colWidths[idx])).join(' | ')} |`);
  console.log(separator);
  
  for (const r of consoleRows) {
    console.log(`| ${[
      padRight(r.name, colWidths[0]),
      padRight(r.category, colWidths[1]),
      padLeft(r.stock, colWidths[2]),
      padLeft(`$${r.cost.toLocaleString()}`, colWidths[3]),
      padLeft(`$${r.price.toLocaleString()}`, colWidths[4]),
      padRight(r.status, colWidths[5])
    ].join(' | ')} |`);
  }
  console.log(separator);
  
  console.log('\n🎉 IMPORTACIÓN MASIVA EXITOSA');
  console.log(`🏢 Taller ID: ${workshopId}`);
  console.log(`📦 Total de repuestos cargados: ${allUpserts.length}`);
  console.log(`➕ Nuevos insertados: ${insertCount}`);
  console.log(`🔄 Existentes actualizados: ${updateCount}`);
  console.log('----------------------------------------------------');
}

main().catch((err) => {
  console.error('❌ Error general durante la ejecución:', err);
  process.exit(1);
});
