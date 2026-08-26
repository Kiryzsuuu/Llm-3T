#Requires -Version 5.1
# Skrip sekali-klik: siapkan semua kebutuhan EduNusa (Ollama, model AI, MongoDB portable,
# dependency npm, file .env) lalu jalankan aplikasinya. Aman dijalankan berulang kali -
# setiap langkah dilewati kalau sudah pernah dilakukan sebelumnya.

$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot
Set-Location $ROOT

function Write-Step($teks) { Write-Host "`n=== $teks ===" -ForegroundColor Cyan }
function Write-Ok($teks) { Write-Host "OK: $teks" -ForegroundColor Green }
function Write-Warn2($teks) { Write-Host "! $teks" -ForegroundColor Yellow }

# --- 1. Node.js ---
Write-Step "Cek Node.js"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js belum terinstal. Unduh & instal dulu dari https://nodejs.org (versi LTS), lalu jalankan skrip ini lagi." -ForegroundColor Red
  Read-Host "Tekan Enter untuk menutup"
  exit 1
}
Write-Ok "Node.js $(node --version) ditemukan"

# --- 2. Ollama ---
Write-Step "Cek Ollama"
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Warn2 "Ollama belum terinstal. Mengunduh installer resmi..."
  $installer = Join-Path $env:TEMP "OllamaSetup.exe"
  Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installer -UseBasicParsing
  Write-Host "Menjalankan installer Ollama - ikuti instruksi di jendela yang muncul, lalu lanjutkan skrip ini setelah instalasi selesai." -ForegroundColor Yellow
  Start-Process -FilePath $installer -Wait
  $env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"
  if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "Ollama masih belum terdeteksi. Tutup jendela ini, buka terminal baru, lalu jalankan skrip ini lagi." -ForegroundColor Red
    Read-Host "Tekan Enter untuk menutup"
    exit 1
  }
}
Write-Ok "Ollama $(ollama --version) siap"

# --- 3. Model embedding (nomic-embed-text) ---
Write-Step "Cek model embedding (nomic-embed-text)"
$modelList = ollama list 2>&1 | Out-String
if ($modelList -match "nomic-embed-text") {
  Write-Ok "nomic-embed-text sudah ada"
} else {
  Write-Warn2 "Menarik model nomic-embed-text (butuh internet, sekali saja)..."
  ollama pull nomic-embed-text
}

# --- 4. Model chat EduNusa (gemma2:2b + build custom model) ---
Write-Step "Cek model EduNusa"
$modelList = ollama list 2>&1 | Out-String
if ($modelList -match "edunusa") {
  Write-Ok "Model 'edunusa' sudah ada"
} else {
  Write-Warn2 "Membangun model EduNusa (menarik base model gemma2:2b dulu bila perlu, butuh internet)..."
  $bash = "C:\Program Files\Git\bin\bash.exe"
  if (Test-Path $bash) {
    & $bash "edunusa-model/setup-edunusa.sh"
  } else {
    ollama pull gemma2:2b
    ollama create edunusa -f "edunusa-model\Modelfile"
  }
}

# --- 5. MongoDB portable ---
Write-Step "Cek MongoDB portable"
$mongod = Join-Path $ROOT "mongodb-portable\bin\mongod.exe"
if (Test-Path $mongod) {
  Write-Ok "MongoDB portable sudah ada"
} else {
  Write-Warn2 "Mengunduh MongoDB portable (~900MB, sekali saja, butuh internet)..."
  $manifest = Invoke-RestMethod -Uri "https://downloads.mongodb.org/current.json"
  $current = $manifest.versions | Where-Object { $_.current } | Select-Object -First 1
  $win = $current.downloads | Where-Object { $_.target -eq 'windows' -and $_.edition -eq 'base' -and $_.arch -eq 'x86_64' } | Select-Object -First 1
  $zipPath = Join-Path $env:TEMP "mongodb-portable-download.zip"
  Invoke-WebRequest -Uri $win.archive.url -OutFile $zipPath -UseBasicParsing

  $hash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
  if ($hash -ne $win.archive.sha256) {
    Write-Host "Checksum MongoDB tidak cocok, file unduhan mungkin rusak/tidak sah. Batal." -ForegroundColor Red
    Remove-Item $zipPath -Force
    exit 1
  }

  $extractTmp = Join-Path $env:TEMP "mongodb-portable-extract"
  if (Test-Path $extractTmp) { Remove-Item $extractTmp -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $extractTmp -Force
  $inner = Get-ChildItem -Path $extractTmp -Directory | Select-Object -First 1
  Move-Item -Path $inner.FullName -Destination (Join-Path $ROOT "mongodb-portable")
  Remove-Item $zipPath, $extractTmp -Recurse -Force
  Write-Ok "MongoDB portable terpasang di mongodb-portable/"
}

# --- 6. Dependency npm ---
Write-Step "Cek dependency npm"
if (Test-Path (Join-Path $ROOT "node_modules")) {
  Write-Ok "Dependency npm sudah terinstal"
} else {
  Write-Warn2 "Menjalankan npm install (sekali saja, butuh internet)..."
  npm install
}

# --- 7. File .env backend ---
Write-Step "Cek backend/.env"
$envPath = Join-Path $ROOT "backend\.env"
if (Test-Path $envPath) {
  Write-Ok "backend/.env sudah ada"
} else {
  Write-Warn2 "Membuat backend/.env dari template..."
  Copy-Item (Join-Path $ROOT "backend\.env.example") $envPath
  $jwt = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
  (Get-Content $envPath) -replace 'JWT_SECRET=change_this_secret', "JWT_SECRET=$jwt" | Set-Content $envPath
  Write-Ok "backend/.env dibuat dengan JWT_SECRET acak"
}

# --- 8. Jalankan aplikasi ---
Write-Step "Menjalankan EduNusa"
Write-Host "Menyalakan MongoDB + backend + build frontend... browser akan terbuka otomatis begitu siap." -ForegroundColor Cyan

Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { Start-Process "http://localhost:5000"; break }
    } catch {}
    Start-Sleep -Seconds 2
  }
} | Out-Null

npm run deploy
