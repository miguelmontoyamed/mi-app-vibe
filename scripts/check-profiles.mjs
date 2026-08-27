import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
  envFile.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const [key, ...value] = line.split('=');
    return [key.trim(), value.join('=').trim().replace(/^"|"$/g, '')];
  })
);

const supabase = createClient(envVars['EXPO_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').in('email', ['jaiderpr@gmail.com', 'miguelmontoyabq@gmail.com']);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}

run();
