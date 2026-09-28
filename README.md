# Digital Signage - Panduan Setup

Sistem untuk menampilkan promo/campaign (gambar & video) di 5 TV Android,
**konten beda-beda per TV**, dikelola dari satu panel admin dari mana saja.

## Struktur File

Sekarang **dua aplikasi terpisah** yang di-deploy sebagai dua service/host
berbeda (lihat [Deploy ke AWS](#7-deploy-ke-aws-ecs-fargate-volume-persisten-via-efs)):
`player/` itu **public**, read-only, tanpa PHP sama sekali; `admin/` itu
**internal-only** (VPN/internal ALB), satu-satunya yang bisa menulis ke
`media/`.

```
signage/
├── player/
│   └── index.html      ← Halaman yang dibuka di TV (pakai ?tv=tv1, tv2, dst - TV baru bisa ditambah dari admin panel tanpa deploy ulang)
├── media/                ← Folder gambar/video + config.json (data publik, di-mount read-only ke player)
│   └── config.json      ← Daftar TV + konten per TV (dikelola otomatis, termasuk saat TV ditambah/dihapus dari admin panel)
├── data/                 ← Data admin-only: users.json (akun admin) + audit.log.jsonl (riwayat aktivitas). TIDAK PERNAH di-mount ke player - lihat bagian "User & Audit Trail" di bawah.
├── docker/
│   ├── player.Dockerfile   ← image publik (nginx, static only, tidak ada PHP/admin sama sekali)
│   ├── admin.Dockerfile    ← image internal (php, tulis ke media/ dan data/)
│   └── player-nginx.conf
└── admin/
    ├── login.php
    ├── index.php         ← Dashboard dengan tab per TV + tombol Tambah/Ubah Nama/Hapus TV
    ├── users.php          ← Kelola akun admin (superadmin-only)
    ├── audit.php          ← Riwayat aktivitas (login, upload, hapus, dll)
    ├── actions.php
    ├── auth.php
    ├── config.php         ← Bootstrap admin awal, PLAYER_BASE_URL, & pengaturan lain (WAJIB DIEDIT)
    ├── logout.php
    ├── style.css
    └── script.js
```

`admin/config.php` punya `PLAYER_BASE_URL` yang **wajib** diarahkan ke hostname
publik player - dipakai admin panel untuk membuat "link TV" yang disalin ke
Fully Kiosk, karena admin dan player sekarang dua host berbeda (tidak bisa lagi
diturunkan otomatis dari URL admin panel sendiri).

## Konsep Multi-TV

Satu `media/config.json` menyimpan playlist terpisah per TV (key `tv1`, `tv2`,
dst). Di halaman TV, tinggal tambahkan `?tv=tv1` di URL untuk menentukan TV
mana yang ditampilkan. Semua TV membaca file yang sama, tapi isi playlist
beda per TV. Jumlah TV **tidak dibatasi 5** - tambah/hapus TV langsung dari
admin panel, tanpa perlu deploy ulang.

Di admin panel, tab TV muncul di bagian atas sesuai isi `config.json`, plus
tombol **+ Tambah TV** untuk bikin TV baru (key `tv6`, `tv7`, dst dibuat
otomatis, nama bebas). Di tab TV yang aktif ada tombol **Ubah Nama TV** dan
**Hapus TV Ini** (hapus TV juga menghapus file yang hanya dipakai TV itu -
file yang masih dipakai TV lain tidak ikut terhapus). Setiap tambah/ubah/
hapus TV tercatat di Audit Trail.

Pilih tab, lalu upload konten khusus untuk TV itu. Konten yang sama bisa saja
diupload ulang ke TV lain kalau memang mau dipakai berulang (upload manual
per tab, sistem tidak otomatis menggandakan otomatis - ini supaya kamu punya
kontrol penuh mana yang tampil di TV mana).

## 1. Menjalankan di Laptop Windows (via XAMPP)

1. Download **XAMPP** di apachefriends.org, pilih PHP 8.x, install
2. Copy folder `signage` ke: `C:\xampp\htdocs\signage\`
3. Buka **XAMPP Control Panel** → Start **Apache**
4. Test: buka `http://localhost/signage/admin/` di browser laptop

## 2. Set Permission Folder

Pastikan folder berikut bisa ditulis (di Windows biasanya otomatis writable,
tapi kalau dapat error saat upload, klik kanan folder → Properties → Security →
pastikan user aplikasi punya akses Write):
- `signage/media/` (di dalamnya juga ada `config.json`)

## 3. WAJIB: Ganti Password Admin

Saat `data/users.json` belum ada sama sekali (instalasi baru / volume EFS
baru), sistem otomatis membuat satu akun **superadmin** bootstrap dari
`admin/config.php` (`BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD_HASH`).
Default: username `admin`, password `admin123`. **Ganti sebelum dipakai!**

Ada dua cara ganti password akun bootstrap ini:

- **Setelah login pertama kali** (lebih mudah): buka menu **Users**, tambah
  akun superadmin baru dengan password kuat, login pakai akun baru itu, lalu
  hapus/nonaktifkan akun `admin` bootstrap.
- **Sebelum login pertama kali** (kalau mau langsung ganti default): edit
  `BOOTSTRAP_ADMIN_PASSWORD_HASH` di `admin/config.php`. Untuk membuat hash
  baru, jalankan sekali di file PHP sementara (misal `hash.php` di folder
  `signage/`, buka lewat `http://localhost/signage/hash.php`, lalu hapus
  filenya setelah dipakai):
  ```php
  <?php echo password_hash('password_baru_kamu', PASSWORD_DEFAULT); ?>
  ```
  Copy hasil hash (diawali `$2y$...`) ke `BOOTSTRAP_ADMIN_PASSWORD_HASH`.
  Ini hanya berlaku untuk instalasi yang belum pernah dibuka - kalau
  `data/users.json` sudah ada, ganti password lewat menu **Users** saja,
  bukan lewat file config.

## User, Role & Audit Trail

Sejak admin panel mendukung multi-user, setiap orang yang mengelola konten
punya akun sendiri (bukan satu password bersama):

- **Role `superadmin`**: bisa kelola konten TV *dan* buka menu **Users**
  (tambah/nonaktifkan/hapus akun, atur role). Tidak bisa menonaktifkan atau
  menghapus akun sendiri, dan sistem menolak menghapus satu-satunya
  superadmin aktif yang tersisa supaya tidak ada yang terkunci keluar.
- **Role `editor`**: bisa kelola konten TV (upload, hapus, urutan, tambah/
  ubah/hapus TV) tapi tidak melihat menu Users.

Setiap login, logout, upload, hapus konten, perubahan urutan, tambah/ubah/
hapus TV, dan perubahan akun user tercatat di menu **Audit Trail** (siapa,
kapan, aksi apa, ke TV mana) - dibaca dari `data/audit.log.jsonl`. Data ini
sengaja disimpan di `data/`, folder terpisah dari `media/`, karena `media/`
di-mount (read-only) ke container player yang publik dan disajikan sebagai
file statis oleh nginx - kalau `users.json`/audit log ikut ditaruh di
`media/`, keduanya jadi bisa didownload lewat internet. `data/` butuh
access point EFS sendiri yang **hanya** di-mount ke service admin (lihat
bagian 7 di bawah) dan diblokir total dari akses web langsung lewat
`data/.htaccess`.

## 4. Setup Cloudflare Tunnel (Domain IDCloudhost → Laptop Windows)

### 4a. Pindahkan Domain ke Cloudflare
1. Daftar/login **cloudflare.com** (gratis) → **Add a Site** → masukkan domainmu
2. Cloudflare kasih 2 nameserver
3. Login panel **IDCloudhost** → ganti Nameserver domain ke punya Cloudflare
4. Tunggu propagasi (15 menit - beberapa jam)

### 4b. Install cloudflared di Windows
1. Download `cloudflared-windows-amd64.exe` dari
   https://github.com/cloudflare/cloudflared/releases
2. Rename jadi `cloudflared.exe`, taruh di `C:\cloudflared\`
3. Buka Command Prompt **as Administrator**:
   ```cmd
   cd C:\cloudflared
   cloudflared tunnel login
   ```
   (browser terbuka, pilih domainmu, authorize)
4. Buat tunnel:
   ```cmd
   cloudflared tunnel create signage-tunnel
   ```
   Catat Tunnel ID yang muncul.
5. Buat file `C:\cloudflared\config.yml`:
   ```yaml
   tunnel: signage-tunnel
   credentials-file: C:\Users\NAMA_USER\.cloudflared\TUNNEL_ID.json

   ingress:
     - hostname: signage.domainkamu.com
       service: http://localhost:80
     - service: http_status:404
   ```
6. Arahkan DNS:
   ```cmd
   cloudflared tunnel route dns signage-tunnel signage.domainkamu.com
   ```
7. Jalankan:
   ```cmd
   cloudflared tunnel run signage-tunnel
   ```
8. Install sebagai service supaya auto-start:
   ```cmd
   cloudflared service install
   ```

### 4c. Setting Windows Supaya Selalu Nyala
- XAMPP Control Panel → centang kolom **Svc** untuk Apache (auto-start)
- Control Panel → Power Options → Change plan settings → **Put computer to sleep: Never**
- Colok charger terus

## 5. Akses Panel Admin

Buka: `https://signage.domainkamu.com/signage/admin/`

Login → pilih tab **TV 1 / TV 2 / TV 3 / TV 4 / TV 5** → upload konten khusus untuk
TV itu → atur urutan (drag) & durasi → klik **Simpan Urutan**.

Setiap tab TV menampilkan **link unik** yang tinggal disalin (tombol "Salin
Link") untuk dipakai sebagai Start URL di masing-masing TV.

## 6. Setup di Tiap Xiaomi Android TV

1. Install **Fully Kiosk Browser** dari Play Store
2. Buka Settings (butuh PIN):
   - **Web Content Settings → Start URL:**
     - TV 1: `https://signage.domainkamu.com/signage/index.html?tv=tv1`
     - TV 2: `https://signage.domainkamu.com/signage/index.html?tv=tv2`
     - TV 3: `https://signage.domainkamu.com/signage/index.html?tv=tv3`
     - TV 4: `https://signage.domainkamu.com/signage/index.html?tv=tv4`
     - TV 5: `https://signage.domainkamu.com/signage/index.html?tv=tv5`
   - **Motion & Screen Off → Screen Saver:** Off
   - **Motion & Screen Off → Screen off timer:** 0 (never)
   - **Device Management → Start on Boot:** ON
3. Ulangi untuk semua 5 TV dengan URL masing-masing (beda cuma di `?tv=`).

## 7. Deploy ke AWS ECS Fargate (volume persisten via EFS)

> **Status saat ini (production, cluster `common-prod`)**: masih berjalan
> sebagai **satu service gabungan** (`common-signage-prod-service-v2`,
> image tag `signage-v3.0`) yang didaftarkan ke dua ALB (publik & internal
> lewat Route53) sekaligus - isolasi admin dari akses publik ditegakkan
> lewat listener rule ALB publik yang mem-block path `/admin*` (403), bukan
> lewat pemisahan container/network yang sebenarnya. Bagian di bawah ini
> mendeskripsikan target arsitektur **dua service terpisah** (admin
> internal-only via VPN, player public read-only) yang sudah didukung kode
> di repo ini (`docker/admin.Dockerfile` vs `docker/player.Dockerfile`,
> task definition terpisah) - migrasi cluster/Route53/ALB ke setup ini
> adalah kerja infra menyusul, belum dieksekusi terhadap production.

Dua service Fargate terpisah, satu EFS filesystem, **tiga access point**
(media read-write untuk admin, media read-only untuk player, data read-write
untuk admin saja - lihat 7b):

- **player** (public, di belakang external ALB) — image `docker/player.Dockerfile`,
  mount `media/` **read-only** lewat access point RO.
- **admin** (internal-only, di belakang internal ALB / VPN) — image
  `docker/admin.Dockerfile`, mount `media/` **read-write** lewat access point RW.

Container ECS itu ephemeral — tiap kali task di-restart/deploy ulang, semua isi
`/var/www/html` yang ditulis saat runtime (upload gambar/video + `media/config.json`)
akan hilang kalau tidak dipasang volume persisten. Untuk itu satu-satunya folder
yang perlu ditulis, `media/` (sudah termasuk `config.json` di dalamnya — lihat
[Struktur File](#struktur-file)), dipasang sebagai EFS mount di
`/var/www/html/media` di kedua service. `docker-compose.yml` di root project
meniru setup ini untuk testing lokal (bind mount `./media` ke path yang sama,
read-only untuk `player`, read-write untuk `admin`).

### 7a. Build & push image ke ECR
Dua image ini masuk ke ECR repo `localhost/common` yang sudah ada (dipakai
bareng beberapa service "common-*" lain, dibedakan lewat tag):
```bash
docker build -f docker/player.Dockerfile -t localhost/common:signage-player .
docker build -f docker/admin.Dockerfile -t localhost/common:signage-admin .

aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

docker tag localhost/common:signage-player <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/localhost/common:signage-player
docker tag localhost/common:signage-admin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/localhost/common:signage-admin
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/localhost/common:signage-player
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/localhost/common:signage-admin
```

### 7b. EFS
Kedua service memakai **filesystem EFS yang sama**, tapi dengan **dua access
point berbeda** untuk `media/`: satu read-write (service admin) dan satu
read-only (service player) - path root sama, `"readOnly": true` di mount
point task definition player menegakkan sisi read-only-nya.

Service admin butuh **access point ketiga**, terpisah, khusus untuk `data/`
(users.json + audit log) - lihat `docker/ecs-task-definition-admin.json`
(`REPLACE_EFS_ADMIN_DATA_ACCESS_POINT_ID`). Access point ini **hanya**
dipasang di task definition admin, tidak pernah di task definition player -
ini yang menjamin file akun & audit log tidak bisa diakses dari container
publik sama sekali (bukan cuma diblokir lewat `.htaccess`, tapi memang tidak
pernah ter-mount di sana).

Kalau butuh isolasi read-only `media/` yang benar-benar ditegakkan di layer
AWS (bukan cuma flag di task definition), itu berarti tambah IAM policy per
task role yang membatasi `elasticfilesystem:ClientWrite` ke access point
admin saja — didiskusikan tapi belum dipakai di setup saat ini.

### 7c. Daftarkan task definition
Edit [docker/ecs-task-definition-player.json](docker/ecs-task-definition-player.json)
dan [docker/ecs-task-definition-admin.json](docker/ecs-task-definition-admin.json),
ganti semua `REPLACE_*` (account ID, region, execution/task role, EFS file
system ID, access point ID), lalu:
```bash
aws ecs register-task-definition --cli-input-json file://docker/ecs-task-definition-player.json
aws ecs register-task-definition --cli-input-json file://docker/ecs-task-definition-admin.json
```

Buat dua service Fargate (satu per task definition) lewat Console atau
`aws ecs create-service`, pastikan task jalan di subnet yang sama dengan mount
target EFS di atas. Service player didaftarkan ke target group ALB publik,
service admin ke target group ALB internal saja — **jangan** daftarkan admin ke
ALB publik.

### 7d. Wajib: seed `media/config.json` sebelum login pertama
Volume EFS baru mulai **kosong**. Tanpa `config.json` yang berisi minimal
struktur `{"displays": {"tv1": {...}, ...}}`, admin panel tidak akan
menampilkan tab TV sama sekali (tidak ada display untuk dipilih, jadi upload
juga gagal). Mount EFS sementara lewat instance EC2/Cloud9 di subnet & security
group yang sama (atau `aws efs` + NFS client), lalu copy `media/config.json`
dari repo (dan opsional file-file di `media/` kalau mau bawa konten contoh) ke
root access point sebelum task pertama kali dijalankan.

`data/` (access point ketiga, lihat 7b) **tidak perlu** di-seed manual -
`admin/auth.php` otomatis membuat `data/users.json` berisi satu akun
superadmin bootstrap begitu ada yang membuka halaman login dan file itu
belum ada sama sekali (lihat bagian "User, Role & Audit Trail" dan bagian 3
di atas untuk cara ganti password bootstrap-nya).

## Catatan

- Konten auto-update di TV dalam ±60 detik setelah kamu simpan di admin panel
- Video otomatis dimute (kebijakan autoplay browser)
- Batas upload 50MB per file, bisa diubah di `admin/config.php` (`MAX_UPLOAD_MB`),
  sesuaikan juga limit PHP di `C:\xampp\php\php.ini`
  (`upload_max_filesize`, `post_max_size`)
- Kalau laptop mati listrik, semua TV ikut mati kontennya - pertimbangkan UPS
  kecil untuk laptop kalau butuh reliability tinggi
