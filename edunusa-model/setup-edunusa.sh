#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELFILE_PATH="$SCRIPT_DIR/Modelfile"
BASE_MODEL="gemma2:2b"
MODEL_NAME="edunusa"

echo "=== Setup EduNusa untuk Ollama ==="
echo

# 1. Cek apakah Ollama terinstall
if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama belum terinstall di sistem ini."
  echo
  echo "Silakan install Ollama terlebih dahulu:"
  echo "  - Kunjungi https://ollama.com/download, atau"
  echo "  - Linux/macOS: curl -fsSL https://ollama.com/install.sh | sh"
  echo "  - Windows: unduh installer dari https://ollama.com/download/windows"
  echo
  echo "Setelah Ollama terinstall, jalankan kembali script ini."
  exit 1
fi

echo "✓ Ollama sudah terinstall ($(ollama --version 2>/dev/null || echo 'versi tidak terdeteksi'))"
echo

# 2. Pull base model gemma2:2b jika belum ada
if ollama list | awk '{print $1}' | grep -qx "$BASE_MODEL"; then
  echo "✓ Base model $BASE_MODEL sudah tersedia"
else
  echo "Menarik base model $BASE_MODEL ..."
  ollama pull "$BASE_MODEL"
fi
echo

# 3. Build model EduNusa dari Modelfile
if [ ! -f "$MODELFILE_PATH" ]; then
  echo "Modelfile tidak ditemukan di $MODELFILE_PATH"
  exit 1
fi

echo "Membuat model $MODEL_NAME dari Modelfile ..."
ollama create "$MODEL_NAME" -f "$MODELFILE_PATH"
echo "✓ Model $MODEL_NAME berhasil dibuat"
echo

# 4. Test model
echo "Menguji model dengan pertanyaan: \"Siapa kamu?\""
echo "---"
ollama run "$MODEL_NAME" "Siapa kamu?"
echo "---"
echo

# 5. Pesan sukses
echo "=== EduNusa siap dipakai! ==="
echo "Gunakan model ini di aplikasi dengan nama: $MODEL_NAME"
echo "Contoh: ollama run $MODEL_NAME \"Jelaskan pecahan untuk anak SD\""
