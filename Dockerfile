#FROM node:16-bullseye
FROM node:26-bookworm


WORKDIR /srv
COPY . .
RUN npm install

ENTRYPOINT [ "bash", "entry.sh" ]