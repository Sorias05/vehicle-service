FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env .env

CMD ["sh", "-c", "npm run migration:run:prod && npm run start:user"]