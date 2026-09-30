# Multi-stage build: compile the Vite app, then serve the static output
# through nginx, which also reverse-proxies /api/* to the backend
# container so the frontend can be built without baking in a specific
# API host (see VITE_API_BASE_URL below and nginx.conf).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Left empty on purpose: an empty VITE_API_BASE_URL makes api.ts use
# relative paths ("/api/..."), which nginx.conf proxies to the api
# container. That means this same image works at any host/port without
# a rebuild -- only deploy/docker-compose.yml's port mapping changes.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
