import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/crm/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/crm/pipelines" });
  },
});