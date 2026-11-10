# JalWatt scheduler, cooling ROI, city data, and stress-test update

## What will change
- Upgrade Scheduler to a 24-hour comparison chart with load, ambient temperature and tariff overlays; add the three workload-rule chips, action filters, an explainable decision table, and a violation-sensitive SLA banner.
- Expand Cooling & ROI with three cooling comparisons, editable liquid/dry capex, annual savings and payback, a workload-scaled SaaS calculator, and PUE/WUE target indicators.
- Expand Data & City with five illustrative city profiles, editable stress/tariff/carbon assumptions, engine-aware city switching, a water-stress-weighted savings metric, and three editable field-quote slots.
- Repair Stress Test so Run scenario commits the chosen job count and its current results are visibly updated.

## Technical details
- Keep the app backend-free and use the existing shared settings context for editable state; keep calculations deterministic in `src/engine`.
- Add tests for ROI defaults/formulas, city-to-engine input updates, water-stress weighting, and the scenario-run interaction where appropriate.
- Existing per-hour tariff values are preserved on initial load; choosing another city applies that city's editable illustrative tariff and grid-carbon profile to the simulator.
- Use transparent starting multipliers for Low/Med/High/Extreme water stress and label city tariff/carbon values illustrative, since no numeric city data or stress multipliers were supplied.