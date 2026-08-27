import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function main() {
  console.log('🔍 Buscando items con stock <= 0...');
  
  const { data, error } = await supabase
    .from('inventory')
    .select('id, name, stock')
    .lte('stock', 0);
    
  if (error) {
    console.error('Error buscando items:', error);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('✅ No hay items con stock 0.');
    return;
  }
  
  console.log(`🗑️ Eliminando ${data.length} repuestos sin stock...`);
  
  const { error: delError } = await supabase
    .from('inventory')
    .delete()
    .lte('stock', 0);
    
  if (delError) {
    console.error('Error eliminando:', delError);
  } else {
    console.log('✅ Eliminación completada exitosamente.');
  }
}

main();
