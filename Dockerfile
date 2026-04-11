FROM node:25.9.0-alpine3.23

WORKDIR /app

COPY package.json .
COPY yarn.lock .

RUN apk add --no-cache --virtual .build-deps python3 make g++

RUN corepack enable

RUN yarn install --frozen-lockfile

COPY --chown=node:node . .

RUN yarn build

RUN apk del .build-deps

RUN mkdir data && chown -R node:node data

EXPOSE 3000

#ENV ACTUAL_PASSWORD=""
#ENV ACTUAL_SERVER_URL=""
#ENV ACTUAL_SYNC_ID=""
#ENV ACTUAL_BUDGET_ENCRYPTION_KEY=""
#ENV ACTUAL_DATA_DIR="./data"

USER node

CMD ["node", "dist/server.js"]
