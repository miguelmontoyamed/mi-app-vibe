const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8') + '\n' + fs.readFileSync('.env', 'utf8');
const envVars = Object.fromEntries(
  envFile.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const [key, ...value] = line.split('=');
    return [key.trim(), value.join('=').trim().replace(/^"|"$/g, '')];
  })
);
const url = envVars['EXPO_PUBLIC_SUPABASE_URL'] + '/rest/v1/profiles?select=*,auth.users!inner(email)&email=in.(jaiderpr@gmail.com,miguelmontoyabq@gmail.com)';
fetch(url, {
  headers: {
    'apikey': envVars['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': 'Bearer ' + envVars['SUPABASE_SERVICE_ROLE_KEY']
  }
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2))).catch(e => console.error(e));
