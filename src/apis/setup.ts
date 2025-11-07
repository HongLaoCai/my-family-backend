import { FastifyInstance } from 'fastify';
import pkg from 'pg';
const { Pool } = pkg;

// ⚙️ Kết nối tới PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'myuser',
  password: process.env.DB_PASSWORD || 'mypassword',
  database: process.env.DB_NAME || 'myfamily',
  port: Number(process.env.DB_PORT) || 5432,
});

// 🧩 Hàm đăng ký route setup
export async function setupApis(server: FastifyInstance) {
  server.get('/api/setup', async (_request, reply) => {
    const client = await pool.connect();

    try {
      // 1️⃣ Kiểm tra xem DB có bảng nào chưa
      const { rows } = await client.query(`
        SELECT COUNT(*) AS count
        FROM information_schema.tables
        WHERE table_schema = 'public';
      `);

      const tableCount = parseInt(rows[0].count, 10);

      if (tableCount > 0) {
        return reply.send({ message: `✅ Database đã có ${tableCount} bảng.` });
      }

      // 2️⃣ Tạo bảng family_members nếu chưa có
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS family_members (
          id VARCHAR(255) NOT NULL PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          gender VARCHAR(10) DEFAULT 'Nam',
          birth_date VARCHAR(10),
          death_date VARCHAR(10),
          phone_numbers VARCHAR(255) DEFAULT NULL NULL,
          address TEXT DEFAULT NULL,
          father_id VARCHAR(255) REFERENCES family_members(id) ON DELETE SET NULL,
          mother_id VARCHAR(255) REFERENCES family_members(id) ON DELETE SET NULL,
          spouse_id VARCHAR(255) REFERENCES family_members(id) ON DELETE SET NULL,          
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await client.query(createTableSQL);
      return reply.send({ message: '✅ Bảng family_members đã được tạo thành công!' });
    } catch (err) {
      server.log.error(err);
      return reply.status(500).send({ error: (err as Error).message });
    } finally {
      client.release();
    }
  });
}


// setup.ts
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        id VARCHAR(255) NOT NULL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        gender VARCHAR(10) DEFAULT 'Nam',
        birth_date VARCHAR(10),
        death_date VARCHAR(10),
        phone_numbers VARCHAR(255) DEFAULT NULL NULL,
        address TEXT,
        father_id VARCHAR(255) REFERENCES family_members(id) ON DELETE SET NULL,
        mother_id VARCHAR(255) REFERENCES family_members(id) ON DELETE SET NULL,
        spouse_id VARCHAR(255) REFERENCES family_members(id) ON DELETE SET NULL,          
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
        );
    `);
    console.log('✅ Đã kiểm tra / tạo bảng family_members');
  } finally {
    client.release();
  }
}
