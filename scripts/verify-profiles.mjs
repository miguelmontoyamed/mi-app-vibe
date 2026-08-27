import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno manualmente
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  const envs = {};
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && values.length > 0) envs[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
    });
  }
  
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    content.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && values.length > 0) envs[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
    });
  }
  return envs;
}

const envs = loadEnv();
const supabaseUrl = envs.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = envs.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyProfiles() {
  console.log("=== VERIFICACIÓN DE PERFILES ===");
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, workshop_id, email, is_active')
    .in('email', ['jaiderpr@gmail.com', 'miguelmontoyabq@gmail.com']);

  if (error) {
    console.error("Error consultando profiles:", error);
    return;
  }

  console.log(JSON.stringify(profiles, null, 2));
}

verifyProfiles();
