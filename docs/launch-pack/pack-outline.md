# Pack outline (v1)

Format: one PDF or Notion guide plus a Google Sheets/Notion checklist bundle, about 25-40 pages. Sections marked **[YOURS]** need your real experience. That is what makes this worth paying for. Sections marked **[VERIFY]** need a check against the current official docs before shipping.

## 0. Start here
- Who this is for and what it covers (Expo / React Native, subscription + AI + health apps)
- "Last verified" date and how updates work
- How to use the checklists

## 1. Pre-submission checklist (both stores) [VERIFY]
Single-page tick list. Candidate items to confirm against current rules:
- Account deletion available in-app (Apple 5.1.1(v), Google Play requirement)
- Sign in with Apple needed if other third-party logins offered (Apple 4.8)
- Subscription terms, price and renewal disclosed clearly in the paywall (Apple 3.1.2)
- Digital goods use in-app purchase on iOS (Apple 3.1.1); note external-link rules are in flux
- Privacy policy URL, privacy nutrition label (Apple), Data Safety form (Google)
- Demo account or review notes for reviewers
- Screenshots, age rating, export compliance answers

## 2. Apple review playbook
- Timeline from your submissions, typical review times [YOURS]
- Rejections you received and the exact fix that worked [YOURS]
- Health data: HealthKit usage strings, privacy policy wording, what reviewers asked [YOURS] [VERIFY 5.1.3]
- AI features: consent screen before sending personal data to a third-party AI (Apple 5.1.2(i), live since Nov 2025) [VERIFY] and the wording you used [YOURS]
- Paywall review pitfalls: restore purchases, trial disclosure, RevenueCat setup [YOURS]
- Review notes template (what to write to the reviewer) [YOURS]
- Reply-to-rejection templates

## 3. Google Play playbook
- New personal developer accounts: closed test with 12 testers for 14 days before production [VERIFY current requirement and account type]
- How you recruited testers and ran the 14 days [YOURS]
- Data Safety form: answers for an app using Supabase, RevenueCat, an AI API, analytics [YOURS] [VERIFY]
- Health Connect permission declaration: what you wrote [YOURS] [VERIFY]
- Subscription and policy pitfalls, rejection reasons you hit [YOURS]

## 4. Expo / EAS shipping pipeline
- EAS Build and Submit setup for both stores
- Versioning and release flow across 80+ releases: what you automated, what broke [YOURS]
- OTA updates: what you can and cannot ship without review [VERIFY]
- Credentials, signing, common build failures [YOURS]

## 5. Subscriptions with RevenueCat
- Paywall and free-trial setup, entitlements, restore flow [YOURS]
- Pricing and trial experiments, what you would do differently [YOURS]
- Webhook to Supabase for entitlements (reference pattern)

## 6. AI feature safety and cost
- Consent flow and privacy wording
- Controlling API cost (limits, caching, model choice) [YOURS: how Core+ handles Gemini]
- Abuse and rate limiting

## 7. Localization for 5 languages
- Workflow, tooling, review gotchas [YOURS]

## 8. ASO and launch
- Metadata templates (title, subtitle, keywords, descriptions)
- Launch checklist and first 30 days
- Screenshot and preview guidance

## 9. Templates bundle
- Review-note templates (Apple, Google)
- Rejection reply templates
- Privacy policy skeleton (not legal advice; recommend a lawyer for the final text)
- Data Safety and nutrition-label worksheet
- Release checklist as Google Sheet / Notion

## 10. Case study: Core+
- Timeline, what worked, mistakes, numbers you are comfortable sharing [YOURS]
- Link to the live app (App Store and Google Play)

## Free lead magnet (1 page)
"Rejection-risk checklist": the top 15 checks from section 1. Gate behind email.

## Legal and honesty notes
- Not legal advice. State this plainly.
- No guaranteed-approval claims. Say "what worked for me".
- Each policy statement links to the official source and carries a verified date.
