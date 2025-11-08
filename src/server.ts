import fastify from 'fastify';
import { setupApis, initDatabase } from './apis/setup';
import { familyMemberApis } from './apis/familyMemberApis';
import cors from '@fastify/cors'; // 👈 thêm dòng này

async function startServer() {
  const server = fastify({ logger: true });
  const PORT = 8080;

  // 👇 Bật CORS trước khi đăng ký API
  await server.register(cors, {
    origin: '*', // Cho phép tất cả frontend (Expo, web, v.v.)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // 🔹 Khởi tạo database
  await initDatabase();

  // 🔹 Đăng ký API routes
  setupApis(server);
  familyMemberApis(server);

  // 🔹 Test route
  server.get('/', async () => ({ message: 'Server is running!' }));

  // 🔹 Khởi động server
  server.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    console.log(`🚀 Server running at ${address}`);
  });
}

// 👇 Chạy hàm async
startServer();
