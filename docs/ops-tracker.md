# SAFE Research Institute — Operations Tracker

> Internal checklist tracking setup tasks gated by 501(c)(3) determination letter status.
> Last updated: 2026-04-08

---

## Status: 501(c)(3) Application Pending

**EIN:** 41-2910356
**Form Filed:** 1023-EZ
**Expected Timeline:** ~22 days for 1023-EZ (80% of cases)

---

## Phase 1: Do Now (No Determination Letter Required)

These can be completed immediately while the application is pending.

### Website & Compliance
- [x] Launch website at saferi.org
- [x] Add 501(c)(3) pending disclaimer to donate page
- [x] Publish Conflict of Interest policy
- [x] Publish Gift Acceptance & Independence policy
- [x] Publish Privacy Policy and Terms of Use
- [x] Remove advocacy/lobbying language from all pages (501(c)(3) compliance audit)
- [x] Ensure c3/c4 operational separation (volunteer agreements reference correct entity)
- [ ] Add Mission & Governance page (board members, officer roles, founding documents)
- [ ] Add formal AI Use Policy page
- [ ] Draft and publish Annual Report / Transparency page (even pre-990)
- [ ] Post Articles of Incorporation and Bylaws publicly

### Financial & Legal
- [ ] Open dedicated business bank account (requires EIN + Articles of Incorporation)
- [ ] Set spending threshold requiring full board approval (recommend $500)
- [ ] Set up accounting software (Wave = free; Aplos = $59/mo for fund accounting)
- [ ] Draft donor acknowledgment letter template ($250+ gifts)
- [ ] Register for charitable solicitation in California (Form CT-1, $50 fee, within 30 days of first donation)
- [ ] Research multi-state charitable solicitation requirements (~40 states require registration)
- [ ] File Form 5768 to elect 501(h) expenditure test (clear lobbying dollar limits)

### Governance
- [ ] Hold organizational board meeting — adopt bylaws, elect officers, authorize ops
- [ ] Collect annual conflict of interest disclosure statements from all directors
- [ ] Create Board Composition Matrix (current skills vs. needed skills)
- [ ] Begin recruiting 4th and 5th board members (losing 1 of 3 = organizational crisis)
- [ ] Set meeting cadence (quarterly minimum, monthly during startup)

### Infrastructure
- [ ] Set up Stripe account and replace placeholder payment links in js/donate.js
- [ ] Configure Firebase project with real credentials (js/firebase-config.js)
- [ ] Connect Vercel to GitHub for automated deploys (requires GitHub Login Connection in Vercel settings)

---

## Phase 2: After Determination Letter Received

These require the official IRS determination letter (501(c)(3) status confirmed).

### Free Nonprofit Programs (Apply Immediately Upon Receiving Letter)
- [ ] **Google Workspace for Nonprofits** — free, up to 2,000 users, branded @saferi.org email, 100TB Drive, Gemini AI. Apply at google.com/nonprofits (verification via Goodstack, 3-5 business days)
- [ ] **Google Ad Grants** — $10,000/month in free Google Search advertising. Apply through Google for Nonprofits dashboard after Workspace approval
- [ ] **Canva Pro for Nonprofits** — free for up to 50 team members, premium templates, brand kit, AI tools, 1TB storage
- [ ] **Microsoft 365 Nonprofit** — 75% discount ($5.50/user/mo) + up to $2,000/year in free Azure credits via TechSoup
- [ ] **GuideStar/Candid Profile** — complete transparency profile, work toward Platinum seal (3x more likely to get grants). Requires determination letter to verify.

### Donation Platform Migration
- [ ] **Switch from Stripe to Zeffy** — 100% free donation platform (zero platform fees, zero transaction fees). Evaluate after determination letter. Zeffy requires verified 501(c)(3) status.
- [ ] Update donate.html disclaimer: remove "application pending" language, add "Contributions are tax-deductible to the extent allowed by law"
- [ ] Set up automated donor acknowledgment system (contemporaneous receipts for $250+ gifts)

### Compliance Calendar (Starts After Determination)
- [ ] **May 15 annually** — File IRS Form 990-N (e-Postcard) if gross receipts <= $50,000
- [ ] **May 15 annually** — File CA FTB Form 199N (if receipts <= $50K) or Form 199 + $10 fee (if > $50K)
- [ ] **May 15 annually** — File CA Attorney General Form RRF-1 + $25 fee + copy of 990
- [ ] **Biennial (month of incorporation)** — File CA Secretary of State Form SI-100 ($20)
- [ ] **January 31 annually** — Send all donor acknowledgment letters for prior year
- [ ] **30 days before any raffle** — File CA Form CT-NRP-1
- [ ] Set up automated calendar reminders for ALL above deadlines

### Public Support Test (Starts Year 6)
- [ ] Track public vs. private support ratio from day one
- [ ] Target: 33.33%+ from public sources over rolling 5-year period
- [ ] Diversify revenue — aim for no single source > 30-40% of total budget
- [ ] Failing two consecutive years = reclassification as private foundation (cannot reverse for 5 years)

---

## Phase 3: Growth & Scale

### Board Expansion
- [ ] Expand to 5+ board members
- [ ] Form standing committees: Finance, Governance/Nominating, Fundraising
- [ ] Establish advisory board for specialized expertise
- [ ] Implement 90-day mentoring overlaps for board transitions

### Programs & Revenue
- [ ] Apply for first grants (maintain Grant Readiness File: determination letter, articles, bylaws, COI policy, board list, current 990, annual budget, program descriptions with outcomes)
- [ ] Explore earned revenue: fee-for-service policy consulting, training workshops, memberships
- [ ] Launch recurring giving program
- [ ] Consider fiscal sponsorship relationships for new initiatives

### Insurance & Risk
- [ ] Obtain D&O insurance ($1,500-$8,000/year) — 85% of nonprofit D&O claims are employment-related
- [ ] Review general liability coverage
- [ ] Assess cyber liability insurance (donor data protection)

---

## Key Contacts & Resources

| Resource | URL | Notes |
|----------|-----|-------|
| IRS Tax-Exempt Status Lookup | irs.gov/charities-non-profits | Check application status |
| CA Attorney General Charities | oag.ca.gov/charities | Registration & renewals |
| CA Franchise Tax Board | ftb.ca.gov | State tax exemption filings |
| CA Secretary of State | bizfile.sos.ca.gov | SI-100 biennial filing |
| Google for Nonprofits | google.com/nonprofits | Workspace, Ad Grants |
| Candid/GuideStar | candid.org | Transparency profile |
| Zeffy | zeffy.com | Free donation platform |
| TechSoup | techsoup.org | Discounted software |
| Pay.gov | pay.gov | IRS form submissions |

---

> **CRITICAL REMINDER:** Failing to file ANY Form 990 for three consecutive years triggers automatic, irrevocable revocation of tax-exempt status. No exceptions. No appeals. File even if you raised $0.
