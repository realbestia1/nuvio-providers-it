FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build providers (generates 'providers' folder required by the addon)
RUN node build.js

# Expose the port the app runs on
EXPOSE 7000

# Start the addon
CMD ["node", "stremio_addon.js"]
