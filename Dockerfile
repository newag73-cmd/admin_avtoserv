FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/build.db
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATA_DIR=/data
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown -R app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/data /data
COPY --from=build --chown=app:app /app/prisma ./prisma
# Prisma Client is generated in the build stage. Copying node_modules from the
# deps stage here leaves the production container without the generated SQLite
# client and makes every database-backed route fail with HTTP 500.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
USER app
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
