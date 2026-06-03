FROM node:22-slim

WORKDIR /app

# Copy package files and install all deps (including devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci
RUN if [ ! -e node_modules/vscode-jsonrpc/node ] && [ -e node_modules/vscode-jsonrpc/node.js ]; then ln -s node.js node_modules/vscode-jsonrpc/node; fi

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
