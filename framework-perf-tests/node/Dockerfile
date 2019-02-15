FROM node:latest
WORKDIR /dist
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY ./dist .
COPY .env .env
RUN npm install
CMD [ "node", "test.js" ]