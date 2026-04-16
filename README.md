# GoFluent Automation

Automatise les activites de langue sur GoFluent via leur API HTTP. Score 100% garanti, aucune IA, aucun scraping DOM. Playwright sert uniquement a l'authentification initiale (SAML + Microsoft MFA).

## Setup

```bash
bun install                  # deps + Chromium pour l'auth
cp .env.example .env         # remplir les credentials
bun run auto                 # lancer
```

### .env

```env
GOFLUENT_USERNAME=ton.email@esaip.org
GOFLUENT_PASSWORD=ton_mot_de_passe_microsoft
GOFLUENT_DOMAIN=esaip
```

## Usage

```bash
bun run auto                                           # 13 activites toutes categories (defaut)
bun src/index.ts --auto-run 5                          # N activites
bun src/index.ts --auto-run 13 --vocabulary --grammar  # categories choisies
bun src/index.ts --simple-run <URL ou UUID>            # une seule activite
bun run report                                         # rapport de formation
bun src/index.ts --auto-run 13 --debug                 # logs verbeux
```

### Options

| Flag | Description |
|------|-------------|
| `--auto-run <N>` | Faire N nouvelles activites (defaut 13) |
| `--simple-run <URL\|UUID>` | Faire une activite precise |
| `--report` | Rapport de formation (scores, stats, historique) |
| `--vocabulary` | Categorie vocabulaire |
| `--grammar` | Categorie grammaire |
| `--article` | Categorie articles |
| `--video` | Categorie videos |
| `--howto` | Categorie guides pratiques |
| `--language <nom>` | Langue (defaut: Anglais) |
| `--minimum-level <A1-C2>` | Niveau CEFR minimum |
| `--maximum-level <A1-C2>` | Niveau CEFR maximum |
| `--no-cache` | Ignorer le cache d'URLs deja faites |
| `--profile <nom>` | Profil de credentials (suffixe `__NOM` dans .env) |
| `--debug` | Logs verbeux (GET/POST, states) |

## Fonctionnement

L'app parle directement aux endpoints API de GoFluent — pas de browser apres l'auth. Les quiz sont resolus en envoyant `isCorrect: true, score: 1` avec les `solutions` extraites du JSON que le serveur renvoie lui-meme.

- **Score** : 100% garanti
- **Vitesse** : ~1.5s par activite, ~20s pour 13
- **Startup** : <1s apres le premier login (cache JWT)
- **Pas de scraping** : discovery, report, quiz — tout en HTTP pur

### Flow

1. **Auth** (premier run, ~10s) : Playwright headless ouvre la page de login, rempli email + password automatiquement, affiche le code MFA dans le terminal pour validation sur ton tel, capture le Bearer token dans les headers
2. **Cache JWT** : token + exp sauve dans `data/auth/token.json` → prochains runs sans Playwright
3. **Training report** (`GET /api/v1/report/learner/{userId}/activities`) : historique complet (jusqu'a 2 ans)
4. **Discovery** (`POST /api/v1/content-service/content/search`) : toutes les activites par categorie, paginees, filtrage CEFR serveur-side
5. **Quiz solving** par activite :
   - `GET /content-service/content/{uuid}` -> extrait quizRef
   - `GET /content-service/quiz/legacy/{quizRef}` -> JSON avec questions + solutions
   - `POST /quiz-state/quiz/` -> stateId
   - `POST /quiz-state/quiz/state/{stateId}/answer` par question (N fois)
   - Score final recupere via `/quiz-state/quiz/state/quiz/{quizId}`

Invalidation auto du token cache si l'API retourne 401/403.

## Authentification en terminal

Premiere connexion :

```
→ Opening headless browser for first login…
→ Submitting SAML domain…
→ Entering email…
→ Entering password…

  MFA  Tap this number in your Authenticator app:  86
  (waiting for your approval…)

✓ Signed in (user: 91a82e46)
```

Aucune fenetre ne s'ouvre. Le code MFA est scrape depuis la page Microsoft (`#idRichContext_DisplaySign`) et affiche en gros dans le terminal. Tu tape le meme chiffre dans ton Authenticator -> le token est capture, sauve, browser ferme.

Runs suivants : `✓ Session reused (user: ...)` en <1s, pas de Playwright.

Le browser utilise le Chrome/Edge installe sur ton systeme via `channel: 'chrome'` (fallback Chromium bundled).

## Categories

| Categorie | Flag | targetType API |
|-----------|------|----------------|
| vocabulary | `--vocabulary` | `glossary` |
| grammar | `--grammar` | `rules` |
| article | `--article` | `article` |
| video | `--video` | `video` |
| howto | `--howto` | `practical-guide` |

Sans flag = toutes les categories en rotation (`BATCH_SIZE=3` activites par categorie avant de passer a la suivante).

## Types de questions (verifies a 100%)

| Type API | Extraction des solutions |
|----------|--------------------------|
| MULTIPLE_CHOICE / TEXT_CHOICES | `q.solutions` direct |
| TRUE_OR_FALSE (2 sous-types) | `q.solutions` direct |
| FILL_IN_THE_GAP / FITG_TEXT_BLOCKS | `q.receivers[].solutions` |
| MATCHING_TYPE | `q.receivers[].solutions` |
| SCRAMBLED_SENTENCE | `q.receivers[].solutions` |
| SCRAMBLED_LETTERS | `q.receivers[].solutions` |

Le flow est type-agnostic : `q.solutions ?? q.receivers?.flatMap(r => r.solutions)` + `isCorrect: true, score: 1` pour chaque reponse.

## Architecture

```
src/
  index.ts              CLI (commander)
  config.ts             .env + siteBase
  types.ts              CLIOptions, CEFR, categories, ActivityInfo
  logger.ts             Logger colore + fichier
  auth.ts               Playwright headless + MFA terminal + cache JWT
  api.ts                Fetch wrapper (GET/POST, invalide cache sur 401)
  cache.ts              data/cache.txt
  services/
    topic.ts            Resolution langue -> topicUuid
    training.ts         /report/learner/activities
    discovery.ts        /content-service/content/search paginated
    quiz.ts             Load + solve + retake
  runners/
    AutoRunner.ts       Rotation categories, BATCH_SIZE=3
    SimpleRunner.ts     Une activite par URL/UUID
    ReportRunner.ts     Stats + distribution + historique

data/
  auth/
    storage-state.json  Cookies/localStorage Playwright (pour re-auth quand JWT expire)
    token.json          JWT + userId + exp (cache lu en priorite)
  cache.txt             URLs deja faites (une par ligne)
```

## Premiere connexion

Aucune fenetre browser — tout en terminal. Le code MFA s'affiche en jaune, tu valides sur ton phone, c'est parti. Les connexions suivantes reutilisent le JWT cache (<1s startup).
