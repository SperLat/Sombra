FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
RUN npm install --omit=dev

COPY public ./public
COPY server ./server
COPY README.md LICENSE ./

EXPOSE 4000
CMD ["npm", "start"]
