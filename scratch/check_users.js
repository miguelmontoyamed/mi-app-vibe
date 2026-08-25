const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Barranquilla1.3002011801@db.phmhlbodkoicjctlamah.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();

    // Obtener los usuarios de auth.users
    const usersRes = await client.query(`
      SELECT 
        u.id, 
        u.email, 
        u.created_at, 
        u.last_sign_in_at
      FROM auth.users u
    `);
    
    // Obtener información de actividad (talleres, reparaciones, inventario) por usuario
    // auth.users -> profiles -> workshops -> repairs / inventory
    const activityRes = await client.query(`
      SELECT 
        u.id as user_id,
        u.email,
        p.workshop_id,
        COUNT(DISTINCT r.id) as total_repairs,
        COUNT(DISTINCT i.id) as total_inventory_items,
        MAX(r.created_at) as last_repair_date,
        MAX(i.created_at) as last_inventory_date
      FROM auth.users u
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN repairs r ON p.workshop_id = r.workshop_id
      LEFT JOIN inventory i ON p.workshop_id = i.workshop_id
      GROUP BY u.id, u.email, p.workshop_id
    `);

    const users = usersRes.rows;
    const activity = activityRes.rows;

    const report = users.map(u => {
      const act = activity.find(a => a.user_id === u.id);
      
      const reparaciones = act ? act.total_repairs : 0;
      const inventario = act ? act.total_inventory_items : 0;
      const estado = (reparaciones > 0 || inventario > 0) ? 'ACTIVO' : 'INACTIVO';

      return {
        email: u.email,
        creado_el: new Date(u.created_at).toISOString().split('T')[0],
        ultimo_ingreso: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString().split('T')[0] : 'Nunca',
        reparaciones: reparaciones,
        inventario: inventario,
        ultima_actividad: (act && act.last_repair_date) ? new Date(act.last_repair_date).toISOString().split('T')[0] : 'Ninguna',
        estado: estado
      };
    });

    console.table(report);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
