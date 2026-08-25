const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Barranquilla1.3002011801@db.phmhlbodkoicjctlamah.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();

    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workshop_profiles'
    `);
    
    console.log('workshop_profiles columns:', res.rows.map(r => r.column_name));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
