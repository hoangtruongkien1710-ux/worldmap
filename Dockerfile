# syntax=docker/dockerfile:1
# Image chạy production cho WorldMap (Next.js standalone + Prisma)

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build
# Gói riêng công cụ migrate + seed (prisma CLI, tsx) để image chạy gọn
RUN mkdir -p /tools && cp -r node_modules /tools/node_modules

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl tzdata
ENV NODE_ENV=production TZ=Asia/Ho_Chi_Minh NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/src/lib ./src/lib
COPY --from=build --chown=app:app /tools/node_modules ./node_modules
COPY --chown=app:app docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/uploads && chown app:app /app/uploads
USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
