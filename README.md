# BRRRR Deal Analyzer — V10 Simple First

V10 returns to the original product goal: address + purchase price + renovation level -> useful BRRRR screen.

DATA
- Exactly 2 successful RentCast requests per new analysis.
- Request 1: subject public record.
- Request 2: up to 500 same-property-type recorded sales within 2 miles and 730 days.
- Uses lastSalePrice / lastSaleDate. No AVM or listing prices.
- Optional property correction and manual comp review are local and cost zero requests.

ARV MODEL
- Broad sold universe is ranked locally, not pre-filtered by misleading total-finished square footage.
- Similarity dimensions: location, total living area, age, beds/baths, lot, above-ground floor count, architecture, foundation, garage and recency, with same-subdivision preference.
- Automatic Simple mode selects 7 strongest matches.
- Similarity weight = exp(-score / 2.25).
- Initial robust center = similarity-weighted median.
- Robust scale uses MAD (median absolute deviation) × 1.4826, with a small scale floor.
- Huber influence (k=1.5) reduces influence of unusually high/low sales without deleting them or inventing adjustments.
- Final ARV = robust similarity-weighted mean of actual sale prices.
- Confidence uses effective sample size, match quality and robust price dispersion.
- No $/sf ARV multiplication. No arbitrary bed/bath/garage/age/lot dollar adjustments.

FINANCIAL MODEL
- Rehab: manual override or total living area × selected rehab rate (Light 10, Medium 25, Heavy 50, Full Gut 80).
- Other costs: manual override or 7% of purchase + rehab.
- Total basis = purchase + rehab + other costs.
- Refi = ARV × LTV.
- Cash result = refi - total basis.
- Equity = ARV - refi.
- Max purchase with automatic other costs = refi / 1.07 - rehab.
- Max purchase with manual other costs = refi - rehab - other costs.

LIMITATIONS
- RentCast public records define squareFootage as total indoor living area; they do not reliably provide an appraisal-grade above-/below-grade split for every comp.
- Condition/remodel quality is not consistently available.
- V10 is a screening tool, not a lender appraisal.
- V10 intentionally contains no Advanced calculator. The Simple calculator is the product being validated; unsupported scenario math was removed rather than left as dead or misleading functionality.
