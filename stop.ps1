#Requires -Version 5.1
# Menghentikan EduNusa (MongoDB portable + backend) dengan bersih.
#
# Proses diidentifikasi lewat PORT yang benar-benar dipakai (5000 untuk backend, 27017 untuk
# MongoDB portable proyek ini), bukan lewat tebak-tebakan command line - lebih presisi karena
# backend/mongod kadang dijalankan npm/concurrently dengan path RELATIF (mis. "node server.js"
# tanpa path folder proyek sama sekali di command line-nya), sehingga pencocokan berbasis teks
# command line saja terbukti bisa melewatkan proses yang sebenarnya harus dihentikan.
# Pendekatan ini juga otomatis TIDAK menyentuh proses Node.js/MongoDB lain di komputer yang sama
# yang kebetulan tidak memakai port 5000/27017.

function Write-Step($teks) { Write-Host "`n=== $teks ===" -ForegroundColor Cyan }
function Write-Ok($teks) { Write-Host "OK: $teks" -ForegroundColor Green }

Write-Step "Menghentikan EduNusa"

$dihentikan = 0
$pidSudahDihentikan = New-Object System.Collections.Generic.HashSet[int]

foreach ($port in 5000, 27017) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($conn in $conns) {
    $procId = $conn.OwningProcess
    if ($pidSudahDihentikan.Contains($procId)) { continue }

    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if (-not $proc) { continue }

    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    $pidSudahDihentikan.Add($procId) | Out-Null
    Write-Ok "Proses di port $port ($($proc.ProcessName), PID $procId) dihentikan"
    $dihentikan++
  }
}

if ($dihentikan -eq 0) {
  Write-Host "Tidak ada proses EduNusa yang sedang berjalan." -ForegroundColor Yellow
} else {
  Write-Host "`nEduNusa berhasil dihentikan ($dihentikan proses)." -ForegroundColor Green
}
