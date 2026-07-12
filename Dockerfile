# syntax=docker/dockerfile:1
#
# Self-building RUNTIME image for inflow-inspector (Vue SPA).
#
# Like the inspector-api image, this ships tooling (node + pnpm + git + a static
# file server) but NO prebuilt assets — nothing is built at `docker build` time.
# At container START the entrypoint clones this repo (at $INSPECTOR_REF),
# installs deps, builds the SPA on the arch it's running on, and serves dist/.
#
# The panel is static assets with no backend URL baked in: you enter the Base
# Server URL in its Auth dialog at runtime (Swagger-style), so one build works
# against any reachable inflow-inspector-api.
#
# Publish multi-arch (trivial — just base + entrypoint, no compiled artifacts):
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     -t mehdishokohi/inflow-inspector:latest --push - < Dockerfile

FROM node:22-alpine

# git to fetch source at runtime; pnpm via corepack; `serve` to host the SPA.
RUN apk add --no-cache git \
 && corepack enable && corepack prepare pnpm@10 --activate \
 && npm install -g serve

ENV INSPECTOR_REPO=https://github.com/Inflowenger/inflow-inspector.git \
    INSPECTOR_REF=master \
    SRC_DIR=/src \
    PORT=80

COPY <<'EOF' /usr/local/bin/entrypoint.sh
#!/bin/sh
set -e
if [ -d "$SRC_DIR/.git" ]; then
  echo "[entrypoint] updating $SRC_DIR -> $INSPECTOR_REF"
  git -C "$SRC_DIR" fetch --depth 1 origin "$INSPECTOR_REF"
  git -C "$SRC_DIR" checkout -q FETCH_HEAD
else
  echo "[entrypoint] cloning $INSPECTOR_REPO @ $INSPECTOR_REF"
  git clone --depth 1 -b "$INSPECTOR_REF" "$INSPECTOR_REPO" "$SRC_DIR"
fi
cd "$SRC_DIR"
echo "[entrypoint] installing deps"
pnpm install --frozen-lockfile
echo "[entrypoint] building SPA"
pnpm --filter @inflowenger/inflow-ui build
pnpm build
echo "[entrypoint] serving dist/ on :$PORT"
exec serve -s dist -l "$PORT"
EOF
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
