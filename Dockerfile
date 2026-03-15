FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Generate Prisma client and build the application
RUN pnpm prisma generate && pnpm run build

# Install only production dependencies in a separate stage
FROM node:22-alpine AS deps

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Final production image
FROM node:22-alpine

WORKDIR /app

# Install pnpm and tsx for runtime needs
RUN npm install -g pnpm tsx

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy the built app, prisma schema, config, and runtime source deps
COPY --from=builder /app/build ./build
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/lib/frequency ./src/lib/frequency

# Generate Prisma client using locally installed prisma (fast, no download)
RUN pnpm prisma generate

# Expose port
EXPOSE 3000

# Set node environment
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD npx prisma db push --accept-data-loss && pnpm seed && node build/index.js
