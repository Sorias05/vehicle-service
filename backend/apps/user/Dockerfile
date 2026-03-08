FROM node:20 AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist
COPY .env .env

CMD ["sh", "-c", "npm run migration:run:prod && npm run start:user"]