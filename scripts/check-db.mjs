import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim().replace(/(^"|"$)/g, '');
  }
});

const supabase = createClient(env['EXPO_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  const { data, error } = await supabase.from('inventory').select('*').eq('workshop_id', 'a5d7e033-0f60-4ce3-8d16-4ca6f20359ad');
  console.log('Inventory count:', data?.length);
  const { data: prof, error: e2 } = await supabase.from('profiles').select('*').eq('id', '08a4364d-bb6d-4829-bbc5-30825500f6f7');
  console.log('Miguel profile:', prof);
}
run();
