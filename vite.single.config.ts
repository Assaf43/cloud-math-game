import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained HTML file (script and styles inlined): easy to send by mail or WhatsApp and open on a phone or PC.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'release', emptyOutDir: true },
});
