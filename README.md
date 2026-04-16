# GoFluent Automation

Automatise les activites de langue sur GoFluent. Intercepte les reponses API pour un score 100% garanti. Aucune IA requise.

## Setup

```bash
bun install                  # deps + Chromium
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
# Faire 13 activites (toutes categories)
bun run auto

# Faire N activites
bun src/index.ts --auto-run 5 --language Anglais

# Choisir les categories
bun src/index.ts --auto-run 13 --vocabulary --grammar
bun src/index.ts --auto-run 13 --article --video --howto

# Une seule activite par URL
bun src/index.ts --simple-run <URL> --language Anglais

# Rapport des scores
bun run report

# Mode debug (logs verbeux)
bun src/index.ts --auto-run 13 --debug
```

### Options

| Flag | Description |
|------|-------------|
| `--auto-run <N>` | Faire N nouvelles activites |
| `--simple-run <URL>` | Faire une activite par URL |
| `--report` | Rapport de formation (scores, stats) |
| `--vocabulary` | Categorie vocabulaire |
| `--grammar` | Categorie grammaire |
| `--article` | Categorie articles |
| `--video` | Categorie videos |
| `--howto` | Categorie howto/guides |
| `--language <nom>` | Langue (defaut: Anglais) |
| `--no-headless` | Afficher le browser |
| `--no-cache` | Ignorer le cache |
| `--debug` | Logs verbeux |
| `--minimum-level <A1-C2>` | Niveau CEFR minimum |
| `--maximum-level <A1-C2>` | Niveau CEFR maximum |

## Fonctionnement

Intercepte les reponses JSON de l'API GoFluent (`/content-service/quiz/`) qui contiennent les solutions. Chaque question est resolue par index — la question N du DOM correspond a la reponse N du JSON.

- **Score** : 100% garanti
- **Vitesse** : ~3 secondes par activite
- **Dependencies** : Playwright + Chromium uniquement
- **Aucune cle API** requise (pas d'IA, pas de Whisper)

### Flow

1. Connexion SAML + Microsoft (MFA supportee, browser visible la premiere fois)
2. Scan de la training page (scores, activites valides >=80%)
3. Decouverte d'activites par categorie avec rotation (3 par batch)
4. Pour chaque activite : interception API → resolution quiz → cache
5. Retake automatique si score < 80%

## Categories

| Categorie | Flag | Contenu |
|-----------|------|---------|
| vocabulary | `--vocabulary` | Vocabulaire thematique |
| grammar | `--grammar` | Exercices de grammaire |
| article | `--article` | Comprehension d'articles |
| video | `--video` | Comprehension video |
| howto | `--howto` | Guides pratiques |

Sans flag = toutes les categories en rotation.

## Types de questions (9)

Tous geres automatiquement via l'interception API :

1. Multi-choix texte
2. Multi-choix image
3. Multi-choix checkbox (multi-select)
4. Texte libre
5. Trous a remplir (input)
6. Trous a remplir (blocs drag & drop)
7. Lettres melangees
8. Phrases melangees
9. Association (match)

## Architecture

```
src/
  index.ts                 CLI
  config.ts                .env
  types.ts                 Types
  browser/
    session.ts             Playwright + session persistee
    auth.ts                Login SAML + Microsoft + MFA
  core/
    Activity.ts            Modele de donnees
    ActivitySolving.ts     Boucle quiz + retake
  questions/               9 types (factory pattern)
  services/
    quiz-interceptor.ts    Interception API → reponses directes
    cache.ts               Cache fichier des URLs
  navigation/              Profil, training, resources, scroll
  runners/
    AutoRunner.ts          Mode auto (N activites)
    SimpleRunner.ts        Mode simple (1 URL)
    ReportRunner.ts        Rapport de formation
```

## Premiere connexion

Le browser s'ouvre automatiquement (visible) la premiere fois pour le MFA Microsoft. La session est sauvegardee dans `data/auth/storage-state.json` — les connexions suivantes sont headless.
