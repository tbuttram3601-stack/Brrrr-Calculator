# BRRRR Deal Analyzer — Final Conservative Build

Simple-first BRRRR screening calculator using RentCast public-record closed sales.

## Valuation rules
- 2 RentCast requests per analysis: subject record + broad sold-property universe.
- Uses `lastSalePrice` / `lastSaleDate`; no RentCast AVM.
- Hard physical guardrails are applied before similarity ranking.
- Uses 3–5 defensible closed sales; if fewer than 3 survive, the app reports insufficient evidence instead of manufacturing an ARV.
- ARV is the similarity-weighted median of actual selected closed-sale prices.
- No price-per-square-foot multiplication and no invented dollar adjustments.
- Older one-story homes are treated cautiously because public-record total living area may include finished basement space.
- Advanced Review permits local subject corrections and manual comp inclusion/exclusion without another API call.

## BRRRR math
- Auto rehab = subject total living area × selected rehab rate.
- Auto other costs = 7% × (purchase + rehab).
- Total basis = purchase + rehab + other costs.
- Refinance = ARV × LTV.
- Cash result = refinance − total basis.
- Equity = ARV − refinance.
- Auto-other-cost max purchase = refinance / 1.07 − rehab.

This is a screening tool, not an appraisal. Public-record data may omit condition and a reliable above-grade/below-grade split.
