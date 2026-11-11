import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Tambahkan blok middleware ini untuk memperbaiki error blank screen (MIME type)
    {
      name: 'force-jsx-mime-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.endsWith('.jsx')) {
            res.setHeader('Content-Type', 'text/javascript');
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})