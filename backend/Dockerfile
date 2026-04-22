# Gunakan image Node.js versi 18 (stabil)
FROM node:18-slim

# Install Python3 dan Pip (karena backend kita butuh Python buat AI)
RUN apt-get update && apt-get install -y python3 python3-pip

# Set folder kerja di dalam server Railway
WORKDIR /app

# Copy file package.json dan install library Node.js
COPY package*.json ./
RUN npm install

# Copy file requirements.txt dan install library Python
COPY requirements.txt ./
RUN pip3 install -r requirements.txt

# Copy semua file kode (server.js, ai_inference.py, dll)
COPY . .

# Buka port 3001
EXPOSE 3001

# Jalankan server
CMD ["node", "server.js"]