# ♟️ Tempête sur l'échiquier

Un **quizz de tactique aux échecs façon Kahoot**, pensé pour le cours : le professeur projette une position à l'écran, les élèves résolvent le problème sur leur téléphone, et les points pleuvent selon la rapidité et la justesse.

> Application web construite avec **Next.js 16** (App Router) et **Prisma 7**. Base **SQLite** en local, prête à passer sur **Postgres** au déploiement.

---

## ✨ Fonctionnalités

- **Sessions en direct façon Kahoot** — le prof lance une séance, un code et un QR code s'affichent au tableau, les élèves rejoignent en un scan.
- **Problèmes de tactique interactifs** — l'élève joue le coup directement sur un échiquier (glisser-déposer ou tap-tap sur mobile), l'adversaire répond automatiquement.
- **Score à la Kahoot** — 500 points de base + un bonus de rapidité jusqu'à 500 points.
- **Bibliothèque de problèmes** — filtres par thème (mat en 2, fourchette, clouage…) et par difficulté, tirage aléatoire, import en masse.
- **Import Lichess & PGN** — import du format CSV des puzzles Lichess ou extraction de positions depuis un PGN.
- **🆕 Échiquier libre** (`/tableau`) — un tableau d'analyse pour la classe :
  - **mode Analyse** : on déplace les pièces par coups légaux (les deux camps) pour montrer une variante en direct ;
  - **mode Édition** : une palette « clic pour poser » permet de composer **n'importe quelle position** (même illégale, utile pédagogiquement) ;
  - chargement / copie de **FEN**, retournement de l'échiquier, annulation des coups, retour à la position de départ.

---

## 🧭 Comment ça marche

| Rôle | Parcours |
| --- | --- |
| **Professeur** | Page d'accueil → choisit des problèmes (ou tirage aléatoire) → **Lancer une session** → la page **Écran** (`/ecran/[code]`) s'affiche au vidéoprojecteur avec le QR code. |
| **Élève** | Scanne le QR (ou ouvre `/jouer/[code]`) → entre son prénom → résout chaque problème sur l'échiquier de son téléphone. |
| **Tableau libre** | Bouton **♟️ Échiquier libre** → démontre une idée, une combinaison ou une finale en bougeant les pièces en direct. |

Déroulé d'une séance : `lobby` → `question` → `reveal` → … → `finished`.

---

## 🚀 Démarrage

Prérequis : **Node.js 20+** et une base **PostgreSQL** (locale ou cloud, ex. [Neon](https://neon.tech)).

```bash
# 1. Installer les dépendances (génère aussi le client Prisma)
npm install

# 2. Renseigner la connexion Postgres dans .env (voir ci-dessous)

# 3. Créer les tables à partir du schéma
npm run db:push

# 4. (optionnel) Importer des problèmes de démonstration
npm run db:seed

# 5. Lancer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

La variable d'environnement attendue (fichier `.env`, ignoré par Git) :

```bash
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
```

---

## 📜 Scripts npm

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (Turbopack). |
| `npm run build` | Build de production. |
| `npm run start` | Serveur de production. |
| `npm run lint` | ESLint. |
| `npm run db:push` | Applique le schéma Prisma à la base. |
| `npm run db:seed` | Remplit la base avec des problèmes. |

Import des puzzles Lichess depuis un CSV :

```bash
npx tsx scripts/import-lichess.ts <chemin/vers/lichess_puzzles.csv>
```

---

## 🗂️ Structure du projet

```
src/
├── app/
│   ├── page.tsx                 # Accueil : bibliothèque + création de session
│   ├── tableau/                 # 🆕 Échiquier libre (analyse + édition)
│   ├── import/                  # Import Lichess / PGN
│   ├── ecran/[code]/            # Vue projetée (prof) : QR code, classement
│   ├── jouer/[code]/            # Vue élève : on résout le problème
│   └── api/                     # Routes API (puzzles, sessions, réponses…)
├── components/
│   ├── FreeBoard.tsx            # 🆕 Échiquier libre
│   ├── QuizBoard.tsx            # Échiquier interactif (élève)
│   ├── StaticBoard.tsx          # Échiquier d'affichage (aperçus, projecteur)
│   ├── PuzzleLibrary.tsx        # Bibliothèque + filtres
│   ├── PlayView.tsx / ScreenView.tsx
│   └── ImportTabs.tsx / PuzzleLibrary…
└── lib/
    ├── chess-utils.ts           # FEN, UCI/SAN, parsing Lichess & PGN, scores
    ├── themes.ts                # Libellés français des thèmes Lichess
    ├── db.ts                    # Client Prisma
    └── types.ts
```

**Stack :** Next.js 16 · React 19 · Prisma 7 · [chess.js](https://github.com/jhlywa/chess.js) (règles) · [react-chessboard](https://github.com/Clariity/react-chessboard) v5 (échiquier) · Tailwind CSS 4 · `qrcode.react`.

---

## ☁️ Déploiement

L'application utilise **PostgreSQL** via Prisma 7 et l'adaptateur [`@prisma/adapter-pg`](https://www.npmjs.com/package/@prisma/adapter-pg) (connexion au runtime dans `src/lib/db.ts`). Pour déployer sur **Vercel** :

1. Provisionnez une base Postgres (Neon, Prisma Postgres…) — via le Marketplace Vercel ou directement.
2. Dans le projet Vercel, ajoutez la variable d'environnement **`DATABASE_URL`** (la même chaîne de connexion que votre `.env`).
3. Créez les tables : `npm run db:push` (en local, pointé sur la base de prod) ou une migration Prisma.
4. (optionnel) Remplissez la base : `npm run db:seed`.
5. Déployez.

> Astuce : pour les connexions poolées (Neon `-pooler`), `sslmode=require` est attendu dans l'URL.

> Rappel : `.env*`, `dev.db`, `ruvector.db` et `.claude-flow/` sont volontairement exclus du dépôt via `.gitignore`.
