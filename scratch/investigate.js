const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Barranquilla1.3002011801@db.phmhlbodkoicjctlamah.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    
    // Update inventory
    const res = await client.query("UPDATE inventory SET stock = 5 WHERE name ILIKE '%iphone 12%' AND stock = 9 RETURNING *");
    console.log('Fixed inventory:', res.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}
run();
