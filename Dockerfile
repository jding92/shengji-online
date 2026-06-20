FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HOST=0.0.0.0
ENV PORT=3001
ENV DATABASE_PATH=/app/data/shengji.sqlite
ENV GAME_SERVER_ORIGIN=http://127.0.0.1:3001
RUN corepack enable

WORKDIR /app
COPY --from=build /app /app
VOLUME ["/app/data"]
EXPOSE 3000 3001

CMD ["pnpm", "start"]
