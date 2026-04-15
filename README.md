# GoFluent Automation

Automatise les activites de langue sur GoFluent. Fait les quiz avec l'IA, gere l'audio via Whisper, supporte 5 categories et 9 types de questions.

## Setup

### 1. API Keys

| Provider | Cle `.env` | Gratuit | Usage |
|----------|-----------|---------|-------|
| [OpenRouter](https://openrouter.ai) | `OPENROUTER_API_KEY` | Non (~0.01$/activite) | IA quiz (Gemini Flash par defaut) |
| [Groq](https://console.groq.com) | `GROQ_API_KEY` | Oui | Whisper audio + fallback IA (Llama 3.3) |
| [OpenAI](https://platform.openai.com) | `OPENAI_API_KEY` | Non | Fallback IA (GPT-4o) |

**Au moins un provider requis.** Ordre de fallback automatique : OpenRouter → Groq → OpenAI. Si le premier echoue (rate limit, timeout), le suivant prend le relais.

### 2. .env

Copier `.env.example` et remplir :

```bash
cp .env.example .env
```

Les modeles sont configurables :
```env
OPENROUTER_MODEL=google/gemini-2.0-flash-001   # defaut
GROQ_MODEL=llama-3.3-70b-versatile              # defaut
OPENAI_MODEL=gpt-4o                             # defaut
WHISPER_MODEL=whisper-large-v3                   # defaut
```

### 3. Install

```bash
bun install
bunx playwright install chromium
```

## Usage

```bash
# Faire 13 activites (toutes categories)
bun run auto

# Faire N activites
bun src/index.ts --auto-run 5 --language Anglais

# Une seule activite par URL
bun src/index.ts --simple-run <URL> --language Anglais

# Seulement vocabulaire ou grammaire
bun src/index.ts --auto-run 13 --vocabulary --language Anglais
bun src/index.ts --auto-run 13 --grammar --language Anglais

# Mode debug (browser visible + logs verbeux)
bun src/index.ts --auto-run 13 --language Anglais --debug
```

### Options

| Flag | Description |
|------|-------------|
| `--auto-run <N>` | Faire N nouvelles activites |
| `--simple-run <URL>` | Faire une activite par URL |
| `--language <nom>` | Langue (defaut: Anglais) |
| `--vocabulary` | Seulement vocabulaire |
| `--grammar` | Seulement grammaire |
| `--debug` | Logs verbeux |
| `--no-headless` | Afficher le browser (defaut: invisible) |
| `--no-cache` | Ignorer le cache |
| `--minimum-level <A1-C2>` | Niveau CEFR minimum |
| `--maximum-level <A1-C2>` | Niveau CEFR maximum |

## Categories supportees

- **vocabulary** — activites vocabulaire (certaines avec audio/insertable pages)
- **grammar** — exercices de grammaire
- **article** — comprehension d'articles
- **video** — comprehension video
- **howto** — guides pratiques

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
  index.ts              CLI
  config.ts             .env
  browser/
    session.ts          Playwright + cookies persistees
    auth.ts             Login SAML + Microsoft
  core/
    Activity.ts         Modele de donnees
    ActivityLearning.ts Extraction contenu learning
    ActivitySolving.ts  Boucle quiz + retake
  questions/            9 types de questions
  services/
    ai.ts               OpenRouter (Gemini Flash)
    audio.ts            Groq Whisper (audio + video)
    cache.ts            Cache fichier des URLs faites
  navigation/           Profil, training, resources
  runners/              AutoRunner, SimpleRunner
```

## Premiere connexion

La premiere fois, le browser s'ouvre (non-headless) pour la connexion Microsoft. Si MFA est active, complete-la manuellement. La session est sauvegardee dans `data/auth/storage-state.json` pour les fois suivantes.
