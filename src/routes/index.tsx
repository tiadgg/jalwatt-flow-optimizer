import { createFileRoute } from "@tanstack/react-router";

import { JalWattApp } from "@/components/jalwatt-app";
import { SettingsProvider } from "@/context/settings-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JalWatt — Water & Energy Aware AI Scheduler" },
      {
        name: "description",
        content:
          "JalWatt simulates water- and energy-aware scheduling for Indian server rooms running agentic AI workloads. Compare baseline vs. optimized cost, water, and carbon.",
      },
      { property: "og:title", content: "JalWatt — Water & Energy Aware AI Scheduler" },
      {
        property: "og:description",
        content:
          "Simulate and optimize server-room scheduling across Indian cities: shift deferrable AI jobs to cheaper, cooler, lower-carbon hours and track the savings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  return (
    <SettingsProvider>
      <JalWattApp />
    </SettingsProvider>
  );
}
