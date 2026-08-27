const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envFile = fs.readFileSync('.env.local', 'utf8') + '\n' + fs.readFileSync('.env', 'utf8');
const envVars = Object.fromEntries(
  envFile.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const [key, ...value] = line.split('=');
    return [key.trim(), value.join('=').trim().replace(/^"|"$/g, '')];
  })
);
const supabase = createClient(envVars['EXPO_PUBLIC_SUPABASE_URL'], envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY']);

async function testMiguel() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ 
    email: 'miguelmontoyabq@gmail.com', 
    password: 'password123' 
  });
  if (authErr) {
    console.error('Auth Error:', authErr);
    // Maybe try '123456'
    const { data: authData2, error: authErr2 } = await supabase.auth.signInWithPassword({ 
      email: 'miguelmontoyabq@gmail.com', 
      password: 'password' 
    });
    if (authErr2) {
       console.error('Auth Error 2:', authErr2);
       return;
    }
  }
  const { data: profile } = await supabase.from('profiles').select('*').single();
  console.log('Miguel profile:', profile);
  
  const { data: inv, error: invErr } = await supabase.from('inventory').select('*');
  console.log('Inventory count for Miguel:', inv?.length);
  console.log('Error:', invErr);
}
testMiguel();
