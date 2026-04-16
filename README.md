# GoFluent Automation

Automatise les activites de langue sur GoFluent via leur API HTTP. Score 100% garanti, aucune IA, aucun scraping DOM. Playwright sert uniquement a l'authentification initiale (SAML + Microsoft MFA).

## Setup

```bash
bun install                  # deps + Chromium pour l'auth
cp .env.example .env         # remplir les credentials
bun run auto                 # lancer
```

### .env minimum

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
| `--auto-run <N>` | Faire N nouvelles activites (defaut 13, voir `GOFLUENT_MONTHLY_TARGET`) |
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
| `--no-headless` | Afficher la fenetre du browser a l'auth (utile pour debug MFA) |
| `--profile <nom>` | Profil de credentials (voir ci-dessous) |
| `--debug` | Logs verbeux (GET/POST, states) |

## Multi-comptes avec `--profile`

Tu peux stocker plusieurs jeux de credentials dans le meme `.env` en suffixant les variables avec `__NOM` (nom en MAJUSCULES). Puis tu passes `--profile nom` au CLI.

```env
# .env — compte perso
GOFLUENT_USERNAME=perso@x.com
GOFLUENT_PASSWORD=...
GOFLUENT_DOMAIN=esaip

# compte boulot
GOFLUENT_USERNAME__WORK=work@x.com
GOFLUENT_PASSWORD__WORK=...
GOFLUENT_DOMAIN__WORK=work-domain
```

```bash
bun src/index.ts --report                  # compte par defaut
bun src/index.ts --profile work --report   # compte boulot
```

Chaque profil a son propre token cache (la session n'est pas partagee).

## Variables d'environnement optionnelles

Surchargent les chemins et defauts sans toucher au code :

| Variable | Defaut | Description |
|----------|--------|-------------|
| `GOFLUENT_DATA_DIR` | `./data` | Dossier des artefacts (`session.json`, `cache.txt`) |
| `GOFLUENT_LOGS_DIR` | `./logs` | Dossier des logs timestampes |
| `GOFLUENT_MONTHLY_TARGET` | `13` | Objectif mensuel utilise par `bun run auto` quand aucun `--auto-run N` n'est passe |
| `GOFLUENT_LANGUAGE` | `Anglais` | Langue par defaut quand aucun `--language <nom>` n'est passe |

Exemple :

```bash
GOFLUENT_DATA_DIR=/var/gofluent/data \
GOFLUENT_LOGS_DIR=/var/log/gofluent \
GOFLUENT_MONTHLY_TARGET=20 \
  bun run auto
```

## Fonctionnement

L'app parle directement aux endpoints API de GoFluent — pas de browser apres l'auth. Les quiz sont resolus en envoyant `isCorrect: true, score: 1` avec les `solutions` extraites du JSON que le serveur renvoie lui-meme.

- **Score** : 100% garanti
- **Vitesse** : ~1.5s par activite, ~20s pour 13
- **Startup** : <1s apres le premier login (cache JWT)
- **Pas de scraping** : discovery, report, quiz — tout en HTTP pur

### Flow

1. **Auth** (premier run, ~10s) : Playwright headless ouvre la page de login, rempli email + password automatiquement, affiche le code MFA dans le terminal pour validation sur ton tel, capture le Bearer token dans les headers
2. **Session cache** : token + userId + exp + cookies/localStorage Playwright fusionnes dans `data/session.json` → prochains runs sans Playwright (et re-auth silencieuse sans MFA tant que les cookies sont valides)
3. **Training report** (`GET /api/v1/report/learner/{userId}/activities`) : historique complet (jusqu'a 2 ans)
4. **Discovery** (`POST /api/v1/content-service/content/search`) : toutes les activites par categorie, paginees, filtrage CEFR serveur-side
5. **Quiz solving** par activite :
   - `GET /content-service/content/{uuid}` -> extrait quizRef
   - `GET /content-service/quiz/legacy/{quizRef}` -> JSON avec questions + solutions
   - `POST /quiz-state/quiz/` -> stateId
   - `POST /quiz-state/quiz/state/{stateId}/answer` par question (N fois)
   - Score final recupere via `/quiz-state/quiz/state/quiz/{quizId}`

Invalidation auto du token cache si l'API retourne 401/403. Retry exponentiel sur 429 et 5xx (3 tentatives).

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

Sans flag = toutes les categories en rotation (3 activites par categorie avant de passer a la suivante).

## Types de questions

Distribution observee sur 94 quiz / 634 questions verifiees a 100% :

| Type API | Sous-types observes | Extraction |
|----------|---------------------|------------|
| MULTIPLE_CHOICE | TEXT_CHOICES, AUDIO_CHOICES, PICTURE_CHOICES_LANDSCAPE | `q.solutions` direct |
| TRUE_OR_FALSE | TRUE_OR_FALSE | `q.solutions` direct |
| FILL_IN_THE_GAP | FITG_TEXT_BLOCKS, FITG_TEXT_INPUTS | `q.receivers[].solutions` |
| SCRAMBLED_LETTERS | — | `q.receivers[].solutions` |
| SCRAMBLED_SENTENCE | — | `q.receivers[].solutions` |
| SHORT_ANSWER | — | `q.receivers[].solutions` |

Le flow est type-agnostic : `q.solutions ?? q.receivers?.flatMap(r => r.solutions)` + `isCorrect: true, score: 1` pour chaque reponse. Tant que le JSON expose les solutions via un de ces deux chemins, n'importe quel type (y compris ceux non listes ci-dessus) est resolu sans code specifique. Si le quiz echoue sous 80%, retake automatique (max 3 tentatives).

## Tests

```bash
bun run typecheck    # tsc --noEmit
bun test             # suite unitaire (~90 tests, <200ms, zero reseau)
```

La suite couvre les parseurs (dates, JWT, UUID), les mappers, le cache fichiers, le retry policy, la resolution de paths et le formatter de rapport. Les flows live (auth browser, quiz solving contre l'API) sont verifies a la main avec `bun run report` / `bun src/index.ts --auto-run 1 --debug`.

## FAQ / depannage

**Token expire / 401** — Le cache est efface automatiquement, il suffit de relancer. Si MFA requis, la page s'ouvre (headless) et le code s'affiche en terminal.

**Pas d'activites fraiches** — Le fichier `data/cache.txt` liste les URLs deja faites pour eviter de les refaire. Si l'app dit `Stopped at X/N (no more fresh activities)`, soit supprime `data/cache.txt`, soit lance avec `--no-cache`.

**Je veux voir ce que fait le browser** — `bun src/index.ts --auto-run 1 --no-headless`. Une fenetre Chrome/Edge s'ouvre pour l'auth.

**Logs detailles** — chaque run cree `logs/<timestamp>/run.log` avec tous les GET/POST et les transitions d'etat d'auth. Jette un oeil la-dedans si quelque chose va de travers.

**Playwright ne lance pas le browser (Fedora/Linux)** — Chrome doit etre installe au niveau systeme (`dnf install google-chrome-stable` ou equivalent), sinon Playwright fallback sur son Chromium bundled (installe via `bunx playwright install chromium`, qui tourne au premier `bun install`).

## Premiere connexion

Aucune fenetre browser — tout en terminal. Le code MFA s'affiche en jaune, tu valides sur ton phone, c'est parti. Les connexions suivantes reutilisent le JWT cache (<1s startup).
