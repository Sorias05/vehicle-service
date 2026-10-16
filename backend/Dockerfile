FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/app

ARG APP_NAME

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN find dist/apps \
    -mindepth 1 \
    -maxdepth 1 \
    ! -name "${APP_NAME}" \
    -exec rm -rf {} +


FROM node:22-bookworm-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /usr/src/app/dist ./dist

USER node

CMD ["sh", "-c", "exec node --require ./dist/apps/${APP_NAME}/src/instrumentation.js ./dist/apps/${APP_NAME}/src/main.js"]