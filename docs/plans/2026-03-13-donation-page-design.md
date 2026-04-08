# Donation Page Design

**Date:** 2026-03-13
**Status:** Approved

## Overview

Add a donation page to the SAFE Research Institute website using Stripe Payment Links for payment processing. The organization is a 501(c)(3) with a pending application, so donations are **not yet tax-deductible** — this must be clearly disclosed.

## Payment Approach: Stripe Payment Links

- Create Payment Links in Stripe Dashboard for preset amounts ($25, $50, $100, $250, $500)
- Both one-time and monthly recurring variants
- Custom amount via a separate Stripe Payment Link with open amount
- No backend needed — links go directly to Stripe-hosted checkout
- Placeholder `#` hrefs until Stripe account is set up

## Page Structure (`donate.html`)

### 1. Hero Section
- Dark navy hero matching site pattern (`.hero` class)
- Badge: "Support Our Mission"
- Headline: "Fuel Independent Science"
- Subtitle about powering research free from industry influence
- No CTA buttons in hero (the donation form IS the CTA)

### 2. 501(c)(3) Status Disclaimer
- Prominent but not alarming notice
- Styled as a bordered info banner
- Text: 501(c)(3) application pending, donations are not tax-deductible at this time
- Will be updated once status is approved

### 3. Donation Amount Selector Section
- One-time / Monthly toggle switch
- Preset amount buttons: $25, $50, $100, $250, $500
- Custom amount input field
- Gold "Donate Now" CTA button
- Each amount maps to a Stripe Payment Link (placeholder `#` for now)

### 4. Impact Section
- 3 pillar cards showing what donations fund:
  1. Independent Research — funding unbiased scientific analysis
  2. Public Education — free educational resources and voter guides
  3. Open Access — keeping all research freely available
- Uses existing `.pillars-grid` / `.pillar-card` patterns

### 5. Independence Commitment
- `.commitment-card` style section (dark navy with grid overlay)
- Emphasizes donor independence policy
- Links to Gift Acceptance & Independence Policy
- Key message: "No donor influences our research"

### 6. Other Ways to Give
- Mail a check (org address)
- Contact for planned giving / corporate partnerships
- Uses simple two-column layout

## Navigation Updates

- Add "Donate" as a nav CTA button (gold accent, alongside "Join a Task Force")
- Update footer "Support Us" section to link to donate.html

## Key Disclosures

- 501(c)(3) status pending — donations not yet tax-deductible
- 100% of donations go towards the mission
- Reference Gift Acceptance & Independence Policy
- Tax ID: 41-2910356

## CSS

- No new CSS classes needed for most sections (reuse existing patterns)
- New styles needed: amount selector buttons, one-time/monthly toggle, disclaimer banner
- All new styles follow existing design system variables
