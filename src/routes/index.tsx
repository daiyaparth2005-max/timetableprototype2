import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tm_current_user");
    throw redirect({ to: raw ? "/dashboard" : "/login" });
  },
  component: () => null,
});
