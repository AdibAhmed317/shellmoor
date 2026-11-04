// Binary files in the dummy project, mapped to URLs the preview can show.
export const mockImages: Record<string, string> = {
  '/my-project/public/screenshot.png': '/wails.png',
};

// TODO(backend): dummy project until the Go side exposes the filesystem. Some files contain deliberate errors
// so the problems list has something to show.
export const mockFiles: Record<string, string> = {
  '/my-project/src/app.ts': `import { readFileSync } from 'fs';

interface User {
  id: number;
  name: string;
  email: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}

const admin: User = { id: 1, name: 'Ada' }; // error: missing email

const count: number = 'three'; // error: string is not a number

console.log(greet(admin), count);
console.log(undefinedVariable); // error: cannot find name
`,
  '/my-project/src/utils.js': `export function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
`,
  '/my-project/src/style.css': `:root {
  --accent: #5fd4b0;
}

body {
  margin: 0;
  font-family: system-ui;
  colr: red; /* warning: unknown property */
}

.card {
  padding: 16px;
  border-radius: 8px
`,
  '/my-project/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>My Project</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/app.ts"></script>
  </body>
</html>
`,
  '/my-project/package.json': `{
  "name": "my-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
  }
}
`,
  '/my-project/server/main.go': `package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "ok")
	})
	http.ListenAndServe(":8080", nil)
}
`,
  '/my-project/scripts/deploy.py': `import subprocess
import sys

def deploy(env: str) -> None:
    print(f"Deploying to {env}...")
    subprocess.run(["docker", "compose", "up", "-d"], check=True)

if __name__ == "__main__":
    deploy(sys.argv[1] if len(sys.argv) > 1 else "staging")
`,
  '/my-project/docker-compose.yml': `services:
  api:
    build: ./server
    ports:
      - "8080:8080"
    depends_on:
      - postgres
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: example
`,
  '/my-project/Dockerfile': `FROM golang:1.26 AS build
WORKDIR /src
COPY . .
RUN go build -o /app ./server

FROM gcr.io/distroless/base
COPY --from=build /app /app
ENTRYPOINT ["/app"]
`,
  '/my-project/README.md': `# my-project

A sample project for the Shellmoor editor. Toggle **Preview** in the toolbar to see this rendered.

## Getting started

1. Install dependencies with \`npm install\`
2. Start the dev server with \`npm run dev\`
3. Open [localhost:5173](http://localhost:5173)

## Scripts

| Command | What it does |
| --- | --- |
| \`npm run dev\` | Start the dev server |
| \`npm run build\` | Production build |
| \`python scripts/deploy.py prod\` | Deploy |

> Deploys to production need approval in #releases.

\`\`\`bash
docker compose up -d
\`\`\`
`,
  '/my-project/public/logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="28" fill="#5fd4b0"/>
  <path d="M34 44l18 16-18 16" stroke="#0e1013" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M60 78h26" stroke="#0e1013" stroke-width="9" stroke-linecap="round"/>
</svg>
`,
  '/my-project/.env': `DATABASE_URL=postgres://localhost:5432/app
API_KEY=changeme
`,
};
