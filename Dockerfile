# Base image
FROM node:22-alpine AS base
RUN npm install -g npm@latest

# Build stage
FROM base AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm install --only=production
COPY --from=build /app/dist ./dist

# Expose the port (NestJS default is 3000)
EXPOSE 3000

# Run the app
CMD ["node", "dist/main"]
