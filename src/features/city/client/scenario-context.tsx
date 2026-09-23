"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { useScenarioController } from "./use-scenario-controller";

export type ScenarioController = ReturnType<typeof useScenarioController>;

const ScenarioControllerContext = createContext<ScenarioController | null>(null);

export function ScenarioControllerProvider({ value, children }: { value: ScenarioController; children: ReactNode }) {
  return <ScenarioControllerContext.Provider value={value}>{children}</ScenarioControllerContext.Provider>;
}

export function useScenario() {
  const value = useContext(ScenarioControllerContext);
  if (!value) throw new Error("useScenario must be used inside ScenarioShell");
  return value;
}
