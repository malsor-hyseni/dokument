# DOKUMENT

Platformë moderne për **ruajtjen, organizimin dhe menaxhimin e dokumenteve personale** —
pasaporta, patenta, kontratat, faturat, diplomat — me kategori, dosje, etiketa, kërkim të
shpejtë dhe njoftime para se dokumentet të skadojnë.

Ndërtuar me **HTML5, Tailwind CSS, CSS3 dhe JavaScript vanilla** (pa React, Vue apo
framework-e të tjera), mbi **Supabase** (PostgreSQL + Authentication + Storage), e gatshme
për publikim në **Vercel**.

---

## Përmbajtja

1. [Çfarë përmban](#çfarë-përmban)
2. [Instalimi — hap pas hapi](#instalimi--hap-pas-hapi)
3. [Publikimi në Vercel](#publikimi-në-vercel)
4. [Struktura e projektit](#struktura-e-projektit)
5. [Databaza dhe siguria](#databaza-dhe-siguria)
6. [Zhvillimi lokal](#zhvillimi-lokal)
7. [Zgjidhja e problemeve](#zgjidhja-e-problemeve)

---

## Çfarë përmban

### Llogaria
- Regjistrim me email dhe fjalëkalim, me konfirmim email-i
- Kyçje, çkyçje, çkyçje nga të gjitha pajisjet
- Rikuperim dhe ndryshim i fjalëkalimit, ndryshim i email-it
- Profil me fotografi, emër dhe telefon

### Dokumentet
- Ngarkim me zvarritje (drag & drop) ose zgjedhje skedari — PDF, imazhe, Word, Excel,
  PowerPoint, tekst, CSV dhe ZIP, deri në **50 MB**
- Titull, përshkrim, kategori, dosje, etiketa, datë lëshimi dhe datë skadimi
- Parashikim brenda aplikacionit për PDF, imazhe dhe tekst
- Shkarkim, redaktim, zëvendësim i skedarit, arkivim dhe fshirje
- Të preferuarat, veprime në grup (zhvendosje dhe fshirje e shumë dokumenteve njëherësh)

### Organizimi
- **Kategori** me ngjyrë, ikonë dhe përshkrim (8 krijohen automatikisht me llogarinë)
- **Dosje hierarkike** me nën-dosje deri në 24 nivele, me mbrojtje nga ciklet
- **Etiketa** të lira me ngjyrë, të krijueshme direkt gjatë ngarkimit

### Kërkimi dhe filtrimi
- Kërkim full-text në titull, përshkrim dhe emër skedari, i pandjeshëm ndaj diakritikave
  (kërkimi për `republikes` gjen `Republikës`)
- Filtra: status (në fuqi / po skadon / i skaduar / pa skadim / i preferuar / arkiv),
  kategori, dosje, etiketë
- 8 mënyra renditjeje, faqezim, pamje tabelë ose rrjet

### Dashboard dhe njoftime
- Statistika: numri i dokumenteve, hapësira e shfrytëzuar, sa skadojnë së shpejti, sa kanë
  skaduar, shtesat e muajit
- Ndarja sipas kategorive, grafiku i 6 muajve të fundit, historiku i aktivitetit
- Njoftime automatike për dokumentet që skadojnë brenda afatit që caktoni (1–365 ditë)

### Dizajni
- Light Mode dhe Dark Mode, me ndjekje të cilësimit të sistemit
- Ikona [Lucide](https://lucide.dev) të integruara lokalisht (pa varësi CDN)
- Ndërfaqe plotësisht responsive, shkurtesa tastiere (`⌘K`, `/`, `N`, `Esc`)
- E gjithë ndërfaqja në gjuhën shqipe, përfshirë mesazhet e gabimeve

---

## Instalimi — hap pas hapi

### 1. Krijoni projektin në Supabase

1. Hyni te [supabase.com](https://supabase.com) → **New project**
2. Zgjidhni emrin, fjalëkalimin e databazës dhe rajonin (p.sh. *Frankfurt* për Evropën)
3. Prisni derisa projekti të jetë gati (1–2 minuta)

### 2. Ekzekutoni skemën e databazës

1. Në Supabase hapni **SQL Editor** → **New query**
2. Hapni skedarin [`supabase/schema.sql`](supabase/schema.sql), kopjoni gjithë përmbajtjen
   dhe ngjiteni në editor
3. Shtypni **Run**

Skripti krijon tabelat, indekset, trigger-at, funksionet, politikat **Row Level Security**
dhe të dy bucket-at e Storage. Mund të ekzekutohet disa herë pa probleme (është idempotent).

> Skedari [`supabase/storage.sql`](supabase/storage.sql) përmban vetëm pjesën e Storage dhe
> është i përfshirë tashmë në `schema.sql`. Përdoreni veçmas vetëm nëse doni të riaplikoni
> konfigurimin e Storage.

**Verifikimi:** te **Table Editor** duhet të shihni tabelat `profiles`, `categories`,
`folders`, `tags`, `documents`, `document_tags`, `notifications`, `activity_log`.
Te **Storage** duhet të shihni bucket-at `documents` (privat) dhe `avatars` (publik).

### 3. Vendosni kredencialet

Te Supabase: **Project Settings → API**. Kopjoni:

| Fusha në Supabase | Ku shkon |
|---|---|
| **Project URL** | `SUPABASE_URL` |
| **anon** / **public** key | `SUPABASE_ANON_KEY` |

Hapni `assets/js/env.js` dhe plotësojeni:

```js
window.DOKUMENT_ENV = {
  SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

> ⚠️ **Mos përdorni kurrë çelësin `service_role`.** Ai anashkalon Row Level Security dhe
> jep qasje të plotë në të dhënat e të gjithë përdoruesve. DOKUMENT nuk ka nevojë për të.
> Çelësi `anon` është i dizajnuar për frontend dhe mbrohet nga RLS.

### 4. Konfiguroni autentikimin (opsionale, por e rekomanduar)

Te **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` gjatë zhvillimit, ose adresa juaj e Vercel
- **Redirect URLs**: shtoni
  - `http://localhost:3000/app.html`
  - `http://localhost:3000/reset-password.html`
  - `https://PROJEKTI-JUAJ.vercel.app/app.html`
  - `https://PROJEKTI-JUAJ.vercel.app/reset-password.html`

Nëse doni të testoni pa konfirmim email-i, te **Authentication → Sign In / Providers →
Email** çaktivizoni përkohësisht *Confirm email*.

### 5. Hapeni aplikacionin

```bash
npm install     # vetëm për Tailwind (nuk është i domosdoshëm — CSS-i vjen i ndërtuar)
npm run dev     # http://localhost:3000
```

Ose hapeni me çdo server statik, p.sh.:

```bash
python3 -m http.server 3000
```

> Hapja direkte e `index.html` me protokollin `file://` nuk funksionon, sepse shfletuesit
> i bllokojnë modulet ES nga skedarët lokalë. Përdorni gjithmonë një server.

---

## Publikimi në Vercel

### Me ndërfaqen e Vercel

1. Ngarkoni projektin në GitHub
2. Te [vercel.com](https://vercel.com) → **Add New → Project** → zgjidhni repo-n
3. **Framework Preset**: `Other` (`vercel.json` e konfiguron vetë build-in)
4. Te **Environment Variables** shtoni:

   | Emri | Vlera |
   |---|---|
   | `SUPABASE_URL` | URL-ja e projektit tuaj |
   | `SUPABASE_ANON_KEY` | Çelësi publik `anon` |

5. **Deploy**

Gjatë build-it, `scripts/build-config.mjs` gjeneron `assets/js/env.js` nga variablat e
ambientit dhe Tailwind rindërton CSS-in. Prandaj `assets/js/env.js` është në `.gitignore` —
kredencialet nuk përfundojnë kurrë në repo.

### Me Vercel CLI

```bash
npm i -g vercel
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel --prod
```

### Pas publikimit

Kthehuni te Supabase → **Authentication → URL Configuration** dhe shtoni adresën e re te
*Site URL* dhe *Redirect URLs*, përndryshe lidhjet e konfirmimit dhe të rikuperimit të
fjalëkalimit do të çojnë te adresa e gabuar.

---

## Struktura e projektit

```
dokument/
├── index.html                  Faqja hyrëse
├── login.html                  Kyçja
├── register.html               Regjistrimi
├── forgot-password.html        Kërkesa për rikuperim fjalëkalimi
├── reset-password.html         Vendosja e fjalëkalimit të ri
├── app.html                    Aplikacioni (shell + pamjet)
├── 404.html
│
├── assets/
│   ├── css/
│   │   ├── tailwind.css        Burimi: variablat, komponentët, tema
│   │   └── app.css             CSS-i i ndërtuar (mos e editoni)
│   ├── img/favicon.svg
│   └── js/
│       ├── env.js              ← KREDENCIALET TUAJA
│       ├── env.example.js      Shembull
│       ├── config.js           Konstantet e aplikacionit
│       ├── supabase.js         Klienti i Supabase
│       ├── api.js              Shtresa e të dhënave (çdo thirrje kalon këtu)
│       ├── store.js            Gjendja e përbashkët
│       ├── routing.js          Routing me hash
│       ├── ui.js               Tema, toast, modale, dropdown
│       ├── pickers.js          Zgjedhësit e ngjyrës dhe ikonës
│       ├── icons.js            120 ikona Lucide inline
│       ├── utils.js            Formatime, data, validime, përkthim gabimesh
│       ├── auth.js             Logjika e faqeve të autentikimit
│       ├── landing.js          Faqja hyrëse
│       ├── documents-ui.js     Modalet e dokumenteve
│       ├── app.js              Shell-i dhe router-i
│       └── pages/
│           ├── dashboard.js
│           ├── documents.js
│           ├── folders.js
│           ├── categories.js
│           ├── tags.js
│           └── settings.js
│
├── supabase/
│   ├── schema.sql              Skema e plotë: tabela, RLS, funksione, Storage
│   └── storage.sql             Vetëm konfigurimi i Storage
│
├── scripts/
│   ├── build-config.mjs        Gjeneron env.js nga variablat e ambientit
│   └── dev-server.mjs          Server statik për zhvillim
│
├── .env.example
├── vercel.json
├── tailwind.config.js
└── package.json
```

---

## Databaza dhe siguria

### Tabelat

| Tabela | Përmbajtja |
|---|---|
| `profiles` | Profili dhe cilësimet personale (1:1 me `auth.users`) |
| `categories` | Kategoritë e dokumenteve, unike për përdorues |
| `folders` | Dosjet hierarkike me `parent_id` |
| `tags` | Etiketat e lira |
| `documents` | Dokumentet me metadata dhe `search_vector` |
| `document_tags` | Relacioni shumë-me-shumë dokument ↔ etiketë |
| `notifications` | Njoftimet për skadim |
| `activity_log` | Historiku i veprimeve |

### Funksionet RPC

| Funksioni | Përdorimi |
|---|---|
| `get_dashboard_stats()` | Të gjitha statistikat e dashboard-it në një thirrje |
| `search_documents(...)` | Kërkim me filtra, renditje dhe faqezim |
| `get_folder_tree()` | Pema e dosjeve me thellësi dhe numër dokumentesh |
| `sync_expiry_notifications()` | Gjeneron njoftimet për dokumentet që skadojnë |
| `delete_all_my_data()` | Fshin të gjitha të dhënat e përdoruesit |

### Row Level Security

Të tetë tabelat kanë RLS të aktivizuar, me politika të ndara për `SELECT`, `INSERT`,
`UPDATE` dhe `DELETE`, të gjitha të lidhura me `auth.uid()`. Roli `anon` nuk ka asnjë të
drejtë mbi të dhënat — vetëm përdoruesit e autentikuar.

Politika e `documents` shkon një hap më tutje: kontrollon që `storage_path` të fillojë me
id-në e përdoruesit dhe që kategoria e dosja e caktuar t'i përkasin po atij përdoruesi.

### Storage

Bucket-i `documents` është **privat**. Struktura e rrugës:

```
{user_id}/{document_id}/{emri_i_skedarit}
```

Politikat lejojnë lexim, shkrim dhe fshirje vetëm brenda dosjes që ka si emër id-në e
përdoruesit. Shikimi dhe shkarkimi bëhen me **URL të nënshkruara** me afat 10 minuta.

### Integriteti i të dhënave

- Trigger-at pastrojnë njoftimet e vjetruara kur ndryshon data e skadimit
- Një trigger parandalon ciklet në hierarkinë e dosjeve
- Një trigger siguron që etiketa dhe dokumenti t'i përkasin të njëjtit përdorues
- Nëse ruajtja e një dokumenti dështon pasi skedari është ngarkuar, skedari fshihet
  automatikisht nga Storage — pa mbeturina

---

## Zhvillimi lokal

```bash
npm install          # varësitë (vetëm Tailwind)
npm run dev          # server në http://localhost:3000
npm run css:watch    # rindërton CSS-in automatikisht gjatë punës
npm run build        # gjeneron env.js + CSS-in e minifikuar (si në Vercel)
```

Pas çdo ndryshimi në klasat Tailwind brenda `.html` ose `.js`, ekzekutoni `npm run css`
(ose mbani `npm run css:watch` në një terminal të dytë).

---

## Zgjidhja e problemeve

| Problemi | Zgjidhja |
|---|---|
| Shfaqet ekrani *"Konfigurimi nuk ka përfunduar"* | Kredencialet mungojnë te `assets/js/env.js`, ose variablat e ambientit nuk janë vendosur në Vercel |
| *"Bucket-i documents nuk ekziston"* | Ekzekutoni `supabase/schema.sql` ose `supabase/storage.sql` |
| *"Struktura e databazës mungon"* | Skema nuk është ekzekutuar — hapi 2 i instalimit |
| Pas regjistrimit nuk vjen email-i | Kontrolloni *Spam*; ose çaktivizoni *Confirm email* te Authentication → Providers → Email |
| Lidhja e rikuperimit çon te adresa e gabuar | Shtoni *Redirect URLs* te Authentication → URL Configuration |
| Ngarkimi dështon me *"Ky lloj skedari nuk lejohet"* | Lloji MIME nuk është në listën e lejuar — shtojeni te `allowed_mime_types` në `schema.sql` dhe te `ALLOWED_MIME` në `assets/js/config.js` |
| Stilet duken të prishura pas ndryshimeve | Ekzekutoni `npm run css` |
| Faqja është bosh kur hapet me `file://` | Përdorni një server (`npm run dev`) — modulet ES nuk ngarkohen nga `file://` |

---

## Teknologjitë

HTML5 · Tailwind CSS 3 · CSS3 · JavaScript (ES modules, vanilla) ·
Supabase (PostgreSQL 15+, Auth, Storage) · Vercel · Ikona Lucide (ISC)

Pa framework-e frontend. E vetmja varësi gjatë ekzekutimit është klienti zyrtar
`@supabase/supabase-js`, i ngarkuar si modul ES.
