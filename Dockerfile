FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
RUN npm --workspace @founderos/web run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV FOUNDEROS_WEB_HOST=0.0.0.0
ENV FOUNDEROS_WEB_PORT=3737

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3737

CMD ["npm", "run", "start", "--workspace", "@founderos/web"]
