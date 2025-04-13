import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [
    // Habilitar la integración de React
    react(),
    // Habilitar la integración de Tailwind CSS
    tailwind({
      config: { path: './tailwind.config.js' },
    }),
  ],
  server: {
    port: 45000,
    host: true, // Habilita conexiones desde todos los hosts
  },
  // Configurar publicPath para las llamadas a la API
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.PUBLIC_API_URL || '/api')
    },
    server: {
      proxy: {
        // Configura un proxy para las llamadas a la API durante desarrollo
        '/api': {
          target: process.env.API_URL || 'http://localhost:45000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  },
  output: 'static', // SSG por defecto
});