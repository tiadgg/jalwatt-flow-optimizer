 JalWatt Green Scheduler

Build "JalWatt", a React + TypeScript + Tailwind + Recharts web app: a water- and energy-aware scheduler for Indian server rooms running agentic AI workloads. No backend; everything runs client-side. Dark, clean, professional dashboard; fully mobile responsive. Left sidebar nav: Dashboard, Simulator, Scheduler, Cooling & ROI, Stress Test, Data & City, Report, Assumptions.

First create a pure TypeScript simulation engine in src/engine/ with inputs stored in a global settings context with defaults:

- jobsPerDay 5000, mix easy/medium/hard 50/30/20 %

- deferrablePct 40, privacyPinnedPct 15 (rest urgent)

- roomKW 150, rackKW 50

- energy per task Wh: small 0.3, medium 1.5, large 6

- cooling presets: evaporative {PUE 1.5, WUE 1.8}, liquid {PUE 1.15, WUE 0.1}, dry {PUE 1.2, WUE 0}

- hourly arrays (24 values) for Bangalore: ambient temp C, tariff INR/kWh (peak 9, off-peak 6.5), grid CO2 kg/kWh (0.7)

Formulas: IT_kWh = sum(task energy); Facility_kWh = IT_kWh*PUE; Water_L = IT_kWh*WUE; CO2 = Facility_kWh*gridFactor; Cost = sum over hours of Facility_kWh_hour*tariff_hour.

Baseline: every task goes to the large model, evaporative cooling, jobs run at arrival hour.

JalWatt: easy -> small model, medium -> medium, hard -> large; deferrable jobs move to the cheapest/coolest hour before their deadline; privacy-pinned jobs always stay local and are never moved; urgent jobs never delayed; chosen cooling preset applies. Count slaViolations (must be 0).

Export runSimulation(settings) returning {baseline, jalwatt, savingsPct, hourlyProfile, decisionLog}. decisionLog items: {jobGroup, action, reason, savedKWh, savedINR, tradeoff}. Use a seeded random generator so results are reproducible. Seed defaults so results show on first load. Add a Vitest test file for the engine.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://jalwatt-flow-optimizer.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/03f0f526-c26f-4c84-8df6-12ae343c5af7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
