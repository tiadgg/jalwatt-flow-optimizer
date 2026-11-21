# Replay page

## What will change
- Add a Replay page to JalWatt’s existing sidebar navigation, with browser-only CSV upload, validation feedback, measured and modelled load curves, error metrics, and estimated savings for the measured period.
- Add a clearly labelled synthetic sample CSV generated from the existing seeded simulation, including a synthetic filename and header comment.
- Keep the existing engine unchanged. Use its `runSimulation` hourly profile and saving percentage, and show the projection method and input assumptions in the page.
- Keep all assets local and add focused tests for CSV parsing, gap/unit validation, replay calculations, sample generation, and the three existing scenario percentages.

## Technical details
- Put parsing, sample generation, integration, and error calculations in a side-effect-free `src/lib` helper; place the page UI in `src/components/jalwatt` and connect it through `jalwatt-app.tsx`.
- Require timezone-qualified timestamps and a consistent sampling interval; integrate power using the trapezoidal rule. Compare measurements with the existing engine’s hourly facility-energy profile by UTC hour. Report MAPE over nonzero measured samples and signed total-energy difference relative to measured energy.
- Estimate savings on the measured load by applying `runSimulation(settings).savingsPct` to measured energy; disclose that this is a model-based projection, not measured savings.