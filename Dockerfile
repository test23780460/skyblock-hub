FROM node:22-alpine

WORKDIR /app
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm run build
RUN chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["npm", "run", "start"]
