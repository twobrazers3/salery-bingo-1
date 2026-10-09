FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --ignore-engines

COPY . .

EXPOSE 8080 3000

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.js"]
