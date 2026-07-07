# Stakeo — Plan d'action complet

> Feuille de route de référence, suivie à la lettre. Cochée au fur et à mesure.
> Objectif : l'app de bankroll n°1 en Europe — belle, simple, complète, avec **saisie et règlement automatiques**.
>
> **Modèle économique : SaaS par abonnement — 2,99 €/mois, avec un essai gratuit.**
> Accès verrouillé par un **compte avec e-mail vérifié**. Les clés API (IA, scores) sont
> **100 % côté serveur** — l'utilisateur n'en voit jamais et n'en saisit jamais.

---

## Principes d'ingénierie (les règles que je suis à chaque étape)

1. **Appels API ciblés par match** — jamais par utilisateur, jamais pour un match sans parieur. 1 appel règle tous les parieurs d'un même match.
2. **Cache permanent** — un match fini ne change plus → on ne le re-fetch jamais. Regroupement des appels par ligue/journée.
3. **Jamais deviner sur de l'argent** — filtre de confiance strict ; confiance faible → le pari reste « en cours / à confirmer », jamais réglé au hasard.
4. **Secrets → GitHub Secrets uniquement, jamais dans le navigateur ni commités.** Les vrais secrets (clé Gemini, clés API de score, `service_role`, SMTP) vivent dans **GitHub → Secrets and variables → Actions** et ne sont lus que **côté serveur** (cron GitHub Actions + Edge Functions Supabase). Le front ne reçoit que les valeurs **publiques** (URL + clé `anon` Supabase, protégées par RLS) — pas des secrets. Corollaire : tout appel utilisant un secret (Gemini, API scores) doit se faire côté serveur, jamais dans le navigateur.
5. **Offline-first** — l'app reste utilisable sans connexion (cache local + synchro).
6. **Multilingue** — 6 langues (fr, en, es, de, it, pt), tout texte passe par l'i18n.
7. **Jeu responsable + RGPD** — stop-loss, alerte tilt, limites, export/suppression des données. Données de jeu = sensibles.
8. **Positionnement « outil de suivi »** — Stakeo ne prend pas de paris et ne conseille pas de paris → hors licence de jeu.
9. **SaaS verrouillé** — pas d'accès à l'app sans compte e-mail vérifié + essai actif ou abonnement payant. Aucune clé API visible côté utilisateur.

---

## État actuel — Stakeo v0.2 (déjà construit ✅)

- PWA React 19 + Vite + TypeScript, local-first (zustand + localStorage).
- 6 langues, thèmes sombre/clair, formats de cotes (décimal/américain/fractionnaire).
- Multi-bankrolls (devises multiples), dépôts/retraits.
- Paris simples, combinés, live, cash out, moitié gagné/perdu, annulé.
- Plans de mise : fixe, % de bankroll, Kelly fractionné.
- Discipline : stop-loss journalier, alerte tilt.
- Analyses : bénéfice mensuel, rentabilité par sport/bookmaker/marché/tranche de cotes/jour/type/tipster ; courbe, ROI, yield, drawdown, séries.
- Export/import JSON, export CSV.
- **IA (Gemini 2.5)** : scan de ticket (Flash-Lite vision → JSON) + vérification de résultats (Flash + Google Search). Actuellement côté navigateur avec la clé perso de l'utilisateur.
- Web Share Target (Android) ; iPhone via capture d'écran.
- Nom **Stakeo**, logo écusson + courbe.

---

## Architecture cible

```
Front (PWA React)  →  hébergement statique (Vercel ou GitHub Pages)
        │
        ├── Auth + Base (Postgres + RLS)  →  Supabase
        │
        └── Job de règlement (cron)  →  GitHub Actions (planifié)
                    │
                    ├── Adaptateurs par sport → table `results` (cache)
                    │     MLB Stats API · NHL API · NBA stats · football-data.org
                    │     · API-Football · OpenLigaDB · ESPN · Jolpica-F1
                    │
                    └── Fallback Gemini + Google Search (caché par match/marché)

Clés API : secrets serveur (Supabase / GitHub Actions), jamais dans le navigateur.
```

**Modèle de coût** : le coût dépend uniquement du **nombre de matchs distincts pariés** (regroupés par ligue/journée, cache permanent), pas du nombre d'utilisateurs ni du nombre total de matchs.

---

## Phase 0 — Comptes & décisions (à faire par toi)

- [ ] **Créer un projet Supabase** (gratuit) → me transmettre l'URL + la clé `anon` (la clé `service_role` reste secrète, jamais dans le front). **← débloque toute la Phase 1 (auth + vérif e-mail).**
- [x] **Domaine `stakeo.app` acheté** ✅ (le `.com` reste optionnel plus tard).
- [ ] Créer les clés API gratuites (côté serveur) : **Gemini**, **API-Football** (100 req/j), **football-data.org**.
- [ ] Choisir l'hébergement du front : **Vercel** (recommandé) ou GitHub Pages.
- [ ] (Pour encaisser) Compte **Stripe** → abonnement 2,99 €/mois + essai gratuit.
- [ ] (Plus tard) Compte **Apple Developer** (99 $/an) pour l'app native.

---

## Phase 1 — Comptes, abonnement & fondations backend

- [x] **Schéma de base de données** (SQL + RLS) écrit dans `supabase/schema.sql` ✅ — `profiles` (+ essai/abonnement), `bankrolls`, `bets`, `transactions` (RLS par utilisateur), `fixtures` + `results` (cache partagé). **⏳ à lancer par toi dans le SQL Editor Supabase.**
- [x] **Couche de synchro app** (`src/lib/db.ts` + `src/sync.ts`) ✅ — hydrate à la connexion, écriture au fil des changements, migration one-shot des données locales, isolation par compte. ⏳ test croisé multi-appareils à confirmer par l'utilisateur.
- [x] **Comptes + vérification e-mail** (Supabase Auth) : inscription, e-mail de confirmation obligatoire, connexion, mot de passe oublié, renvoi d'e-mail, déconnexion. ✅ testé de bout en bout (6 langues).
- [x] **Verrouillage d'accès** : landing → inscription → vérif e-mail → app. Aucun accès sans compte connecté. ✅
- [x] **Config Supabase** : SMTP **Brevo** configuré et fonctionnel (envoi d'e-mails de confirmation OK, plus de limite) ✅ ; schéma SQL appliqué (6 tables vérifiées). Reste à faire avant lancement : URLs de redirection prod, supprimer les utilisateurs de test.
- [x] **Champ clé API utilisateur retiré** ✅ — la clé Gemini est côté app (`.env` en dev, proxy serveur en prod). L'utilisateur ne voit plus rien. Section « Tes données » nettoyée (import supprimé, texte cloud).
- ⚠️ **L'abonnement Stripe est déplacé tout à la fin → voir « Phase FINALE ».**
- [ ] **Migration du stockage** local → Supabase (cache offline + synchro ; import auto des données locales existantes).
- [x] **Déploiement sur stakeo.app** ✅ **EN LIGNE** — dépôt GitHub (thibaudnempont73-sketch/stakeo), GitHub Actions + Pages, DNS OVH OK (« DNS valid for primary »), HTTPS activé. Site servi et confirmé. Reste optionnel : CNAME `www`, et ajouter `https://stakeo.app` aux URLs de redirection Supabase (pour les liens e-mail en prod).

> Note : le champ « Clé API Gemini » actuel dans Réglages est **temporaire (dev/test)** — il disparaît dès que les clés passent côté serveur ici.

---

## Phase 2 — Règlement automatique ciblé (le cœur)

- [ ] **Rattachement pari → match canonique** : normalisation des noms (langues/orthographes bookmakers) + Gemini en renfort, mapping mis en cache.
- [~] **Adaptateurs par sport** (chacun écrit dans le cache `results`, format normalisé) :
  - [x] **ESPN (sans clé)** — `worker/adapters/espn.ts` : NBA/NFL/MLB/NHL/foot, scores → `MatchResult`, + `matchFixture()`. **Prouvé de bout en bout** sur le vrai combiné Winamax de l'utilisateur (`worker/demo-settle.ts` : 2 sélections NBA réglées → combiné gagné, 28,50€). Filet multi-sport pour les marchés simples.
  - [ ] API-Football (foot, exotiques : corners/cartons/buteurs/stats joueurs) · MLB Stats API · NHL API · Jolpica-F1
- [x] **Moteur de règlement par marché** (`src/lib/settle.ts`) ✅ — agnostique de l'API (lit un `MatchResult` normalisé). **Marchés simples ET exotiques** : 1N2, double chance, draw no bet, plus/moins (buts/points, corners, cartons), BTTS, handicap, buteur (à tout moment + premier). Parsing multilingue ; si la stat exotique n'est pas fournie → `unknown` (jamais réglé au hasard). Tests OK. Le `MatchResult` porte des champs optionnels (corners, cards, scorers, players) que les adaptateurs remplissent quand l'API les donne.
- [ ] **Fallback Gemini + Google Search** : pour la queue non couverte publiquement rapportée ; caché par (match, marché) ; filtre de confiance.
- [x] **Cron GitHub Actions** (`worker/settle.ts` + `.github/workflows/settle.yml`, toutes les 30 min) ✅ — lit les paris en cours (service_role, hors RLS), attend ~3,5h après le coup d'envoi, dédoublonne les appels ESPN par (sport, date ±1 j) dans le run, règle avec le moteur, met à jour le statut. Validé end-to-end (connexion Supabase + worker OK). **v1 : paris simples, sports ESPN (NBA/NFL/MLB/NHL/foot majeurs), marchés simples.** À venir : combinés (modèle par sélection), exotiques via API-Football, fallback Gemini, cache `results` inter-run.
- [ ] **Règlement à l'ouverture de l'app** depuis le cache (instantané, gratuit).
- [ ] Le bouton « Vérifier » disparaît → tout devient automatique.

---

## Phase 3 — Finition & lancement web

- [ ] **Jeu responsable** : limites de mise/dépôt, auto-exclusion, liens d'aide (ANJ / Joueurs Info Service), renforcer tilt/stop-loss.
- [ ] **RGPD** : export + suppression complète du compte, politique de confidentialité, hébergement UE.
- [ ] **Notifications** : à l'ouverture (« ton pari est réglé »), résumé quotidien.
- [ ] Onboarding, perfs, accessibilité, polish PWA (installation, icônes).
- [ ] Lancement web multilingue (Europe).

---

## Phase 4 — App mobile native

- [ ] **Capacitor** : emballer le code React existant en app iOS + Android.
- [ ] **Share Extension iOS** : Stakeo apparaît dans le menu Partager iPhone (partage direct depuis Winamax/Betclic comme Snapchat).
- [ ] **Notifications push** (app fermée) via un backend qui règle en continu.
- [ ] Publication **App Store** + **Play Store** (positionnement « tracker », pas de prise de paris).

---

## Phase 5 — Croissance

- [ ] Mode **tipster** : partage de stats vérifiées (ROI/yield réels).
- [ ] Nouveaux adaptateurs de sports selon la demande.
- [ ] Éventuel palier premium (fonctions avancées, plus de sports granulaires).

---

## Phase FINALE — Monétisation (Stripe) — À FAIRE EN TOUT DERNIER

> Décision : on construit **tout** le reste d'abord (app complète, règlement auto, natif),
> et l'abonnement payant arrive **à la toute fin**, juste avant l'ouverture commerciale.

- [ ] **Abonnement 2,99 €/mois + essai gratuit 14 jours** (Stripe Checkout + webhooks).
- [ ] L'app lit le statut d'abonnement dans `profiles` (`trial_ends_at`, `subscription_status`) ; bandeau d'essai + écran d'upgrade ; verrou d'accès quand l'essai/abonnement est expiré.
- [ ] **Comptes admin exemptés** : `ADMIN_EMAILS` dans `src/auth.ts` (contient déjà `thibaudnempont73@gmail.com` → accès complet sans abonnement). Ajouter l'enforcement serveur (`profiles.is_admin`) au moment du verrou.
- [ ] Jusqu'à cette phase : **aucun paywall** — tout est librement accessible pour construire et tester.

---

## Contraintes assumées (dites franchement)

- **Paris exotiques / sports de niche** : règlement automatique = surtout les marchés simples partout + les exotiques là où la donnée gratuite existe (foot majeurs, sports US). Handball, volley, fléchettes, esport, hippisme, rounds boxe/MMA → souvent manuel. C'est le même mur pour tous les concurrents.
- **API non officielles** (ESPN, NBA) : peuvent casser ou bloquer les IP serveur → monitoring + fallback prévus.
- **Quotas gratuits** (100 req/j API-Football) : tenus grâce au ciblage + regroupement + cache ; à l'échelle, montée en gamme ponctuelle d'une API.

---

## Prochaine action immédiate

➡️ **Phase 1, étape 1 : je conçois le schéma de base de données complet** (tables + RLS + cache `results` multi-source), sans attendre tes identifiants. Tu crées le projet Supabase en parallèle (Phase 0), et on branche.
