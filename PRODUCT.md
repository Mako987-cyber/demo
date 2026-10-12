# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: owners and managers of Italian small and mid-sized companies (PMI) without a structured internal IT function, whose infrastructure grew without governance. They arrive looking for an external consultant who can take stock of what they have, tell them what is protected and what is not, and put it in order. They judge by trust and clarity, not by vendor jargon.

Secondary: anyone who opens the projects section from the footer link: a personal lab, not a sales surface.

## Product Purpose

The personal site of Aniello Mollo, Infrastructure & Cloud Engineer based in Monza, consulting remotely and hybrid. It exists to turn a PMI visitor into a first contact: someone describing their infrastructure (users, what runs on-premises and in cloud, what costs them the most time) and asking for an initial assessment. Success is that contact request.

It also hosts a separate projects lab (API dashboards, WebGL trackers, a retro game) under `pages/`.

## Positioning

One person covering the whole stack, from the cloud tenant down to the cable: Azure and Microsoft 365 identity and endpoints, automation (PowerShell, Graph API, Terraform), backup and disaster recovery with restores actually tested, and on-premises servers and networks. Experience comes from regulated environments (banking, finance, energy: Deutsche Bank onsite, Eos Solutions, altermAInd) where a misconfiguration has compliance consequences. That rigor is the proof brought to PMI, not the target market.

## Operating Context

- The visitor reaches the site, reads home → services → profile, and contacts by email (primary), LinkedIn or GitHub. There is no form, booking or pricing.
- The contact promise in use: first reply within two business days, no cost and no commitment for the initial assessment.
- The free "prima valutazione" is a discovery call (call conoscitiva) to understand the situation. A proposal follows only if working together makes sense. There is no written deliverable from the free step; never promise one.
- Work is remote by default; on-site visits on request anywhere in Lombardy.
- Services are framed as rack units read top to bottom: U42 cloud and identity, U30 automation, U12 business continuity, U01 hardware and network.

## Capabilities and Constraints

- Vanilla HTML/CSS/JS, no framework, no build step, no `package.json`; deployed on Vercel with serverless proxies in `api/` for secrets (NASA, Supabase).
- UI language is Italian (`lang="it"`); the MAGI projects are English with Japanese secondary labels.
- The portfolio lives at the root `index.html` plus `pages/portfolio/{services,profile,contact}.html`; `pages/portfolio/home.html` is a kept redirect because its URL was already shared.
- The projects lab is reachable only from a footer button and must not compete with the professional portfolio.
- MAGI pages (`magi-neo/`, `magi-sat/`) are deliberately isolated from the shared `styles/` system; `orbit/` is their counterpart inside it.

## Brand Commitments

- Visible name: **Scale IT Right**. Legal/company form: **ScaleItRight** (copyright line). The email domain stays `setitright.it` as is.
- Personal name stays alongside the brand: "Aniello Mollo · Infrastructure & Cloud Engineer".
- Tagline in use: "Scale it right. Keep it running."
- Voice: first person, direct and concrete, plain Italian, no hype; claims tied to real numbers and contexts ("un backup mai ripristinato è solo un'ipotesi").
- AM monogram logo and icons are generated from `logo-explore/build/`; never hand-edit `assets/logo*.svg` or the icons.

## Evidence on Hand

- Metrics on the home: 4+ years on enterprise infrastructure, 200+ devices managed in hybrid fleets, −40% recurring tickets after automation (Eos Solutions).
- Full work history and skills in `pages/portfolio/profile.html`: altermAInd (2025–present), Eos Solutions (2023–2025), Hemmersbach at Deutsche Bank HQ (2021–2023), Essence Academy (2021; 1000+ accounts, 95% first-contact resolution).
- Contacts: a.mollo@setitright.it, LinkedIn `aniello-mollo-aa069a1a6`, GitHub `Mako987-cyber`.
- Absent, must not be fabricated: client testimonials, named PMI clients or case studies, pricing, certifications, VAT/company registration details, a portrait photo (none provided yet; do not use stock or generated faces).

## Product Principles

1. Speak to the PMI owner's problem first; banking and finance experience is proof of rigor, not the audience.
2. Every claim is concrete and verifiable: real numbers, real employers, real tools. No invented proof.
3. Lead with continuity: the site sells infrastructure that keeps running and comes back after a failure.
4. One clear next step: describe your situation and get an assessment.
5. The projects lab stays a side room; it may show curiosity and craft, never dilute the professional pitch.

## Accessibility & Inclusion

Existing baseline to preserve: skip link, visible `:focus-visible`, `prefers-reduced-motion` disabling animation, light/dark themes following `prefers-color-scheme`. No product-specific standard beyond this was established.
