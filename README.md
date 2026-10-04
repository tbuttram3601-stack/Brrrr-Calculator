# BRRRR Deal Analyzer — Version 5 audited build

Mobile-first private BRRRR screening tool.

Key rules:
- One RentCast `/v1/avm/value` request per Simple analysis.
- Advanced Calculator makes no API request; it reuses the 15 comps already returned.
- Simple ARV is the frozen RentCast comp-supported baseline valuation.
- Renovation level estimates rehab cost only: Light $10/sf, Medium $25/sf, Heavy $50/sf, Full Gut $80/sf. No minimum.
- Advanced ARV adds only the local-comp modeled change between the original and proposed finished property to the frozen Simple ARV.
- Advanced never assigns a fixed dollar value to a bedroom or bathroom.
- Advanced confidence: 1 direct comp Very Low, 2 Low, 3–4 Moderate, 5+ Good. Zero direct comps still produces a weighted local-comp estimate and clearly marks Very Low confidence.
- `math.html` shows the exact Simple formulas from the most recent analysis without another API request.
