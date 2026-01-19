import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 仍然允许你用 .env.local 存一些 VITE_* 前端变量（如果将来需要）
  loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // 不要再把任何 key 注入到前端 bundle
    // define: { ... }  —— 这里刻意不写
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
