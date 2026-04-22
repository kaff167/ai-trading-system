# Gunakan image Node.js versi 18
FROM node:18-slim

# Install Python3 dan dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set folder kerja
WORKDIR /app

# Copy package.json dan install Node.js dependencies
COPY package*.json ./
RUN npm install

# Buat virtual environment Python
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy semua file kode
COPY . .

# Expose port
EXPOSE 3001

# Jalankan server
CMD ["node", "server.js"]