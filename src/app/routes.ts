import React, { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router";
import { Layout } from "./components/Layout";
import { ProjectsList } from "./components/ProjectsList";
import { NotFound } from "./components/NotFound";
import { OnboardingPage } from "./components/OnboardingPage";
import { PaymentSuccessPage } from "./components/PaymentSuccessPage";

// Lazy loaded components for better performance
const ProjectDetail = lazy(() =>
  import("./components/ProjectDetail").then((module) => ({
    default: module.ProjectDetail,
  }))
);
const ToolsMetrics = lazy(() =>
  import("./components/ToolsMetrics").then((module) => ({
    default: module.ToolsMetrics,
  }))
);
const ToolsBudget = lazy(() =>
  import("./components/ToolsBudget").then((module) => ({
    default: module.ToolsBudget,
  }))
);
const ToolsAudience = lazy(() =>
  import("./components/ToolsAudience").then((module) => ({
    default: module.ToolsAudience,
  }))
);
const ToolsTriggers = lazy(() =>
  import("./components/ToolsTriggers").then((module) => ({
    default: module.ToolsTriggers,
  }))
);
const SmmPlan = lazy(() =>
  import("./components/SmmPlan").then((module) => ({
    default: module.SmmPlan,
  }))
);
const ContentIdeas = lazy(() =>
  import("./components/ContentIdeas").then((module) => ({
    default: module.ContentIdeas,
  }))
);
const InfluencerDashboard = lazy(() =>
  import("./components/InfluencerDashboard").then((module) => ({
    default: module.InfluencerDashboard,
  }))
);
const SettingsPage = lazy(() =>
  import("./components/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  }))
);
const CompetitorAnalysis = lazy(() =>
  import("./components/CompetitorAnalysis").then((module) => ({
    default: module.CompetitorAnalysis,
  }))
);
const AbTests = lazy(() =>
  import("./components/AbTests").then((module) => ({
    default: module.AbTests,
  }))
);
const MediaLibrary = lazy(() =>
  import("./components/MediaLibrary").then((module) => ({
    default: module.MediaLibrary,
  }))
);
const UnitEconomics = lazy(() =>
  import("./components/UnitEconomics").then((module) => ({
    default: module.UnitEconomics,
  }))
);
const HashtagSEO = lazy(() =>
  import("./components/HashtagSEO").then((module) => ({
    default: module.HashtagSEO,
  }))
);
const BrandVoice = lazy(() =>
  import("./components/BrandVoice").then((module) => ({
    default: module.BrandVoice,
  }))
);
const OKRTracker = lazy(() =>
  import("./components/OKRTracker").then((module) => ({
    default: module.OKRTracker,
  }))
);
const CustomerJourneyMap = lazy(() =>
  import("./components/CustomerJourneyMap").then((module) => ({
    default: module.CustomerJourneyMap,
  }))
);
const MarketingCalendar = lazy(() =>
  import("./components/MarketingCalendar").then((module) => ({
    default: module.MarketingCalendar,
  }))
);
const ContentStudio = lazy(() =>
  import("./components/ContentStudio").then((module) => ({
    default: module.ContentStudio,
  }))
);
const AutomationFlows = lazy(() =>
  import("./components/AutomationFlows").then((module) => ({
    default: module.AutomationFlows,
  }))
);
const RepurposeEngine = lazy(() =>
  import("./components/RepurposeEngine").then((module) => ({
    default: module.RepurposeEngine,
  }))
);
const ContentScoring = lazy(() =>
  import("./components/ContentScoring").then((module) => ({
    default: module.ContentScoring,
  }))
);
const PersonaBuilder = lazy(() =>
  import("./components/PersonaBuilder").then((module) => ({
    default: module.PersonaBuilder,
  }))
);
const FatigueDetector = lazy(() =>
  import("./components/FatigueDetector").then((module) => ({
    default: module.FatigueDetector,
  }))
);
const CampaignStoryline = lazy(() =>
  import("./components/CampaignStoryline").then((module) => ({
    default: module.CampaignStoryline,
  }))
);
const CompetitorSpy = lazy(() =>
  import("./components/CompetitorSpy").then((module) => ({
    default: module.CompetitorSpy,
  }))
);
const ProfilePage = lazy(() =>
  import("./components/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  }))
);
const MetricsTreePage = lazy(() =>
  import("./components/MetricsTreePage").then((module) => ({
    default: module.MetricsTreePage,
  }))
);
const PricingPage = lazy(() =>
  import("./components/PricingPage").then((module) => ({
    default: module.PricingPage,
  }))
);
const NotionHub = lazy(() =>
  import("./components/NotionHub").then((module) => ({
    default: module.NotionHub,
  }))
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: OnboardingPage,
  },
  {
    path: "/onboarding",
    loader: () => redirect("/"),
  },
  {
    path: "/payment/success",
    Component: PaymentSuccessPage,
  },
  {
    path: "/app",
    Component: Layout,
    children: [
      { index: true, Component: ProjectsList },
      { path: "calendar", Component: MarketingCalendar },
      { path: "project/:id", Component: ProjectDetail },
      { path: "tools/metrics", Component: ToolsMetrics },
      { path: "tools/budget", Component: ToolsBudget },
      { path: "tools/audience", Component: ToolsAudience },
      { path: "tools/triggers", Component: ToolsTriggers },
      { path: "smm/plan", Component: SmmPlan },
      { path: "smm/ideas", Component: ContentIdeas },
      { path: "smm/hashtags", Component: HashtagSEO },
      { path: "influencers", Component: InfluencerDashboard },
      { path: "competitors", Component: CompetitorAnalysis },
      { path: "competitor-spy", Component: CompetitorSpy },
      { path: "ab-tests", Component: AbTests },
      { path: "unit-economics", Component: UnitEconomics },
      { path: "media", Component: MediaLibrary },
      { path: "brand-voice", Component: BrandVoice },
      { path: "okr", Component: OKRTracker },
      { path: "cjm", Component: CustomerJourneyMap },
      { path: "personas", Component: PersonaBuilder },
      { path: "campaign-storyline", Component: CampaignStoryline },
      { path: "content-studio", Component: ContentStudio },
      { path: "repurpose", Component: RepurposeEngine },
      { path: "content-scoring", Component: ContentScoring },
      { path: "fatigue-detector", Component: FatigueDetector },
      { path: "automations", Component: AutomationFlows },
      { path: "settings", Component: SettingsPage },
      { path: "profile", Component: ProfilePage },
      { path: "metrics-tree", Component: MetricsTreePage },
      { path: "pricing", Component: PricingPage },
      { path: "notion", Component: NotionHub },
      { path: "*", Component: NotFound },
    ],
  },
]);