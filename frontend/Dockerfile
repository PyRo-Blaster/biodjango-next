# Frontend Dockerfile for Development
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
# Clean install to ensure no version mismatch artifacts
RUN rm -rf node_modules package-lock.json && npm install

COPY . .

CMD ["npm", "run", "dev", "--", "--host"]
