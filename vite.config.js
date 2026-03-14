import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
    base: './',
    server: {
        host: true,
        allowedHosts: ['ypsps-macbook-air.local']
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                edit: resolve(__dirname, 'edit.html')
            }
        }
    }
}
