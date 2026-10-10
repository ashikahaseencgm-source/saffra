import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { setupApi } from "../../api/setup.js";
import logoIcon from "../../assets/logo.png";

/**
 * Runs before anything else in the router. A fresh install has no
 * restaurant/admin account yet, so every route — including /login — is
 * meaningless until the onboarding wizard finishes. This is the single
 * place that decides "wizard" vs "the real app", checked against the
 * server (not local storage) so it can't be bypassed by clearing browser
 * data and is consistent for every device on the LAN.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["setup", "status"],
    queryFn: setupApi.status,
    staleTime: Infinity,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <img src={logoIcon} alt="" className="h-12 w-12 animate-pulse rounded-2xl" />
      </div>
    );
  }

  const needsOnboarding = data?.needsOnboarding ?? false;

  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (!needsOnboarding && location.pathname === "/onboarding") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
