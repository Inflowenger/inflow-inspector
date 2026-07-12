# syntax=docker/dockerfile:1

##########################################################
# Stage 1 — build the SPA
##########################################################
FROM node:22-alpine AS build

# Vite bakes VITE_* vars in at build time. Override at build:
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com .
# A shell/ENV value takes precedence over any .env file, so this wins.
ARG VITE_API_BASE_URL=http://localhost:8025
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# pnpm via corepack (pnpm-lock.yaml is lockfileVersion 9.0 -> pnpm 10).
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy only the manifests first so `pnpm install` is cached across source edits.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/inflow-ui/package.json ./packages/inflow-ui/package.json

# Install every workspace dependency. Approved post-install build scripts
# (esbuild, vue-demi) come from the allowBuilds list in pnpm-workspace.yaml.
RUN pnpm install --frozen-lockfile

# Copy the rest of the source (node_modules / dist are excluded via .dockerignore).
COPY . .

# The app consumes the *built* output of the inflow-ui workspace library, so
# build the library first, then build the app itself (vue-tsc -b && vite build).
RUN pnpm --filter @inflowenger/inflow-ui build \
 && pnpm build

##########################################################
# Stage 2 — serve the static build with nginx
##########################################################
FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
