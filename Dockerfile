FROM node:20-alpine

WORKDIR /app

# Copia dependências da API e instala
COPY api/package.json ./api/
RUN cd api && npm install --production

# Copia todo o projeto
COPY . .

# Cria pasta de dados persistentes (será sobrescrita pelo volume)
RUN mkdir -p api/data

EXPOSE 3001

CMD ["node", "api/server.js"]
