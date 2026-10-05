# 1단계: 빌드 환경 (Node.js)
FROM node:20-alpine AS build
WORKDIR /app

# docker build 시 넘겨받을 빌드 변수 정의
ARG VITE_API_URL=https://game-cloud-run-935566182756.asia-northeast3.run.app
ARG VITE_API_BASE_URL=https://game-cloud-run-935566182756.asia-northeast3.run.app/routes
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2단계: 정적 파일 서빙 환경 (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]