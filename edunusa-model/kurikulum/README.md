# Folder Kurikulum

Letakkan file **PDF atau TXT** buku/materi Kemendikbud di folder ini.

Beberapa hal yang perlu diperhatikan:

- Format yang didukung: `.pdf` dan `.txt`.
- Nama file sebaiknya diawali dengan nama mata pelajaran, contoh:
  `matematika_kelas5_bab1.pdf`, `ipa-kelas7.txt`, `bahasa-indonesia_sma.pdf`.
  Kata pertama pada nama file (sebelum tanda `-`, `_`, atau spasi) dipakai sebagai
  tebakan nama mata pelajaran oleh `training-data/prepare-dataset.js`.
- Agar hasil pemisahan bab lebih akurat, usahakan teks memiliki penanda bab yang jelas,
  misalnya diawali dengan `BAB 1`, `Bab 2`, `Kegiatan Belajar 1`, dsb. Jika tidak ada
  penanda bab, teks akan otomatis dipotong per ± 800 karakter.

Setelah file-file materi diletakkan di sini, jalankan:

```bash
cd ../training-data
node prepare-dataset.js
```

untuk menghasilkan `training-data/dataset-final.jsonl` yang siap dipakai pada notebook
`finetune-colab.ipynb`.

> Folder ini sengaja dikosongkan di repository (lihat `.gitignore`) karena berkas buku
> kurikulum biasanya berukuran besar dan/atau memiliki lisensi tersendiri.
