import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ mode }) => {
  // 读取 .env / .env.local（不要求 VITE_ 前缀）
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), basicSsl()],
    server: {
      host: "0.0.0.0",
      port: 3000,
      https: true,
    },
    // 关键：把你代码里的 process.env.API_KEY 在打包/运行前替换掉
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY || ""),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY || ""),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
