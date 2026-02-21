import { defineConfig } from 'vite';

// GitHub Pages project sites are served at https://<user>.github.io/<repo>/
// so assets must use base path /<repo>/. Override with BASE_PATH env if needed.
const base =
  process.env.BASE_PATH ||
  (process.env.GITHUB_REPOSITORY
    ? '/' + process.env.GITHUB_REPOSITORY.split('/')[1] + '/'
    : '/');

export default defineConfig({
  base,
});
