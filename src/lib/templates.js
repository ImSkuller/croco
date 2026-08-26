// Template definitions — ported from electron/ipc/templates.ipc.cjs
// File content is generated here in JS (with the project name substituted),
// then passed as templateFiles to the Rust projects_create command.

function pkg(name, deps = {}, devDeps = {}, extra = {}) {
  return JSON.stringify({
    name: name.toLowerCase().replace(/[^a-z0-9-_.]/g, '-').replace(/^-+|-+$/g, '') || 'my-project',
    version: '0.1.0',
    private: true,
    ...extra,
    dependencies: deps,
    devDependencies: devDeps,
  }, null, 2)
}

const GITIGNORE_NODE = 'node_modules\ndist\n.env\n.env.local\n'
const GITIGNORE_PY   = '__pycache__/\n*.py[cod]\n.venv/\nvenv/\n.env\n'
const GITIGNORE_GO   = '# Binaries\n*.exe\n*.out\n\n.env\n'
const GITIGNORE_RUST = '/target\n.env\n'
const GITIGNORE_GRADLE = '.gradle/\nbuild/\n*.class\n*.jar\n.env\n'
const GITIGNORE_MAVEN  = 'target/\n*.class\n*.jar\n.env\n'

export const TEMPLATES = [
  {
    id: 'empty',
    name: 'Empty',
    desc: 'A blank project with no files.',
    emoji: '📁',
    category: 'Blank',
    tags: [],
    files: () => ({ '.gitignore': '.DS_Store\nThumbs.db\n*.swp\n' }),
    install: null,
  },
  {
    id: 'vanilla-js',
    name: 'Vanilla JS',
    desc: 'Plain HTML, CSS, and JavaScript. No build tools.',
    emoji: '🌐',
    category: 'Frontend',
    tags: ['html', 'css', 'javascript'],
    files: (n) => ({
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${n}</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <div id="app">\n    <h1>${n}</h1>\n  </div>\n  <script src="main.js"></script>\n</body>\n</html>\n`,
      'style.css': `*, *::before, *::after { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; background: #0a0a0a; color: #f0f0f0; }\nh1 { text-align: center; margin-top: 4rem; }\n`,
      'main.js': `console.log('${n} loaded');\n`,
      '.gitignore': '.DS_Store\n',
    }),
    install: null,
  },
  {
    id: 'react-vite',
    name: 'React + Vite',
    desc: 'React 18 with Vite for blazing-fast HMR.',
    emoji: '⚛️',
    category: 'Frontend',
    tags: ['react', 'vite', 'javascript'],
    files: (n) => ({
      'package.json': pkg(n, { react: '^18.3.1', 'react-dom': '^18.3.1' }, { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.2' }, { type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' } }),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${n}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
      'src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode><App /></React.StrictMode>\n)\n`,
      'src/App.jsx': `import { useState } from 'react'\n\nexport default function App() {\n  const [count, setCount] = useState(0)\n  return (\n    <div style={{ textAlign: 'center', marginTop: '4rem' }}>\n      <h1>${n}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>\n    </div>\n  )\n}\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'react-ts',
    name: 'React + TypeScript',
    desc: 'React 18 with TypeScript and Vite.',
    emoji: '⚛️',
    category: 'Frontend',
    tags: ['react', 'typescript', 'vite'],
    files: (n) => ({
      'package.json': pkg(n, { react: '^18.3.1', 'react-dom': '^18.3.1' }, { '@types/react': '^18.3.5', '@types/react-dom': '^18.3.0', '@vitejs/plugin-react': '^4.3.1', typescript: '^5.5.3', vite: '^5.4.2' }, { type: 'module', scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' } }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', allowImportingTsExtensions: true, isolatedModules: true, moduleDetection: 'force', noEmit: true, jsx: 'react-jsx', strict: true }, include: ['src'] }, null, 2),
      'vite.config.ts': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${n}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
      'src/main.tsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.tsx'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode><App /></React.StrictMode>,\n)\n`,
      'src/App.tsx': `import { useState } from 'react'\n\nexport default function App() {\n  const [count, setCount] = useState<number>(0)\n  return (\n    <div style={{ textAlign: 'center', marginTop: '4rem' }}>\n      <h1>${n}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>\n    </div>\n  )\n}\n`,
      'src/vite-env.d.ts': `/// <reference types="vite/client" />\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'react-tailwind',
    name: 'React + Tailwind',
    desc: 'React + Vite with Tailwind CSS.',
    emoji: '🎨',
    category: 'Frontend',
    tags: ['react', 'vite', 'tailwind', 'css'],
    files: (n) => ({
      'package.json': pkg(n, { react: '^18.3.1', 'react-dom': '^18.3.1' }, { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.2', tailwindcss: '^3.4.7', autoprefixer: '^10.4.19', postcss: '^8.4.40' }, { type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' } }),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })\n`,
      'postcss.config.js': `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n`,
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n}\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${n}</title>\n  </head>\n  <body class="bg-gray-950 text-gray-100 min-h-screen">\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
      'src/index.css': `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
      'src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode><App /></React.StrictMode>\n)\n`,
      'src/App.jsx': `export default function App() {\n  return (\n    <div className="flex flex-col items-center justify-center min-h-screen">\n      <h1 className="text-4xl font-bold text-white">${n}</h1>\n      <p className="mt-4 text-gray-400">Built with React + Tailwind</p>\n    </div>\n  )\n}\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'vue-vite',
    name: 'Vue 3 + Vite',
    desc: 'Vue 3 with the Composition API and Vite.',
    emoji: '💚',
    category: 'Frontend',
    tags: ['vue', 'vite', 'javascript'],
    files: (n) => ({
      'package.json': pkg(n, { vue: '^3.4.37' }, { '@vitejs/plugin-vue': '^5.1.2', vite: '^5.4.2' }, { type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' } }),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\n\nexport default defineConfig({ plugins: [vue()] })\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${n}</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.js"></script>\n  </body>\n</html>\n`,
      'src/main.js': `import { createApp } from 'vue'\nimport App from './App.vue'\ncreateApp(App).mount('#app')\n`,
      'src/App.vue': `<script setup>\nimport { ref } from 'vue'\nconst count = ref(0)\n</script>\n\n<template>\n  <div style="text-align:center;margin-top:4rem">\n    <h1>${n}</h1>\n    <button @click="count++">Count: {{ count }}</button>\n  </div>\n</template>\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'svelte-vite',
    name: 'Svelte + Vite',
    desc: 'Svelte with Vite for fast development.',
    emoji: '🔥',
    category: 'Frontend',
    tags: ['svelte', 'vite', 'javascript'],
    files: (n) => ({
      'package.json': pkg(n, {}, { '@sveltejs/vite-plugin-svelte': '^3.1.1', svelte: '^4.2.18', vite: '^5.4.2' }, { type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' } }),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport { svelte } from '@sveltejs/vite-plugin-svelte'\n\nexport default defineConfig({ plugins: [svelte()] })\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${n}</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.js"></script>\n  </body>\n</html>\n`,
      'src/main.js': `import App from './App.svelte'\nconst app = new App({ target: document.getElementById('app') })\nexport default app\n`,
      'src/App.svelte': `<script>\n  let count = 0\n</script>\n\n<div style="text-align:center;margin-top:4rem">\n  <h1>${n}</h1>\n  <button on:click={() => count++}>Count: {count}</button>\n</div>\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'astro',
    name: 'Astro',
    desc: 'Content-driven site builder. Zero JS by default.',
    emoji: '🚀',
    category: 'Frontend',
    tags: ['astro', 'static', 'javascript'],
    files: (n) => ({
      'package.json': pkg(n, { astro: '^4.11.0' }, {}, { type: 'module', scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' } }),
      'astro.config.mjs': `import { defineConfig } from 'astro/config';\nexport default defineConfig({});\n`,
      'tsconfig.json': JSON.stringify({ extends: 'astro/tsconfigs/base' }, null, 2),
      'src/pages/index.astro': `---\nconst title = '${n}'\n---\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width" />\n    <title>{title}</title>\n  </head>\n  <body>\n    <h1>Welcome to {title} 🚀</h1>\n  </body>\n</html>\n`,
      '.gitignore': `node_modules\ndist\n.astro\n.env\n`,
    }),
    install: 'npm install',
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    desc: 'Next.js 14 with App Router (React + TypeScript).',
    emoji: '▲',
    category: 'Fullstack',
    tags: ['react', 'nextjs', 'typescript', 'fullstack'],
    files: (n) => ({
      'package.json': pkg(n, { next: '14.2.5', react: '^18', 'react-dom': '^18' }, { '@types/node': '^20', '@types/react': '^18', '@types/react-dom': '^18', typescript: '^5' }, { scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' } }),
      'next.config.mjs': `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n`,
      'tsconfig.json': JSON.stringify({ compilerOptions: { lib: ['dom', 'dom.iterable', 'esnext'], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, isolatedModules: true, jsx: 'preserve', incremental: true, plugins: [{ name: 'next' }], paths: { '@/*': ['./src/*'] } }, include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }, null, 2),
      'src/app/layout.tsx': `import type { Metadata } from 'next'\n\nexport const metadata: Metadata = {\n  title: '${n}',\n  description: 'Built with Next.js',\n}\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
      'src/app/page.tsx': `export default function Home() {\n  return (\n    <main style={{ padding: '4rem', textAlign: 'center' }}>\n      <h1>${n}</h1>\n      <p>Get started by editing <code>src/app/page.tsx</code></p>\n    </main>\n  )\n}\n`,
      '.gitignore': `node_modules\n.next\nout\ndist\n.env\n.env.local\n`,
    }),
    install: 'npm install',
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    desc: 'Full-stack framework powered by Svelte.',
    emoji: '🔥',
    category: 'Fullstack',
    tags: ['svelte', 'sveltekit', 'fullstack'],
    files: (n) => ({
      'package.json': pkg(n, {}, { '@sveltejs/adapter-auto': '^3.0.0', '@sveltejs/kit': '^2.0.0', '@sveltejs/vite-plugin-svelte': '^3.0.0', svelte: '^4.2.7', vite: '^5.0.3' }, { scripts: { dev: 'vite dev', build: 'vite build', preview: 'vite preview' } }),
      'svelte.config.js': `import adapter from '@sveltejs/adapter-auto';\n\nconst config = { kit: { adapter: adapter() } };\nexport default config;\n`,
      'vite.config.js': `import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [sveltekit()] });\n`,
      'src/app.html': `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <link rel="icon" href="%sveltekit.assets%/favicon.png" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    %sveltekit.head%\n  </head>\n  <body>\n    <div style="display: contents">%sveltekit.body%</div>\n  </body>\n</html>\n`,
      'src/routes/+page.svelte': `<h1>Welcome to ${n}</h1>\n<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to learn SvelteKit.</p>\n`,
      '.gitignore': `node_modules\n.svelte-kit\n.env\n.env.local\nbuild\n`,
    }),
    install: 'npm install',
  },
  {
    id: 'nuxt',
    name: 'Nuxt 3',
    desc: 'Vue-based fullstack framework.',
    emoji: '💚',
    category: 'Fullstack',
    tags: ['vue', 'nuxt', 'fullstack'],
    files: (n) => ({
      'package.json': pkg(n, {}, { nuxt: '^3.12.4' }, { scripts: { dev: 'nuxt dev', build: 'nuxt build', generate: 'nuxt generate', preview: 'nuxt preview' } }),
      'nuxt.config.ts': `export default defineNuxtConfig({ devtools: { enabled: true } })\n`,
      'app.vue': `<template>\n  <div>\n    <NuxtPage />\n  </div>\n</template>\n`,
      'pages/index.vue': `<template>\n  <div style="text-align:center;margin-top:4rem">\n    <h1>${n}</h1>\n    <p>Built with Nuxt 3 💚</p>\n  </div>\n</template>\n`,
      '.gitignore': `node_modules\n.nuxt\n.output\ndist\n.env\n`,
    }),
    install: 'npm install',
  },
  {
    id: 'express-api',
    name: 'Express API',
    desc: 'RESTful API server with Express.js.',
    emoji: '🖥️',
    category: 'Backend',
    tags: ['nodejs', 'express', 'api'],
    files: (n) => ({
      'package.json': pkg(n, { express: '^4.19.2', cors: '^2.8.5' }, {}, { type: 'module', scripts: { start: 'node src/index.js', dev: 'node --watch src/index.js' } }),
      'src/index.js': `import express from 'express'\nimport cors from 'cors'\n\nconst app = express()\nconst PORT = Number(process.env.PORT) || 3000\n\napp.use(cors())\napp.use(express.json())\n\napp.get('/', (_req, res) => {\n  res.json({ message: 'Welcome to ${n}', status: 'ok' })\n})\n\napp.get('/health', (_req, res) => res.json({ ok: true }))\n\napp.listen(PORT, () => console.log(\`🚀 ${n} on http://localhost:\${PORT}\`))\n`,
      '.env.example': 'PORT=3000\n',
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'fastify-api',
    name: 'Fastify API',
    desc: 'High-performance API server with Fastify.',
    emoji: '⚡',
    category: 'Backend',
    tags: ['nodejs', 'fastify', 'api'],
    files: (n) => ({
      'package.json': pkg(n, { fastify: '^4.28.0', '@fastify/cors': '^9.0.1' }, {}, { type: 'module', scripts: { start: 'node src/index.js', dev: 'node --watch src/index.js' } }),
      'src/index.js': `import Fastify from 'fastify'\nimport cors from '@fastify/cors'\n\nconst app = Fastify({ logger: true })\nawait app.register(cors)\n\napp.get('/', async () => ({ message: 'Welcome to ${n}', status: 'ok' }))\napp.get('/health', async () => ({ ok: true }))\n\nconst PORT = Number(process.env.PORT) || 3000\nawait app.listen({ port: PORT, host: '0.0.0.0' })\n`,
      '.env.example': 'PORT=3000\n',
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'hono-api',
    name: 'Hono API',
    desc: 'Ultra-fast web framework for edge and Node.js.',
    emoji: '🔥',
    category: 'Backend',
    tags: ['nodejs', 'hono', 'api', 'edge'],
    files: (n) => ({
      'package.json': pkg(n, { hono: '^4.5.3', '@hono/node-server': '^1.12.0' }, {}, { type: 'module', scripts: { start: 'node src/index.js', dev: 'node --watch src/index.js' } }),
      'src/index.js': `import { Hono } from 'hono'\nimport { serve } from '@hono/node-server'\n\nconst app = new Hono()\n\napp.get('/', (c) => c.json({ message: 'Welcome to ${n}', status: 'ok' }))\napp.get('/health', (c) => c.json({ ok: true }))\n\nconst PORT = Number(process.env.PORT) || 3000\nserve({ fetch: app.fetch, port: PORT }, () => console.log(\`🔥 ${n} on http://localhost:\${PORT}\`))\n`,
      '.env.example': 'PORT=3000\n',
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'python-flask',
    name: 'Python Flask',
    desc: 'Lightweight Python web framework.',
    emoji: '🐍',
    category: 'Backend',
    tags: ['python', 'flask', 'api'],
    files: (n) => ({
      'requirements.txt': `flask>=3.0.0\nflask-cors>=4.0.0\n`,
      'app.py': `from flask import Flask, jsonify\nfrom flask_cors import CORS\n\napp = Flask(__name__)\nCORS(app)\n\n@app.get('/')\ndef index():\n    return jsonify({'message': 'Welcome to ${n}', 'status': 'ok'})\n\n@app.get('/health')\ndef health():\n    return jsonify({'ok': True})\n\nif __name__ == '__main__':\n    app.run(debug=True, port=5000)\n`,
      '.env.example': 'FLASK_ENV=development\n',
      '.gitignore': GITIGNORE_PY,
    }),
    install: null,
  },
  {
    id: 'python-fastapi',
    name: 'Python FastAPI',
    desc: 'Modern async Python API with auto-generated docs.',
    emoji: '🐍',
    category: 'Backend',
    tags: ['python', 'fastapi', 'async', 'api'],
    files: (n) => ({
      'requirements.txt': `fastapi>=0.111.0\nuvicorn[standard]>=0.30.0\n`,
      'main.py': `from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\n\napp = FastAPI(title="${n}")\napp.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])\n\n@app.get("/")\ndef root():\n    return {"message": "Welcome to ${n}", "status": "ok"}\n\n@app.get("/health")\ndef health():\n    return {"ok": True}\n`,
      '.env.example': 'PORT=8000\n',
      '.gitignore': GITIGNORE_PY,
    }),
    install: null,
  },
  {
    id: 'node-cli',
    name: 'Node.js CLI',
    desc: 'Command-line tool with Commander.js and Chalk.',
    emoji: '⌨️',
    category: 'CLI',
    tags: ['nodejs', 'cli', 'commander'],
    files: (n) => {
      const slug = n.toLowerCase().replace(/\s+/g, '-')
      return {
        'package.json': JSON.stringify({ name: slug, version: '0.1.0', description: n, type: 'module', bin: { [slug]: 'src/index.js' }, scripts: { start: 'node src/index.js' }, dependencies: { commander: '^12.1.0', chalk: '^5.3.0' } }, null, 2),
        'src/index.js': `#!/usr/bin/env node\nimport { program } from 'commander'\nimport chalk from 'chalk'\n\nprogram\n  .name('${slug}')\n  .description('${n} CLI')\n  .version('0.1.0')\n\nprogram\n  .command('hello [name]')\n  .description('Say hello')\n  .action((name = 'World') => {\n    console.log(chalk.green(\`Hello, \${name}!\`))\n  })\n\nprogram.parse()\n`,
        '.gitignore': GITIGNORE_NODE,
      }
    },
    install: 'npm install',
  },
  {
    id: 'electron-react',
    name: 'Electron + React',
    desc: 'Desktop app with Electron and React + Vite.',
    emoji: '🖥️',
    category: 'Desktop',
    tags: ['electron', 'react', 'desktop', 'vite'],
    files: (n) => ({
      'package.json': JSON.stringify({ name: n.toLowerCase().replace(/\s+/g, '-'), version: '0.1.0', private: true, type: 'commonjs', main: 'electron/main.cjs', scripts: { dev: 'vite', build: 'vite build', electron: 'electron electron/main.cjs' }, dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' }, devDependencies: { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.2', electron: '^31.0.0' } }, null, 2),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()], base: './' })\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>${n}</title></head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
      'electron/main.cjs': `const { app, BrowserWindow } = require('electron')\nfunction createWindow() {\n  const win = new BrowserWindow({ width: 1200, height: 800, webPreferences: { contextIsolation: true } })\n  win.loadFile('dist/index.html')\n}\napp.whenReady().then(createWindow)\napp.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })\n`,
      'src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)\n`,
      'src/App.jsx': `export default function App() {\n  return (\n    <div style={{ textAlign: 'center', marginTop: '4rem' }}>\n      <h1>${n}</h1>\n      <p>Electron + React desktop app</p>\n    </div>\n  )\n}\n`,
      '.gitignore': `node_modules\ndist\n.env\n`,
    }),
    install: 'npm install',
  },
  {
    id: 'solid-vite',
    name: 'Solid.js + Vite',
    desc: 'Fine-grained reactive UI library with no virtual DOM.',
    emoji: '💎',
    category: 'Frontend',
    tags: ['solidjs', 'vite', 'javascript'],
    files: (n) => ({
      'package.json': pkg(n, { 'solid-js': '^1.8.17' }, { '@vitejs/plugin-solid': '^1.4.0', vite: '^5.4.2' }, { type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' } }),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport solid from '@vitejs/plugin-solid'\n\nexport default defineConfig({ plugins: [solid()] })\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>${n}</title></head>\n  <body><div id="root"></div><script type="module" src="/src/index.jsx"></script></body>\n</html>\n`,
      'src/index.jsx': `import { render } from 'solid-js/web'\nimport App from './App'\nrender(() => <App />, document.getElementById('root'))\n`,
      'src/App.jsx': `import { createSignal } from 'solid-js'\n\nexport default function App() {\n  const [count, setCount] = createSignal(0)\n  return (\n    <div style={{ "text-align": "center", "margin-top": "4rem" }}>\n      <h1>${n}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Count: {count()}</button>\n    </div>\n  )\n}\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'preact-vite',
    name: 'Preact + Vite',
    desc: 'Fast 3kB alternative to React with the same API.',
    emoji: '⚡',
    category: 'Frontend',
    tags: ['preact', 'vite', 'javascript'],
    files: (n) => ({
      'package.json': pkg(n, { preact: '^10.23.2' }, { '@preact/preset-vite': '^2.8.2', vite: '^5.4.2' }, { type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' } }),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport preact from '@preact/preset-vite'\n\nexport default defineConfig({ plugins: [preact()] })\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>${n}</title></head>\n  <body><div id="app"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>\n`,
      'src/main.jsx': `import { render } from 'preact'\nimport { App } from './App'\nrender(<App />, document.getElementById('app'))\n`,
      'src/App.jsx': `import { useState } from 'preact/hooks'\n\nexport function App() {\n  const [count, setCount] = useState(0)\n  return (\n    <div style={{ textAlign: 'center', marginTop: '4rem' }}>\n      <h1>${n}</h1>\n      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>\n    </div>\n  )\n}\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'remix',
    name: 'Remix',
    desc: 'Full-stack React framework focused on web standards.',
    emoji: '💿',
    category: 'Fullstack',
    tags: ['react', 'remix', 'fullstack'],
    files: (n) => ({
      'package.json': pkg(n, { '@remix-run/node': '^2.10.3', '@remix-run/react': '^2.10.3', '@remix-run/serve': '^2.10.3', isbot: '^4.4.0', react: '^18.3.1', 'react-dom': '^18.3.1' }, { '@remix-run/dev': '^2.10.3', vite: '^5.4.2' }, { type: 'module', scripts: { build: 'remix vite:build', dev: 'remix vite:dev', start: 'remix-serve ./build/server/index.js' } }),
      'vite.config.ts': `import { vitePlugin as remix } from "@remix-run/dev";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [remix()] });\n`,
      'app/root.tsx': `import { Links, Meta, Outlet, Scripts } from "@remix-run/react";\nexport default function App() {\n  return (<html lang="en"><head><Meta /><Links /></head><body><Outlet /><Scripts /></body></html>);\n}\n`,
      'app/routes/_index.tsx': `export default function Index() {\n  return (<main style={{ padding: "4rem", textAlign: "center" }}><h1>${n}</h1><p>Built with Remix 💿</p></main>);\n}\n`,
      '.gitignore': `node_modules\n.cache\nbuild\n.env\n`,
    }),
    install: 'npm install',
  },
  {
    id: 'nestjs',
    name: 'NestJS',
    desc: 'Progressive Node.js framework with TypeScript and decorators.',
    emoji: '🐱',
    category: 'Backend',
    tags: ['nodejs', 'nestjs', 'typescript', 'api'],
    files: (n) => ({
      'package.json': pkg(n, { '@nestjs/common': '^10.0.0', '@nestjs/core': '^10.0.0', '@nestjs/platform-express': '^10.0.0', 'reflect-metadata': '^0.2.0', rxjs: '^7.8.1' }, { '@nestjs/cli': '^10.0.0', typescript: '^5.1.3' }, { scripts: { build: 'nest build', dev: 'nest start --watch', start: 'nest start' } }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { module: 'commonjs', emitDecoratorMetadata: true, experimentalDecorators: true, target: 'ES2021', outDir: './dist' }, include: ['src/**/*'] }, null, 2),
      'src/main.ts': `import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  await app.listen(3000);\n  console.log('🐱 ${n} running on http://localhost:3000');\n}\nbootstrap();\n`,
      'src/app.module.ts': `import { Module } from '@nestjs/common';\nimport { AppController } from './app.controller';\nimport { AppService } from './app.service';\n@Module({ imports: [], controllers: [AppController], providers: [AppService] })\nexport class AppModule {}\n`,
      'src/app.controller.ts': `import { Controller, Get } from '@nestjs/common';\n@Controller()\nexport class AppController {\n  @Get() root() { return { message: 'Welcome to ${n}', status: 'ok' }; }\n  @Get('health') health() { return { ok: true }; }\n}\n`,
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  {
    id: 'bun-elysia',
    name: 'Bun + Elysia',
    desc: 'Blazing fast API server using Bun runtime and Elysia.',
    emoji: '🫎',
    category: 'Backend',
    tags: ['bun', 'elysia', 'typescript', 'api'],
    files: (n) => ({
      'package.json': JSON.stringify({ name: n.toLowerCase().replace(/\s+/g, '-'), version: '0.1.0', scripts: { dev: 'bun --watch src/index.ts', start: 'bun src/index.ts' }, dependencies: { elysia: 'latest' } }, null, 2),
      'src/index.ts': `import { Elysia } from 'elysia'\n\nconst app = new Elysia()\n  .get('/', () => ({ message: 'Welcome to ${n}', status: 'ok' }))\n  .get('/health', () => ({ ok: true }))\n  .listen(3000)\n\nconsole.log(\`🫎 ${n} on http://localhost:3000\`)\n`,
      '.gitignore': `node_modules\n.env\n`,
    }),
    install: null,
  },
  {
    id: 'python-click',
    name: 'Python CLI (Click)',
    desc: 'Command-line tool built with Python and Click.',
    emoji: '🐍',
    category: 'CLI',
    tags: ['python', 'cli', 'click'],
    files: (n) => {
      return {
        'requirements.txt': `click>=8.1.0\n`,
        'cli.py': `#!/usr/bin/env python3\nimport click\n\n@click.group()\ndef cli():\n    """${n} — command-line tool."""\n    pass\n\n@cli.command()\n@click.argument('name', default='World')\ndef hello(name: str):\n    """Say hello."""\n    click.echo(f'Hello, {name}!')\n\nif __name__ == '__main__':\n    cli()\n`,
        '.gitignore': GITIGNORE_PY,
      }
    },
    install: null,
  },
  {
    id: 'tauri-react',
    name: 'Tauri + React',
    desc: 'Desktop app with Tauri v2 (Rust) and React + Vite.',
    emoji: '🦀',
    category: 'Desktop',
    tags: ['tauri', 'rust', 'react', 'desktop'],
    files: (n) => ({
      'package.json': pkg(n, { '@tauri-apps/api': '^2', react: '^18.3.1', 'react-dom': '^18.3.1' }, { '@tauri-apps/cli': '^2', '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.2' }, { type: 'module', scripts: { dev: 'vite', build: 'vite build', 'tauri:dev': 'tauri dev', 'tauri:build': 'tauri build' } }),
      'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()], clearScreen: false, server: { port: 1420, strictPort: true } })\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>${n}</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>\n`,
      'src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)\n`,
      'src/App.jsx': `export default function App() {\n  return (<div style={{ textAlign: 'center', marginTop: '4rem' }}><h1>${n}</h1><p>Tauri + React desktop app</p></div>)\n}\n`,
      '.gitignore': `node_modules\ndist\nsrc-tauri/target\n.env\n`,
    }),
    install: 'npm install',
  },
  {
    id: 'deno-http',
    name: 'Deno HTTP',
    desc: 'Simple HTTP server with Deno — no npm, no node_modules.',
    emoji: '🦕',
    category: 'Other',
    tags: ['deno', 'typescript', 'http'],
    files: (n) => ({
      'main.ts': `const PORT = Number(Deno.env.get("PORT")) || 8000;\n\nDeno.serve({ port: PORT }, (req) => {\n  const url = new URL(req.url);\n  if (url.pathname === "/health") return Response.json({ ok: true });\n  return Response.json({ message: "Welcome to ${n}", status: "ok" });\n});\n\nconsole.log(\`🦕 ${n} on http://localhost:\${PORT}\`);\n`,
      'deno.json': JSON.stringify({ tasks: { dev: 'deno run --watch --allow-net --allow-env main.ts', start: 'deno run --allow-net --allow-env main.ts' } }, null, 2),
      '.gitignore': `.env\n`,
    }),
    install: null,
  },
  {
    id: 'go-http',
    name: 'Go HTTP Server',
    desc: 'HTTP server in Go using the standard library.',
    emoji: '🐹',
    category: 'Other',
    tags: ['go', 'golang', 'http'],
    files: (n) => {
      const mod = n.toLowerCase().replace(/\s+/g, '-')
      return {
        'go.mod': `module ${mod}\n\ngo 1.22\n`,
        'main.go': `package main\n\nimport (\n\t"encoding/json"\n\t"fmt"\n\t"net/http"\n\t"log"\n)\n\nfunc main() {\n\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set("Content-Type", "application/json")\n\t\tjson.NewEncoder(w).Encode(map[string]string{"message": "Welcome to ${n}"})\n\t})\n\thttp.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set("Content-Type", "application/json")\n\t\tjson.NewEncoder(w).Encode(map[string]bool{"ok": true})\n\t})\n\tfmt.Println("🚀 ${n} running on http://localhost:8080")\n\tlog.Fatal(http.ListenAndServe(":8080", nil))\n}\n`,
        '.gitignore': GITIGNORE_GO,
      }
    },
    install: null,
  },
  {
    id: 'rust-cli',
    name: 'Rust CLI',
    desc: 'Command-line tool in Rust with Cargo.',
    emoji: '🦀',
    category: 'Other',
    tags: ['rust', 'cli', 'cargo'],
    files: (n) => {
      const crate = n.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_')
      return {
        'Cargo.toml': `[package]\nname = "${crate}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`,
        'src/main.rs': `fn main() {\n    println!("Hello from ${n}!");\n}\n`,
        '.gitignore': GITIGNORE_RUST,
      }
    },
    install: null,
  },
  // ── Minecraft ────────────────────────────────────────────────────────────────
  {
    id: 'minecraft-fabric',
    name: 'Fabric Mod',
    desc: 'Minecraft Fabric mod with Gradle and Loom.',
    emoji: '🪨',
    category: 'Minecraft',
    tags: ['minecraft', 'fabric', 'java', 'modding'],
    files: (n) => {
      const pkg = n.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'examplemod'
      const cls = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'ExampleMod'
      return {
        'build.gradle': `plugins {\n    id 'fabric-loom' version '1.7-SNAPSHOT'\n    id 'maven-publish'\n}\n\nversion = project.mod_version\ngroup = project.maven_group\n\nbase { archivesName = project.archives_base_name }\n\nrepositories {}\n\ndependencies {\n    minecraft "com.mojang:minecraft:\${project.minecraft_version}"\n    mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"\n    modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"\n    modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"\n}\n\nprocessResources {\n    inputs.property "version", project.version\n    filteringCharset "UTF-8"\n    filesMatching("fabric.mod.json") { expand "version": project.version }\n}\n\njava {\n    withSourcesJar()\n    sourceCompatibility = JavaVersion.VERSION_21\n    targetCompatibility = JavaVersion.VERSION_21\n}\n\njar { from("LICENSE") { rename { "\${it}_\${project.base.archivesName.get()}" } } }\n`,
        'gradle.properties': `org.gradle.jvmargs=-Xmx1G\nmod_version=0.1.0\nmaven_group=com.example\narchives_base_name=${pkg}\nminecraft_version=1.21.4\nyarn_mappings=1.21.4+build.8\nloader_version=0.16.9\nfabric_version=0.112.2+1.21.4\n`,
        'settings.gradle': `pluginManagement {\n    repositories {\n        maven { url "https://maven.fabricmc.net/" }\n        gradlePluginPortal()\n    }\n}\nrootProject.name = "${pkg}"\n`,
        [`src/main/java/com/example/${pkg}/${cls}.java`]: `package com.example.${pkg};\n\nimport net.fabricmc.api.ModInitializer;\nimport org.slf4j.Logger;\nimport org.slf4j.LoggerFactory;\n\npublic class ${cls} implements ModInitializer {\n    public static final String MOD_ID = "${pkg}";\n    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);\n\n    @Override\n    public void onInitialize() {\n        LOGGER.info("${n} initialized!");\n    }\n}\n`,
        'src/main/resources/fabric.mod.json': JSON.stringify({ schemaVersion: 1, id: pkg, version: '${version}', name: n, description: `A Fabric mod named ${n}`, authors: ['You'], environment: '*', entrypoints: { main: [`com.example.${pkg}.${cls}`] }, depends: { fabricloader: '>=0.16.9', minecraft: '~1.21.4', java: '>=21' } }, null, 2),
        'src/main/resources/mixins.json': JSON.stringify({ required: true, package: `com.example.${pkg}.mixin`, compatibilityLevel: 'JAVA_21', mixins: [], injectors: { defaultRequire: 1 } }, null, 2),
        '.gitignore': GITIGNORE_GRADLE,
      }
    },
    install: null,
  },
  {
    id: 'minecraft-paper',
    name: 'Paper Plugin',
    desc: 'Minecraft Paper plugin with Maven.',
    emoji: '📜',
    category: 'Minecraft',
    tags: ['minecraft', 'paper', 'java', 'plugin'],
    files: (n) => {
      const pkg = n.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'exampleplugin'
      const cls = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'ExamplePlugin'
      return {
        'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>${pkg}</artifactId>\n  <version>0.1.0</version>\n  <packaging>jar</packaging>\n  <repositories>\n    <repository>\n      <id>papermc</id>\n      <url>https://repo.papermc.io/repository/maven-public/</url>\n    </repository>\n  </repositories>\n  <dependencies>\n    <dependency>\n      <groupId>io.papermc.paper</groupId>\n      <artifactId>paper-api</artifactId>\n      <version>1.21.4-R0.1-SNAPSHOT</version>\n      <scope>provided</scope>\n    </dependency>\n  </dependencies>\n  <build>\n    <plugins>\n      <plugin>\n        <groupId>org.apache.maven.plugins</groupId>\n        <artifactId>maven-compiler-plugin</artifactId>\n        <version>3.13.0</version>\n        <configuration><source>21</source><target>21</target></configuration>\n      </plugin>\n    </plugins>\n  </build>\n</project>\n`,
        [`src/main/java/com/example/${pkg}/${cls}.java`]: `package com.example.${pkg};\n\nimport org.bukkit.plugin.java.JavaPlugin;\n\npublic final class ${cls} extends JavaPlugin {\n    @Override\n    public void onEnable() {\n        getLogger().info("${n} enabled!");\n    }\n\n    @Override\n    public void onDisable() {\n        getLogger().info("${n} disabled.");\n    }\n}\n`,
        'src/main/resources/plugin.yml': `name: ${n}\nversion: 0.1.0\nmain: com.example.${pkg}.${cls}\napi-version: '1.21'\ndescription: A Paper plugin named ${n}\nauthor: You\n`,
        '.gitignore': GITIGNORE_MAVEN,
      }
    },
    install: null,
  },
  {
    id: 'minecraft-forge',
    name: 'Forge Mod',
    desc: 'Minecraft Forge mod with Gradle.',
    emoji: '⚙️',
    category: 'Minecraft',
    tags: ['minecraft', 'forge', 'java', 'modding'],
    files: (n) => {
      const pkg = n.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'examplemod'
      const cls = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'ExampleMod'
      return {
        'build.gradle': `buildscript {\n    repositories { maven { url = 'https://maven.minecraftforge.net' } }\n    dependencies { classpath 'net.minecraftforge.gradle:ForgeGradle:6.+' }\n}\nplugins { id 'eclipse' }\napply plugin: 'net.minecraftforge.gradle'\n\nversion = "0.1.0"\ngroup = "com.example.${pkg}"\narchivesBaseName = "${pkg}"\n\njava.toolchain.languageVersion = JavaLanguageVersion.of(21)\n\nminecraft {\n    mappings channel: 'official', version: '1.21.4'\n    accessTransformer = file('src/main/resources/META-INF/accesstransformer.cfg')\n    runs { client { workingDirectory project.file('run') } server { workingDirectory project.file('run') } }\n}\n\ndependencies {\n    minecraft 'net.minecraftforge:forge:1.21.4-54.0.0'\n}\n`,
        'gradle.properties': `org.gradle.jvmargs=-Xmx3G\norg.gradle.daemon=false\n`,
        'settings.gradle': `rootProject.name = "${pkg}"\n`,
        [`src/main/java/com/example/${pkg}/${cls}.java`]: `package com.example.${pkg};\n\nimport net.minecraftforge.fml.common.Mod;\nimport org.apache.logging.log4j.LogManager;\nimport org.apache.logging.log4j.Logger;\n\n@Mod("${pkg}")\npublic class ${cls} {\n    private static final Logger LOGGER = LogManager.getLogger();\n\n    public ${cls}() {\n        LOGGER.info("${n} loading!");\n    }\n}\n`,
        'src/main/resources/META-INF/mods.toml': `modLoader="javafml"\nloaderVersion="[54,)"\nlicense="MIT"\n\n[[mods]]\nmodId="${pkg}"\nversion="0.1.0"\ndisplayName="${n}"\ndescription="A Forge mod named ${n}"\n\n[[dependencies.${pkg}]]\n    modId="forge"\n    mandatory=true\n    versionRange="[54,)"\n    ordering="NONE"\n    side="BOTH"\n[[dependencies.${pkg}]]\n    modId="minecraft"\n    mandatory=true\n    versionRange="[1.21.4,1.22)"\n    ordering="NONE"\n    side="BOTH"\n`,
        'src/main/resources/pack.mcmeta': JSON.stringify({ pack: { pack_format: 48, description: `${n} resources` } }, null, 2),
        '.gitignore': GITIGNORE_GRADLE,
      }
    },
    install: null,
  },
  {
    id: 'minecraft-spigot',
    name: 'Spigot Plugin',
    desc: 'Minecraft Spigot plugin with Maven.',
    emoji: '🌊',
    category: 'Minecraft',
    tags: ['minecraft', 'spigot', 'java', 'plugin'],
    files: (n) => {
      const pkg = n.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'exampleplugin'
      const cls = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'ExamplePlugin'
      return {
        'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>${pkg}</artifactId>\n  <version>0.1.0</version>\n  <packaging>jar</packaging>\n  <repositories>\n    <repository>\n      <id>spigotmc</id>\n      <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>\n    </repository>\n  </repositories>\n  <dependencies>\n    <dependency>\n      <groupId>org.spigotmc</groupId>\n      <artifactId>spigot-api</artifactId>\n      <version>1.21.4-R0.1-SNAPSHOT</version>\n      <scope>provided</scope>\n    </dependency>\n  </dependencies>\n  <build>\n    <plugins>\n      <plugin>\n        <groupId>org.apache.maven.plugins</groupId>\n        <artifactId>maven-compiler-plugin</artifactId>\n        <version>3.13.0</version>\n        <configuration><source>21</source><target>21</target></configuration>\n      </plugin>\n    </plugins>\n  </build>\n</project>\n`,
        [`src/main/java/com/example/${pkg}/${cls}.java`]: `package com.example.${pkg};\n\nimport org.bukkit.plugin.java.JavaPlugin;\n\npublic final class ${cls} extends JavaPlugin {\n    @Override\n    public void onEnable() {\n        getLogger().info("${n} enabled!");\n    }\n\n    @Override\n    public void onDisable() {\n        getLogger().info("${n} disabled.");\n    }\n}\n`,
        'src/main/resources/plugin.yml': `name: ${n}\nversion: 0.1.0\nmain: com.example.${pkg}.${cls}\napi-version: '1.21'\ndescription: A Spigot plugin named ${n}\nauthor: You\n`,
        '.gitignore': GITIGNORE_MAVEN,
      }
    },
    install: null,
  },
  // ── Discord ───────────────────────────────────────────────────────────────────
  {
    id: 'discord-python',
    name: 'Python Discord Bot',
    desc: 'Discord bot with discord.py and slash commands.',
    emoji: '🤖',
    category: 'Discord',
    tags: ['discord', 'python', 'bot'],
    files: (n) => ({
      'requirements.txt': `discord.py>=2.4.0\npython-dotenv>=1.0.0\n`,
      'bot.py': `import discord\nfrom discord.ext import commands\nfrom dotenv import load_dotenv\nimport os\n\nload_dotenv()\n\nintents = discord.Intents.default()\nintents.message_content = True\n\nbot = commands.Bot(command_prefix='!', intents=intents)\n\n@bot.event\nasync def on_ready():\n    print(f'{bot.user} is online!')\n    try:\n        synced = await bot.tree.sync()\n        print(f'Synced {len(synced)} slash command(s)')\n    except Exception as e:\n        print(e)\n\n@bot.tree.command(name='ping', description='Check bot latency')\nasync def ping(interaction: discord.Interaction):\n    latency = round(bot.latency * 1000)\n    await interaction.response.send_message(f'Pong! {latency}ms')\n\n@bot.command(name='hello')\nasync def hello(ctx):\n    await ctx.send(f'Hello, {ctx.author.mention}! I am ${n}.')\n\nbot.run(os.getenv('DISCORD_TOKEN'))\n`,
      '.env.example': 'DISCORD_TOKEN=your_bot_token_here\nGUILD_ID=your_test_server_id\n',
      '.gitignore': `${GITIGNORE_PY}.env\n`,
    }),
    install: null,
  },
  {
    id: 'discord-js',
    name: 'JS Discord Bot',
    desc: 'Discord bot with discord.js v14 and slash commands.',
    emoji: '🤖',
    category: 'Discord',
    tags: ['discord', 'javascript', 'bot', 'nodejs'],
    files: (n) => ({
      'package.json': JSON.stringify({ name: n.toLowerCase().replace(/\s+/g, '-'), version: '0.1.0', type: 'module', scripts: { start: 'node src/index.js', deploy: 'node src/deploy-commands.js' }, dependencies: { 'discord.js': '^14.16.3', dotenv: '^16.4.5' } }, null, 2),
      'src/index.js': `import { Client, GatewayIntentBits, Collection } from 'discord.js'\nimport 'dotenv/config'\n\nconst client = new Client({\n  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]\n})\n\nclient.commands = new Collection()\n\nclient.once('ready', () => {\n  console.log(\`✅ Logged in as \${client.user.tag}!\`)\n})\n\nclient.on('interactionCreate', async interaction => {\n  if (!interaction.isChatInputCommand()) return\n  if (interaction.commandName === 'ping') {\n    const latency = Date.now() - interaction.createdTimestamp\n    await interaction.reply(\`Pong! 🏓 Latency: \${latency}ms\`)\n  }\n})\n\nclient.login(process.env.DISCORD_TOKEN)\n`,
      'src/deploy-commands.js': `import { REST, Routes, SlashCommandBuilder } from 'discord.js'\nimport 'dotenv/config'\n\nconst commands = [\n  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!')\n].map(c => c.toJSON())\n\nconst rest = new REST().setToken(process.env.DISCORD_TOKEN)\n;(async () => {\n  console.log('Deploying slash commands...')\n  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })\n  console.log('Done!')\n})().catch(console.error)\n`,
      '.env.example': 'DISCORD_TOKEN=your_bot_token_here\nCLIENT_ID=your_application_id\nGUILD_ID=your_test_server_id\n',
      '.gitignore': GITIGNORE_NODE,
    }),
    install: 'npm install',
  },
  // ── Minecraft ─────────────────────────────────────────────────────────────
  {
    id: 'mc-paper',
    name: 'Paper Plugin',
    desc: 'Minecraft Paper/Spigot server plugin with Maven.',
    emoji: '📜',
    category: 'Minecraft',
    tags: ['java', 'minecraft', 'paper', 'spigot', 'maven'],
    files: (n) => {
      const pkg = n.toLowerCase().replace(/[^a-z0-9]/g, '')
      const cls = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'Plugin'
      return {
        'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0"\n         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n    <modelVersion>4.0.0</modelVersion>\n\n    <groupId>com.example</groupId>\n    <artifactId>${pkg}</artifactId>\n    <version>1.0.0-SNAPSHOT</version>\n    <packaging>jar</packaging>\n\n    <properties>\n        <java.version>21</java.version>\n        <maven.compiler.source>21</maven.compiler.source>\n        <maven.compiler.target>21</maven.compiler.target>\n        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>\n    </properties>\n\n    <repositories>\n        <repository>\n            <id>papermc</id>\n            <url>https://repo.papermc.io/repository/maven-public/</url>\n        </repository>\n    </repositories>\n\n    <dependencies>\n        <dependency>\n            <groupId>io.papermc.paper</groupId>\n            <artifactId>paper-api</artifactId>\n            <version>1.21.4-R0.1-SNAPSHOT</version>\n            <scope>provided</scope>\n        </dependency>\n    </dependencies>\n\n    <build>\n        <plugins>\n            <plugin>\n                <groupId>org.apache.maven.plugins</groupId>\n                <artifactId>maven-shade-plugin</artifactId>\n                <version>3.6.0</version>\n                <executions>\n                    <execution>\n                        <phase>package</phase>\n                        <goals><goal>shade</goal></goals>\n                    </execution>\n                </executions>\n            </plugin>\n        </plugins>\n    </build>\n</project>\n`,
        [`src/main/java/com/example/${pkg}/${cls}.java`]: `package com.example.${pkg};\n\nimport org.bukkit.plugin.java.JavaPlugin;\n\npublic class ${cls} extends JavaPlugin {\n\n    @Override\n    public void onEnable() {\n        getLogger().info("${n} has been enabled!");\n    }\n\n    @Override\n    public void onDisable() {\n        getLogger().info("${n} has been disabled!");\n    }\n}\n`,
        'src/main/resources/plugin.yml': `name: ${n}\nversion: \${project.version}\nmain: com.example.${pkg}.${cls}\napi-version: '1.21'\ndescription: A Paper plugin\nauthor: YourName\n`,
        '.gitignore': GITIGNORE_MAVEN,
      }
    },
    install: 'mvn package -DskipTests',
  },
  {
    id: 'mc-fabric',
    name: 'Fabric Mod',
    desc: 'Minecraft Fabric mod with Gradle and Java.',
    emoji: '🧵',
    category: 'Minecraft',
    tags: ['java', 'minecraft', 'fabric', 'gradle', 'mod'],
    files: (n) => {
      const modid = n.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      const cls   = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'Mod'
      return {
        'build.gradle': `plugins {\n    id 'fabric-loom' version '1.9-SNAPSHOT'\n    id 'maven-publish'\n}\n\nversion = project.mod_version\ngroup = project.maven_group\n\nbase {\n    archivesName = project.archives_base_name\n}\n\ndependencies {\n    minecraft "com.mojang:minecraft:\${project.minecraft_version}"\n    mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"\n    modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"\n    modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"\n}\n\nprocessResources {\n    inputs.property "version", project.version\n    filteringCharset "UTF-8"\n    filesMatching("fabric.mod.json") { expand "version": project.version }\n}\n\njava {\n    withSourcesJar()\n    sourceCompatibility = JavaVersion.VERSION_21\n    targetCompatibility = JavaVersion.VERSION_21\n}\n`,
        'gradle.properties': `org.gradle.jvmargs=-Xmx1G\nminecraft_version=1.21.4\nyarn_mappings=1.21.4+build.3\nloader_version=0.16.10\nfabric_version=0.119.2+1.21.4\nmod_version=1.0.0\nmaven_group=com.example\narchives_base_name=${modid}\n`,
        'settings.gradle': `pluginManagement {\n    repositories {\n        maven { url 'https://maven.fabricmc.net/' }\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\nrootProject.name = '${modid}'\n`,
        [`src/main/java/com/example/${modid}/${cls}.java`]: `package com.example.${modid};\n\nimport net.fabricmc.api.ModInitializer;\nimport org.slf4j.Logger;\nimport org.slf4j.LoggerFactory;\n\npublic class ${cls} implements ModInitializer {\n    public static final String MOD_ID = "${modid}";\n    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);\n\n    @Override\n    public void onInitialize() {\n        LOGGER.info("${n} initialised!");\n    }\n}\n`,
        'src/main/resources/fabric.mod.json': JSON.stringify({ "schemaVersion": 1, "id": modid, "version": "${version}", "name": n, "description": "A Fabric mod", "authors": ["YourName"], "contact": {}, "license": "MIT", "icon": "assets/${modid}/icon.png", "environment": "*", "entrypoints": { "main": [`com.example.${modid}.${cls}`] }, "depends": { "fabricloader": ">=0.16.0", "minecraft": "~1.21.4", "java": ">=21" } }, null, 2),
        '.gitignore': GITIGNORE_GRADLE,
      }
    },
    install: './gradlew build',
  },
  {
    id: 'mc-forge',
    name: 'Forge Mod',
    desc: 'Minecraft NeoForge mod with Gradle and Java.',
    emoji: '⚒️',
    category: 'Minecraft',
    tags: ['java', 'minecraft', 'forge', 'neoforge', 'gradle', 'mod'],
    files: (n) => {
      const modid = n.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      const cls   = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'Mod'
      return {
        'build.gradle': `plugins {\n    id 'net.neoforged.gradle.userdev' version '7.0.+'\n}\n\nversion = mod_version\ngroup = maven_group\nbase { archivesName = archives_base_name }\n\njava.toolchain.languageVersion = JavaLanguageVersion.of(21)\n\ndependencies {\n    implementation "net.neoforged:neoforge:\${neo_version}"\n}\n\ntasks.named('jar', Jar).configure { manifest { attributes(['Specification-Title': '${modid}', 'Specification-Version': '1', 'Implementation-Title': project.name, 'Implementation-Version': project.jar.archiveVersion]) } }\n`,
        'gradle.properties': `org.gradle.jvmargs=-Xmx3G\norg.gradle.daemon=false\n\nminecraft_version=1.21.4\nneo_version=21.4.69\n\nmod_version=1.0.0\nmaven_group=com.example\narchives_base_name=${modid}\n`,
        'settings.gradle': `pluginManagement {\n    repositories {\n        gradlePluginPortal()\n        mavenCentral()\n        maven { url = 'https://maven.neoforged.net/releases' }\n    }\n}\nrootProject.name = '${modid}'\n`,
        [`src/main/java/com/example/${modid}/${cls}.java`]: `package com.example.${modid};\n\nimport net.neoforged.fml.common.Mod;\nimport org.apache.logging.log4j.LogManager;\nimport org.apache.logging.log4j.Logger;\n\n@Mod("${modid}")\npublic class ${cls} {\n    public static final Logger LOGGER = LogManager.getLogger();\n\n    public ${cls}() {\n        LOGGER.info("${n} loaded!");\n    }\n}\n`,
        [`src/main/resources/META-INF/neoforge.mods.toml`]: `modLoader="javafml"\nloaderVersion="[4,)"\nlicense="MIT"\n\n[[mods]]\nmodId="${modid}"\nversion="\${file.jarVersion}"\ndisplayName="${n}"\ndescription="""A NeoForge mod."""\n\n[[dependencies.${modid}]]\n    modId="neoforge"\n    type="required"\n    versionRange="[21.4,)"\n    ordering="NONE"\n    side="BOTH"\n[[dependencies.${modid}]]\n    modId="minecraft"\n    type="required"\n    versionRange="[1.21.4,1.22)"\n    ordering="NONE"\n    side="BOTH"\n`,
        'src/main/resources/META-INF/MANIFEST.MF': `Manifest-Version: 1.0\n`,
        '.gitignore': GITIGNORE_GRADLE,
      }
    },
    install: './gradlew build',
  },
  {
    id: 'mc-velocity',
    name: 'Velocity Plugin',
    desc: 'Velocity proxy plugin with Maven (Java).',
    emoji: '🚄',
    category: 'Minecraft',
    tags: ['java', 'minecraft', 'velocity', 'proxy', 'maven'],
    files: (n) => {
      const pkg = n.toLowerCase().replace(/[^a-z0-9]/g, '')
      const cls = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'Plugin'
      return {
        'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0"\n         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n    <modelVersion>4.0.0</modelVersion>\n    <groupId>com.example</groupId>\n    <artifactId>${pkg}</artifactId>\n    <version>1.0.0-SNAPSHOT</version>\n    <properties>\n        <java.version>17</java.version>\n        <maven.compiler.source>17</maven.compiler.source>\n        <maven.compiler.target>17</maven.compiler.target>\n    </properties>\n    <repositories>\n        <repository>\n            <id>papermc</id>\n            <url>https://repo.papermc.io/repository/maven-public/</url>\n        </repository>\n    </repositories>\n    <dependencies>\n        <dependency>\n            <groupId>com.velocitypowered</groupId>\n            <artifactId>velocity-api</artifactId>\n            <version>3.4.0-SNAPSHOT</version>\n            <scope>provided</scope>\n        </dependency>\n    </dependencies>\n</project>\n`,
        [`src/main/java/com/example/${pkg}/${cls}.java`]: `package com.example.${pkg};\n\nimport com.google.inject.Inject;\nimport com.velocitypowered.api.event.Subscribe;\nimport com.velocitypowered.api.event.proxy.ProxyInitializeEvent;\nimport com.velocitypowered.api.plugin.Plugin;\nimport com.velocitypowered.api.proxy.ProxyServer;\nimport org.slf4j.Logger;\n\n@Plugin(id = "${pkg}", name = "${n}", version = "1.0.0", authors = {"YourName"})\npublic class ${cls} {\n    private final ProxyServer server;\n    private final Logger logger;\n\n    @Inject\n    public ${cls}(ProxyServer server, Logger logger) {\n        this.server = server;\n        this.logger = logger;\n    }\n\n    @Subscribe\n    public void onProxyInitialization(ProxyInitializeEvent event) {\n        logger.info("${n} enabled!");\n    }\n}\n`,
        '.gitignore': GITIGNORE_MAVEN,
      }
    },
    install: 'mvn package -DskipTests',
  },
  {
    id: 'mc-bungeecord',
    name: 'BungeeCord Plugin',
    desc: 'BungeeCord proxy plugin with Maven (Java).',
    emoji: '🌐',
    category: 'Minecraft',
    tags: ['java', 'minecraft', 'bungeecord', 'waterfall', 'proxy', 'maven'],
    files: (n) => {
      const pkg = n.toLowerCase().replace(/[^a-z0-9]/g, '')
      const cls = n.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d+/, '') || 'Plugin'
      return {
        'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0"\n         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n    <modelVersion>4.0.0</modelVersion>\n    <groupId>com.example</groupId>\n    <artifactId>${pkg}</artifactId>\n    <version>1.0.0-SNAPSHOT</version>\n    <properties>\n        <java.version>8</java.version>\n        <maven.compiler.source>8</maven.compiler.source>\n        <maven.compiler.target>8</maven.compiler.target>\n    </properties>\n    <repositories>\n        <repository>\n            <id>bungeecord-repo</id>\n            <url>https://oss.sonatype.org/content/repositories/snapshots</url>\n        </repository>\n    </repositories>\n    <dependencies>\n        <dependency>\n            <groupId>net.md-5</groupId>\n            <artifactId>bungeecord-api</artifactId>\n            <version>1.21-R0.1-SNAPSHOT</version>\n            <type>jar</type>\n            <scope>provided</scope>\n        </dependency>\n    </dependencies>\n</project>\n`,
        [`src/main/java/com/example/${pkg}/${cls}.java`]: `package com.example.${pkg};\n\nimport net.md_5.bungee.api.plugin.Plugin;\n\npublic class ${cls} extends Plugin {\n\n    @Override\n    public void onEnable() {\n        getLogger().info("${n} enabled!");\n    }\n\n    @Override\n    public void onDisable() {\n        getLogger().info("${n} disabled!");\n    }\n}\n`,
        'src/main/resources/bungee.yml': `name: ${n}\nversion: 1.0.0\nmain: com.example.${pkg}.${cls}\nauthor: YourName\ndescription: A BungeeCord plugin\n`,
        '.gitignore': GITIGNORE_MAVEN,
      }
    },
    install: 'mvn package -DskipTests',
  },
  {
    id: 'monorepo',
    name: 'Turborepo',
    desc: 'Monorepo with Turborepo, apps/web (Next.js) and packages/ui.',
    emoji: '🏗️',
    category: 'Other',
    tags: ['monorepo', 'turborepo', 'nextjs'],
    files: (n) => ({
      'package.json': JSON.stringify({ name: n.toLowerCase().replace(/\s+/g, '-'), version: '0.0.0', private: true, workspaces: ['apps/*', 'packages/*'], scripts: { build: 'turbo run build', dev: 'turbo run dev', lint: 'turbo run lint' }, devDependencies: { turbo: 'latest' } }, null, 2),
      'turbo.json': JSON.stringify({ $schema: 'https://turbo.build/schema.json', pipeline: { build: { dependsOn: ['^build'], outputs: ['.next/**', 'dist/**'] }, dev: { cache: false, persistent: true }, lint: {} } }, null, 2),
      'apps/web/package.json': JSON.stringify({ name: 'web', version: '0.0.0', private: true, scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' }, dependencies: { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' }, devDependencies: { typescript: '^5.0.0', '@types/react': '^18.0.0', '@types/node': '^20.0.0' } }, null, 2),
      'apps/web/app/page.tsx': `export default function Page() {\n  return <h1>Welcome to ${n}</h1>\n}\n`,
      'apps/web/app/layout.tsx': `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>\n}\n`,
      'packages/ui/package.json': JSON.stringify({ name: '@repo/ui', version: '0.0.0', private: true, exports: { '.': './src/index.tsx' }, devDependencies: { react: '^18.0.0', typescript: '^5.0.0' } }, null, 2),
      'packages/ui/src/index.tsx': `export function Button({ children }: { children: React.ReactNode }) {\n  return <button>{children}</button>\n}\n`,
      '.gitignore': `node_modules\n.turbo\ndist\n.next\n.env\n`,
    }),
    install: 'npm install',
  },
]
