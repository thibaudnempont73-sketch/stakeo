# Stakeo

**Your bankroll, mastered.** Gestionnaire de bankroll intelligent pour parieurs sportifs.

PWA React + TypeScript, installable sur mobile, données locales (aucun compte requis).

## Lancer l'app

```bash
npm install
npm run dev        # développement → http://localhost:5173
npm run build      # build de production → dist/
npm run preview    # tester le build de production
```

## Fonctionnalités

- **Scan de ticket par IA** : photo/capture d'un ticket → le pari est extrait et pré-rempli automatiquement (Gemini 2.5 Flash-Lite, vision + sortie JSON). Sur Android, partage direct depuis l'app du bookmaker via le menu Partager (PWA installée) ; sur iPhone, via une capture d'écran (Apple n'autorise pas les PWA comme cible de partage)
- **Règlement automatique** : le bouton « Vérifier les résultats » cherche les scores finaux sur le web (Gemini 2.5 Flash + Google Search) et règle les paris gagnés/perdus tout seul — les résultats incertains restent en cours
- Ces fonctions IA demandent une clé API Gemini gratuite (Réglages → IA, aistudio.google.com), stockée uniquement sur l'appareil. Appel direct depuis le navigateur (CORS OK), aucun serveur requis
- **Multi-bankrolls** avec devises différentes (EUR, GBP, USD, CHF, PLN…), dépôts et retraits
- **Saisie express** de paris : simples, **combinés** (sélections multiples, cote totale auto), paris **live**, **cash out**, moitié gagné/perdu, annulé
- **Tableau de bord** : solde, courbe d'évolution interactive, bénéfice, yield, ROI, taux de réussite, cote/mise moyennes, séries, drawdown max, filtres 7J/30J/90J/tout
- **Plans de mise** : mise fixe, % de la bankroll, critère de **Kelly** fractionné (avec probabilité estimée par pari)
- **Discipline** : alerte tilt (défaites consécutives + mises croissantes), stop-loss journalier
- **Analyses** : bénéfice mensuel + rentabilité par sport, bookmaker, marché, tranche de cotes, type de pari, jour de la semaine, tipster
- **6 langues** : français, English, español, Deutsch, italiano, português
- **Formats de cotes** : décimal, américain, fractionnaire
- **Thèmes** sombre et clair
- **Données** : export/import JSON, export CSV, stockage local (localStorage)

## Structure

```
src/
  types.ts            Modèle de données (paris, bankrolls, transactions, réglages)
  store.ts            État global persisté (zustand) + export JSON/CSV
  hooks.ts            Navigation, bankroll active, constantes (sports, bookmakers)
  i18n/               Traductions (en = référence, fr, es, de, it, pt)
  lib/
    stats.ts          Bénéfice, yield, ROI, séries, drawdown, groupements
    staking.ts        Kelly, mise conseillée
    format.ts         Monnaie, cotes, dates (Intl)
    ai.ts             Scan de ticket (vision) + vérification de résultats (Google Search), API Gemini via fetch
  components/         Icônes, UI (modales, cartes, badges), graphiques SVG, formulaire de pari
  pages/              Dashboard, Bets, Analytics, Settings, Onboarding
public/
  manifest.webmanifest, sw.js, icon.svg   (PWA installable + offline)
```

## Note

Stakeo est un outil de suivi. Il ne prend pas de paris et ne donne aucun conseil de pari.
Jouez de manière responsable.
