import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: process.env.VITE_APP_BASE_PATH || '/la-on-box/', plugins: [react()] });
