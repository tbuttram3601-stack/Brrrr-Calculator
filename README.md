# BRRRR Deal Analyzer — Version 6 appraisal-style comp screening

Changes from V5:
- RentCast AVM is now a reference only; it no longer controls Simple ARV.
- Still exactly ONE RentCast request per Simple analysis.
- Candidate search tightened from 3.0 miles / 15 comps to 1.5 miles / up to 25 candidates.
- Simple ARV is calculated only from screened local comps.
- Hard screens include property type, distance, total living area, lot/acreage, year built, bedrooms and bathrooms.
- Starts strict and expands only when fewer than 3 comps survive.
- With 5+ survivors, extreme price-per-square-foot outliers (>30% from median) are rejected.
- Remaining comps are weighted by distance, living-area match, age match, lot-size match, beds/baths and RentCast correlation.
- Comparable table visibly marks USE/NO and why a candidate was rejected.
- Lot acreage and year-built manual overrides are available under Deal assumptions.
- Advanced uses ONLY the comps accepted by Simple.
- Negative-zero display fixed.
- IMPORTANT LIMITATION: RentCast's AVM response exposes total indoor living area, lot size and year built, but not a separate above-grade GLA/basement-area field for each comparable. V6 explicitly discloses this instead of pretending total living area and above-grade GLA are identical.
