import { FastifyInstance } from 'fastify';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'myuser',
  password: process.env.DB_PASSWORD || 'mypassword',
  database: process.env.DB_NAME || 'myfamily',
  port: Number(process.env.DB_PORT) || 5432,
});

export async function familyMemberApis(server: FastifyInstance) {
  // ✅ ADD — thêm thành viên
  server.post('/api/add-family-member', async (request, reply) => {
    const client = await pool.connect();

    console.log('request.body', request.body);
    try {
      const {
        id,
        full_name,
        gender = 'Nam',
        phone_numbers,
        address,        
        birth_date,
        death_date,
        father_id,
        mother_id,
        spouse_id,
        notes,
      } = request.body as any;

      console.log('request.body', request.body);
      if (!full_name) {
        return reply.status(400).send({ error: 'full_name là bắt buộc' });
      }

      const insertQuery = `
        INSERT INTO family_members (
          id, full_name, gender, phone_numbers, address, birth_date, death_date,
          father_id, mother_id, spouse_id, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9, $10, $11)
        RETURNING *;
      `;

      const result = await client.query(insertQuery, [
        id,
        full_name,
        gender,
        phone_numbers,
        address,
        birth_date || null,
        death_date || null,
        father_id || null,
        mother_id || null,
        spouse_id || null,
        notes || null,
      ]);

      reply.status(201).send({
        message: '✅ Thêm thành viên thành công!',
        member: result.rows[0],
      });
    } catch (err) {
      server.log.error(err);
      reply.status(500).send({ error: (err as Error).message });
    } finally {
      client.release();
    }
  });

  // 📋 LIST ALL — lấy danh sách tất cả
  server.get('/api/list-all-family-members', async (_req, reply) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM family_members ORDER BY id DESC;'
      );
      reply.send(rows);
    } catch (err) {
      reply.status(500).send({ error: (err as Error).message });
    }
  });

  // 🔍 LIST ONE — lấy chi tiết 1 người  
  server.get('/api/list-one-family-member/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { rows } = await pool.query(
        'SELECT * FROM family_members WHERE id = $1;',
        [id]
      );
      if (rows.length === 0)
        return reply.status(404).send({ error: 'Không tìm thấy thành viên' });
      reply.send(rows[0]);
    } catch (err) {
      reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ✏️ UPDATE — cập nhật thông tin
  server.put('/api/update-family-member/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const {
      full_name,
      gender,
      phone_numbers,
      address,
      birth_date,
      death_date,
      father_id,
      mother_id,
      spouse_id,
      notes,
    } = req.body as any;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const normalize = (v: any) => {
      if (v === undefined || v === null || v === '' || v === 'null' || v === 'undefined' || v === 'Không chọn') return null;
      return v;
    };
    if (full_name != null) {
      fields.push(`full_name = $${idx++}`);
      values.push(full_name);
    }
    if (gender != null) {
      fields.push(`gender = $${idx++}`);
      values.push(gender);
    }
    if (phone_numbers != null) {
      fields.push(`phone_numbers = $${idx++}`);
      values.push(phone_numbers);
    }
    if (address != null) {
      fields.push(`address = $${idx++}`);
      values.push(address);
    }
    if (birth_date !== undefined) {
      fields.push(`birth_date = $${idx++}`);
      values.push(normalize(birth_date));
    }
    if (death_date !== undefined) {
      fields.push(`death_date = $${idx++}`);
      values.push(normalize(death_date));
    }
    if (father_id !== undefined) {
      fields.push(`father_id = $${idx++}`);
      values.push(normalize(father_id));
    }
    if (mother_id !== undefined) {
      fields.push(`mother_id = $${idx++}`);
      values.push(normalize(mother_id));
    }
    if (spouse_id !== undefined) {
      fields.push(`spouse_id = $${idx++}`);
      values.push(normalize(spouse_id));
    }
    if (notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(notes);
    }


    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Không có dữ liệu để cập nhật' });
    }

    values.push(id);
    const query = `
      UPDATE family_members
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *;
    `;

    try {
      const { rows } = await pool.query(query, values);
      if (rows.length === 0)
        return reply.status(404).send({ error: 'Không tìm thấy thành viên' });
      reply.send({ message: '✅ Cập nhật thành công!', member: rows[0] });
    } catch (err) {
      reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ❌ DELETE — xóa thành viên
  server.delete('/api/delete-family-member/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM family_members WHERE id = $1;',
        [id]
      );
      if (rowCount === 0)
        return reply.status(404).send({ error: 'Không tìm thấy thành viên' });
      reply.send({ message: '🗑️ Xóa thành viên thành công!' });
    } catch (err) {
      reply.status(500).send({ error: (err as Error).message });
    }
  });
}
