# MillenniumFilm — Client Gallery Platform

Premium photo & video delivery platform for wedding and portrait photographers.

## Stack
- **Next.js 14** — frontend + API
- **Cloudflare R2** — file storage (up to 20GB per gallery)
- **Supabase** — database (galleries + file metadata)
- **Vercel** — hosting (free tier)

---

## Deploy in 5 steps

### 1. Push to GitHub

1. Create new repo on github.com → name: `millenniumfilm`
2. In terminal (or GitHub Desktop):
```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/millenniumfilm.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to vercel.com → "Add New Project"
2. Import your `millenniumfilm` GitHub repo
3. Framework: **Next.js** (auto-detected)
4. Click **"Environment Variables"** — add all variables below
5. Click **"Deploy"**

### 3. Environment Variables (add in Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://imbfskqdhipzarlnuzdq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_ENDPOINT=https://285b7d35d8ce2d109ec562738493d9c0.r2.cloudflarestorage.com
R2_BUCKET_NAME=millenniumfilm-storage

ADMIN_PASSWORD=choose_a_strong_password
```

### 4. Enable Public Access for R2 (for image previews)

In Cloudflare R2 → your bucket → Settings → enable **"R2.dev subdomain"**
This gives your bucket a public URL for image previews in the gallery.

### 5. Done!

- **Admin panel:** `your-app.vercel.app/admin`
- **Client gallery:** `your-app.vercel.app/gallery/[slug]`

---

## How to use

### Create a client gallery
1. Go to `/admin` → enter your password
2. Fill in client name + slug (auto-generated from name)
3. Choose expiry (7/30/90 days or never)
4. Click "Create Gallery"

### Upload files
1. In the gallery row → click "Upload Files"
2. Select photos and/or videos (multiple at once)
3. Files upload directly to Cloudflare R2
4. Progress shows in real-time

### Share with client
1. Click "Copy Link" → share the URL with client
2. Client opens link → sees their gallery
3. Client selects individual files or downloads all
4. No login required for client

---

## Pricing estimate
- Vercel: **Free**
- Supabase: **Free** (up to 500MB DB)
- Cloudflare R2: **~$0.015/GB/month**
  - 100GB stored = ~$1.50/month
  - Downloads: **$0** (zero egress fees)

## Local development
```bash
npm install
cp .env.example .env.local
# Fill in .env.local with your keys
npm run dev
```
