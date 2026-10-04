# BRRRR Deal Analyzer

Single-page BRRRR property screener using RentCast's AVM/value endpoint.

## Run locally
1. Install Node.js 18+.
2. In this folder run: `npm install`
3. Set your RentCast key as an environment variable named `RENTCAST_API_KEY`.
4. Run: `npm start`
5. Open `http://localhost:3000`

## Deploy
Deploy the folder to a Node-compatible host (Render, Railway, Fly.io, etc.) and add `RENTCAST_API_KEY` as a server-side environment variable. Do not place the key in `index.html`.

## Assumptions
- Default refinance LTV: 75% (editable)
- Default rehab: $30/sq ft when square footage is available; otherwise 35% of purchase price (editable)
- Default other/holding/closing costs: 7% of purchase + rehab (editable)
- ARV and range come from the property-data API; comps are displayed for review.

This is a screening tool, not an appraisal or lender commitment.


Version 4 adds an on-page Advanced calculation audit ('Show the Advanced Math') and a separate math.html explainer for the Simple Calculator. Neither feature makes an additional RentCast API request.
