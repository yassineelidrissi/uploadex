FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm install -f

COPY . .

EXPOSE 5000

CMD ["npm", "run", "start:dev"]