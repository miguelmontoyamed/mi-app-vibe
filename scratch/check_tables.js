const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Barranquilla1.3002011801@db.phmhlbodkoicjctlamah.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables:', res.rows.map(r => r.table_name));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
