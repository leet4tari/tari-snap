# syntax = docker/dockerfile:1.3

# https://hub.docker.com/_/node
ARG NODE_VERSION=18-bullseye-slim

FROM node:$NODE_VERSION AS builder

ARG SNAP_INDEXER_URL
ENV SNAP_INDEXER_URL=${SNAP_INDEXER_URL}

ARG SNAP_ORIGIN
ENV SNAP_ORIGIN=${SNAP_ORIGIN}

ARG SNAP_ENVS
ENV SNAP_ENVS=${SNAP_ENVS}

# Install package depenances for cargo/rust
RUN apt-get update && \
    apt-get install -y \
      curl \
      openssl \
      libssl-dev \
      pkg-config \
      cmake \
      dh-autoreconf \
      build-essential

# Install cargo/rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

WORKDIR /home/node/app
COPY --chown=node:node . .

# Build tari_wallet_lib wasm
RUN echo "TARI_INDEXER_URL=${SNAP_INDEXER_URL}" > packages/snap/.env && \
    echo "SNAP_ORIGIN=${SNAP_ORIGIN}" > packages/site/.env.production && \
    . "$HOME/.cargo/env" && \
    cd tari_wallet_lib && \
    npm install && \
    npm run build

WORKDIR /home/node/app

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# Build snap and site workspaces
RUN yarn install --immutable && \
    yarn build

FROM node:$NODE_VERSION AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init

USER node
WORKDIR /home/node/app

COPY --from=builder --chown=node /home/node/app/tari_wallet_lib/pkg ./tari_wallet_lib/pkg

COPY --from=builder --chown=node /home/node/app/node_modules ./node_modules
COPY --from=builder --chown=node /home/node/app/packages ./packages
COPY --from=builder --chown=node /home/node/app/.yarn ./.yarn
COPY --from=builder --chown=node /home/node/app/.yarnrc.yml .
COPY --from=builder --chown=node /home/node/app/package*.json .
COPY --from=builder --chown=node /home/node/app/yarn.lock .
COPY --from=builder --chown=node /home/node/app/tsconfig.json .

COPY --from=builder --chown=node /home/node/app/LICENSE* .
COPY --from=builder --chown=node /home/node/app/*.md .

ARG SNAP_ENVS
ENV SNAP_ENVS=${SNAP_ENVS:-'-H 0.0.0.0'}

EXPOSE 8000

ENTRYPOINT ["dumb-init", "--"]
CMD ["yarn", "start"]