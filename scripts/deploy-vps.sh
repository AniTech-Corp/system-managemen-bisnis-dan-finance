#!/usr/bin/env bash
set -e

echo "========================================="
echo "🚀 Memulai Setup KLIR OS di VPS Hostinger"
echo "========================================="

# 1. Update system & install prerequisites
echo "📦 [1/6] Memeriksa dan menginstal paket sistem..."
apt update -y
apt install -y curl git ufw nginx

# 2. Install Node.js 20 & PM2 jika belum ada
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    echo "⚙️ [2/6] Memasang Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo "✅ Node.js sudah terpasang: $(node -v)"
fi

if ! command -v pm2 &> /dev/null; then
    echo "⚙️ Memasang PM2..."
    npm install -g pm2
fi

# 3. Setup Direktori /var/www/KLIR
echo "📂 [3/6] Menyiapkan direktori aplikasi..."
mkdir -p /var/www
cd /var/www

if [ ! -d "/var/www/KLIR" ]; then
    echo "Cloning repository..."
    git clone https://github.com/AniTech-Corp/KLIR.git
    cd KLIR
else
    echo "Updating existing repository..."
    cd /var/www/KLIR
    git pull origin main || true
fi

# 4. Install dependencies & Prisma
echo "📦 [4/6] Menginstal dependensi NPM & Prisma..."
npm install
npx prisma generate

# 5. Build Next.js
echo "🏗️ [5/6] Mem-build Next.js..."
npm run build

# 6. Jalankan dengan PM2
echo "🚀 [6/6] Menjalankan aplikasi dengan PM2 di port 3000..."
pm2 start ecosystem.config.js || pm2 restart klir-os
pm2 save
pm2 startup || true

echo "========================================="
echo "🎉 KLIR OS BERHASIL DIJALANKAN DI VPS!"
echo "Status PM2:"
pm2 status
echo "========================================="
