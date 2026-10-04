import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc' // 👈 Restored your original SWC plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // ✅ Keeps the port fixed
    hmr: {
      overlay: false, // ✅ Fixes the WebSocket disconnect error
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          vendor: ["axios", "lucide-react"],
        },
      },
    },
  },
})