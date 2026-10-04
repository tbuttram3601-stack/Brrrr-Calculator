# BRRRR Deal Analyzer — Version 7 adjusted-sales rebuild

Key changes:
- RentCast acreage and year built populate automatically. No pre-analysis manual acreage/year entry.
- Added Edit property details after analysis. Local edits do NOT make another RentCast request.
- Optional subject fields: above-grade finished area, finished basement area, garage spaces, acreage, year built.
- Removed weighted-price-per-square-foot ARV. Total finished area is no longer multiplied by a PPSF figure.
- Simple ARV now uses an adjusted-sales framework: choose best eligible local candidates, calculate only market-supported adjustments from variation in the returned local sample, derive an adjusted indication for each, and reconcile with the median.
- No invented fixed percentages for bedrooms, bathrooms, age or acreage.
- Property differences that can reasonably be adjusted are no longer automatically hard-rejected; property type, extreme distance/area/lot mismatch remain hard exclusions.
- Cash wording changed to 'back at refinance' vs 'left in'.
- Advanced uses the Simple-selected comp set and makes zero additional API calls.
- IMPORTANT: the RentCast AVM response exposes total indoor living area but not separate above-grade/below-grade area for each comparable. V7 therefore does not pretend it can make a basement-vs-GLA adjustment. That remains an explicit confidence limitation.
- One RentCast request per Simple analysis remains unchanged.
