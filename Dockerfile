# Build stage
FROM node:22-slim AS build

# Create app directory
WORKDIR /app

# Copy package files and install dependencies including dev dependencies for TypeScript compilation
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:22-alpine AS runtime

# Create app directory and data directory for logs
WORKDIR /app
RUN mkdir -p /app/data && \
    chmod -R 755 /app/data

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application and static files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/public ./dist/public

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Expose the application port
EXPOSE 3000

# Health check - checks if the service is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/status/health || exit 1

# Run the application as non-root user for security
USER node

# Run the application
CMD ["node", "dist/index.js"]

