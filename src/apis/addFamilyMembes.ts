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

  // ✅ ADD — thêm thành viên + xử lý spouse 2 chiều
  server.post('/api/add-family-member', async (request, reply) => {
    const client = await pool.connect();

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

      if (!full_name) {
        return reply.status(400).send({ error: 'full_name là bắt buộc' });
      }

      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO family_members (
          id, full_name, gender, phone_numbers, address,
          birth_date, death_date, father_id, mother_id, spouse_id, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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

      // ✅ xử lý vợ/chồng 2 chiều
      if (spouse_id) {
        // xóa spouse cũ của B nếu có
        await client.query(`UPDATE family_members SET spouse_id=NULL WHERE spouse_id=$1`, [spouse_id]);

        // cập nhật spouse 2 chiều
        await client.query(`UPDATE family_members SET spouse_id=$1 WHERE id=$2`, [id, spouse_id]);
      }

      await client.query('COMMIT');

      reply.status(201).send({
        message: '✅ Thêm thành viên thành công!',
        member: result.rows[0],
      });

    } catch (err) {
      await pool.query('ROLLBACK');
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


  // ✏️ UPDATE — cập nhật thông tin + xử lý spouse 2 chiều
  server.put('/api/update-family-member/:id', async (req, reply) => {
    const client = await pool.connect();
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

    const normalize = (v: any) => {
      if (!v || v === '' || v === 'null' || v === 'undefined' || v === 'Không chọn') return null;
      return v;
    };

    try {
      await client.query('BEGIN');

      // ✅ 1. lấy spouse hiện tại của A
      const current = await client.query(
        `SELECT spouse_id FROM family_members WHERE id=$1`,
        [id]
      );
      const currentSpouse = current.rows[0]?.spouse_id || null;
      const newSpouse = normalize(spouse_id);

      // ✅ 2. xử lý thay đổi spouse
      if (spouse_id !== undefined) {

        // TH1: bỏ chọn spouse → xóa A và người kia
        if (!newSpouse) {
          if (currentSpouse) {
            await client.query(`UPDATE family_members SET spouse_id=NULL WHERE id=$1`, [currentSpouse]);
          }
        }

        // TH2: chọn spouse mới
        if (newSpouse && newSpouse !== currentSpouse) {
          // xóa spouse cũ của B
          await client.query(
            `UPDATE family_members SET spouse_id=NULL WHERE spouse_id=$1`,
            [newSpouse]
          );

          // xóa spouse cũ của A
          if (currentSpouse) {
            await client.query(
              `UPDATE family_members SET spouse_id=NULL WHERE id=$1`,
              [currentSpouse]
            );
          }

          // set quan hệ 2 chiều
          await client.query(
            `UPDATE family_members SET spouse_id=$1 WHERE id=$2`,
            [id, newSpouse]
          );
          await client.query(
            `UPDATE family_members SET spouse_id=$1 WHERE id=$2`,
            [newSpouse, id]
          );
        }
      }

      // ✅ 3. build query UPDATE thành viên A
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      const addField = (f: string, val: any) => {
        fields.push(`${f}=$${idx++}`);
        values.push(val);
      };

      if (full_name != null) addField("full_name", full_name);
      if (gender != null) addField("gender", gender);
      if (phone_numbers != null) addField("phone_numbers", phone_numbers);
      if (address != null) addField("address", address);
      if (birth_date !== undefined) addField("birth_date", normalize(birth_date));
      if (death_date !== undefined) addField("death_date", normalize(death_date));
      if (father_id !== undefined) addField("father_id", normalize(father_id));
      if (mother_id !== undefined) addField("mother_id", normalize(mother_id));
      if (spouse_id !== undefined) addField("spouse_id", newSpouse);
      if (notes !== undefined) addField("notes", notes);

      values.push(id);

      const updateQuery = `
        UPDATE family_members
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id=$${idx}
        RETURNING *;
      `;

      const updated = await client.query(updateQuery, values);

      await client.query('COMMIT');

      reply.send({
        message: "✅ Cập nhật thành công!",
        member: updated.rows[0],
      });

    } catch (err) {
      await client.query('ROLLBACK');
      reply.status(500).send({ error: (err as Error).message });
    } finally {
      client.release();
    }
  });


  // ❌ DELETE — xóa thành viên
  server.delete('/api/delete-family-member/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      // xóa vợ/chồng liên quan
      await pool.query(`UPDATE family_members SET spouse_id=NULL WHERE spouse_id=$1`, [id]);

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
