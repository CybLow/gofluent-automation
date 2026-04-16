# GoFluent Automation

Automatise les activites de langue sur GoFluent. Intercepte les reponses API pour un score 100% garanti, avec fallback IA. Supporte 5 categories, 9 types de questions, transcription audio Whisper.

## Setup

### 1. Install

```bash
bun install    # installe les deps + Chromium automatiquement
cp .env.example .env
```

### 2. .env

Remplir au minimum les credentials GoFluent :

```env
GOFLUENT_USERNAME=ton.email@esaip.org
GOFLUENT_PASSWORD=ton_mot_de_passe_microsoft
GOFLUENT_DOMAIN=esaip
```

### 3. API Keys (optionnel)

Le mode par defaut intercepte les reponses API de GoFluent → **aucune cle API requise** pour un score 100%.

Les cles sont necessaires uniquement pour le mode AI fallback (`--no-api`) ou la transcription audio :

| Provider | Cle `.env` | Gratuit | Usage |
|----------|-----------|---------|-------|
| [OpenRouter](https://openrouter.ai) | `OPENROUTER_API_KEY` | Non (~0.01$/activite) | IA quiz (fallback) |
| [Groq](https://console.groq.com) | `GROQ_API_KEY` | Oui | Whisper audio + fallback IA |
| [OpenAI](https://platform.openai.com) | `OPENAI_API_KEY` | Non | Fallback IA |

Fallback automatique : OpenRouter → Groq → OpenAI.

Les modeles sont configurables :
```env
OPENROUTER_MODEL=google/gemini-2.0-flash-001
GROQ_MODEL=llama-3.3-70b-versatile
WHISPER_MODEL=whisper-large-v3
```

## Usage

```bash
# Faire 13 activites (toutes categories, mode API)
bun run auto

# Faire N activites
bun src/index.ts --auto-run 5 --language Anglais

# Choisir les categories
bun src/index.ts --auto-run 13 --vocabulary --grammar
bun src/index.ts --auto-run 13 --article --video --howto
bun src/index.ts --auto-run 13 --grammar

# Une seule activite par URL
bun src/index.ts --simple-run <URL> --language Anglais

# Rapport des scores
bun run report

# Mode AI (sans interception API)
bun src/index.ts --auto-run 13 --no-api --language Anglais

# Mode debug (logs verbeux)
bun src/index.ts --auto-run 13 --debug --language Anglais
```

### Options

| Flag | Description |
|------|-------------|
| `--auto-run <N>` | Faire N nouvelles activites |
| `--simple-run <URL>` | Faire une activite par URL |
| `--report` | Afficher le rapport de formation (scores, stats) |
| `--vocabulary` | Categorie vocabulaire |
| `--grammar` | Categorie grammaire |
| `--article` | Categorie articles |
| `--video` | Categorie videos |
| `--howto` | Categorie howto/guides |
| `--language <nom>` | Langue (defaut: Anglais) |
| `--no-api` | Desactiver l'interception API (forcer le mode IA) |
| `--no-headless` | Afficher le browser |
| `--no-cache` | Ignorer le cache |
| `--debug` | Logs verbeux |
| `--minimum-level <A1-C2>` | Niveau CEFR minimum |
| `--maximum-level <A1-C2>` | Niveau CEFR maximum |

## Fonctionnement

### Mode API (defaut)

Intercepte les reponses JSON de GoFluent qui contiennent les solutions. Score 100% garanti, pas de cle API requise, ~3 secondes par activite.

### Mode IA (`--no-api`)

Utilise l'IA (Gemini/Llama/GPT) pour repondre aux questions en analysant le contenu. Necessite une cle API. Score 80-100%. Whisper (Groq) pour la transcription audio.

### Flow

1. Connexion SAML + Microsoft (MFA supportee)
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
| howto | `--howto` | Guides pratiques (avec audio) |

Sans flag = toutes les categories en rotation.

## Types de questions (9)

1. Multi-choix texte (radio)
2. Multi-choix image
3. Multi-choix checkbox (multi-select)
4. Texte libre (textarea)
5. Trous a remplir (input)
6. Trous a remplir (blocs drag & drop)
7. Lettres melangees
8. Phrases melangees / completion
9. Association (match texte)

## Architecture

```
src/
  index.ts                 CLI (commander)
  config.ts                .env + providers
  types.ts                 Types TypeScript
  browser/
    session.ts             Playwright + session persistee
    auth.ts                Login SAML + Microsoft + MFA
  core/
    Activity.ts            Modele de donnees
    ActivityLearning.ts    Extraction contenu learning (mode IA)
    ActivitySolving.ts     Boucle quiz + retake
  questions/               9 types de questions (factory pattern)
  services/
    quiz-interceptor.ts    Interception API → reponses directes
    ai.ts                  Multi-provider IA avec fallback
    audio.ts               Whisper (Groq) transcription
    cache.ts               Cache fichier des URLs
  navigation/              Profil, training, resources, scroll
  runners/
    AutoRunner.ts          Mode auto (N activites)
    SimpleRunner.ts        Mode simple (1 URL)
    ReportRunner.ts        Rapport de formation
```

## Premiere connexion

Sur un nouveau PC, le browser s'ouvre automatiquement (non-headless) pour la premiere connexion Microsoft. Si MFA est active, complete-la dans le browser. La session est ensuite sauvegardee dans `data/auth/storage-state.json` — les connexions suivantes sont automatiques en headless.
