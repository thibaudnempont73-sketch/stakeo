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

- [x] **Rattachement pari → match canonique** ✅ — matcher flou par jetons/préfixes (`worker/adapters/match.ts`) : « Man City » ↔ « Manchester City », « Memphis » ↔ « Memphis Grizzlies », affectation croisée pour ne pas matcher deux fois la même équipe. Gemini reste le renfort pour les cas non résolus.
- [~] **Adaptateurs par sport** (agrégés + dédoublonnés + cachés dans `worker/adapters/index.ts`, format normalisé) :
  - [x] **ESPN (sans clé) — multi-ligues** ✅ `worker/adapters/espn.ts` : 23 ligues foot (PL/LaLiga/Serie A/Bundesliga/L1-L2/LDC/Europa/Conf/FA Cup/MLS/Liga MX/Brésil/Argentine/Saudi…), NBA/WNBA/NCAA, NFL/college, MLB, NHL → `MatchResult`. Vérifié en réel (85 matchs foot réglés sur une journée, 15 MLB).
  - [x] **TheSportsDB (sans clé)** ✅ `worker/adapters/thesportsdb.ts` : ligues mondiales + basket européen, handball, volley, rugby que ESPN n'expose pas. Best-effort ([] en cas d'erreur/quota).
  - [x] **API-Football (clé, exotiques foot)** ✅ `worker/adapters/apifootball.ts` : buteurs, cartons, corners, stats joueur → enrichissement **paresseux** du seul match parié (uniquement si le marché n'a pas pu être réglé sur le score → économise le quota). Clé `API_FOOTBALL_KEY` en GitHub Secret. Vérifié en réel (buteurs/cartons OK). **Plan gratuit = 100 req/j + fenêtre `date` limitée à today±1** → parfait pour le règlement temps réel (on règle ~3h30 après le match), garde-fou en place pour ne pas gaspiller le quota sur des dates hors fenêtre.
  - [ ] **À venir (optionnel)** : football-data.org · Jolpica-F1 · API-Basketball/Baseball/… (même clé api-sports pour exotiques autres sports)
- [x] **Fallback Gemini dans le worker** (`worker/gemini.ts`) ✅ — pour les combinés, sports non couverts par ESPN, et marchés non reconnus : recherche Google via Gemini, filtre de confiance, caché par signature de pari. Clé `GEMINI_API_KEY` dans GitHub Secrets.
- [x] **Scan côté serveur** (`supabase/functions/scan-bet`) ✅ — la clé Gemini quitte le navigateur : le front envoie l'image à l'Edge Function (authentifiée), qui appelle Gemini et renvoie le pari. ⏳ à **déployer** par toi (`supabase functions deploy scan-bet` + secret Gemini Supabase). Bouton « Vérifier » manuel retiré du dashboard (règlement 100 % auto).
- [x] **Moteur de règlement par marché** (`src/lib/settle.ts`) ✅ — agnostique de l'API (lit un `MatchResult` normalisé). **Marchés simples ET exotiques** : 1N2, double chance, draw no bet, plus/moins (buts/points, corners, cartons), BTTS, handicap, buteur (à tout moment + premier). Parsing multilingue ; si la stat exotique n'est pas fournie → `unknown` (jamais réglé au hasard). Tests OK. Le `MatchResult` porte des champs optionnels (corners, cards, scorers, players) que les adaptateurs remplissent quand l'API les donne.
- [ ] **Fallback Gemini + Google Search** : pour la queue non couverte publiquement rapportée ; caché par (match, marché) ; filtre de confiance.
- [x] **Cron GitHub Actions** (`worker/settle.ts` + `.github/workflows/settle.yml`, toutes les 30 min, **Node 22** pour le WebSocket natif de supabase-js) ✅ — lit les paris en cours (service_role, hors RLS), attend ~3,5h après le coup d'envoi, agrège toutes les sources gratuites par (sport, date ±1 j) avec cache dans le run, règle avec le moteur, met à jour le statut. Validé end-to-end. **Gère désormais : paris simples ET combinés** (règlement sélection par sélection via les sources gratuites, chaque sélection portant son propre match `event`). À venir : exotiques via API-Football, cache `results` inter-run (persistant en base).
- [x] **Règlement à l'ouverture de l'app** depuis le cache ✅ (instantané, gratuit, sans attendre le cron) — `src/lib/settleLocal.ts` lit le cache partagé `fixtures`+`results` et règle les paris finis côté client via le moteur (0 appel API) ; les changements repartent au cloud via la synchro. Le worker **écrit** le cache (`worker/cache.ts`, données exotiques incluses) → un match fini n'est jamais re-fetché. Matcher partagé app/worker (`src/lib/match.ts`). Vérifié : round-trip cache + 8/8 cas de règlement (vainqueur, over/under, BTTS, buteur, combinés).
- [ ] Le bouton « Vérifier » disparaît → tout devient automatique.

---

## Phase 3 — Finition & lancement web

- [x] **Jeu responsable** ✅ : « faire une pause » (24h/7/30/90 j) qui bloque la saisie de nouveaux paris jusqu'à la fin (écran de pause), liens d'aide **localisés par pays** (`src/lib/help.ts` : Joueurs Info Service, GambleAware, FEJAR, BZgA, TVNGA, Linha Vida…), en plus du stop-loss + alertes tilt existants.
- [x] **RGPD** ✅ : export JSON (existant) + **suppression totale du compte** (Edge Function `delete-account` en service_role → cascade sur toutes les tables) via modal de confirmation ; **page /privacy** (politique de confidentialité, 6 langues) liée depuis Réglages + pied de landing. À confirmer : région Supabase = UE (choisie à la création du projet).
- [x] **Notifications** ✅ : à l'ouverture, récap des paris réglés depuis la dernière visite (toast → Paris + net gagné/perdu) ; notifications système optionnelles (opt-in) ; réglage on/off. `src/lib/notify.ts` + `SettlementToast`. (Push app fermée = Phase 4.)
- [~] **Onboarding & polish PWA** : ✅ installation (bouton + prompt), ✅ icônes PNG 192/512 maskables + apple-touch, ✅ onboarding revu (met en avant scan + règlement auto), ✅ états vides orientés scan/partage. Reste : perfs/accessibilité fines.
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
