const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Barranquilla1.3002011801@db.phmhlbodkoicjctlamah.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260825000000_device_trade_in_and_sales.sql'), 'utf-8');
    console.log('Applying migration...');
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

run();
