import { Hono, type MiddlewareHandler } from "hono";
import type { ResourceType } from "../modules/authorization/service.js";

export interface ResourcesRouteDependencies {
  createResourceAuthorization(resourceType: ResourceType): MiddlewareHandler;
}

export const createResourcesRoutes = ({
  createResourceAuthorization
}: ResourcesRouteDependencies) => {
  const resources = new Hono();

  resources.get("/reports/:id", createResourceAuthorization("report"), (c) => {
    const auth = c.get("resourceAuth");
    return c.json({ ok: true, resourceType: "report", studentId: auth.studentId, resourceId: auth.resourceId });
  });

  resources.get("/tasks/:id", createResourceAuthorization("task"), (c) => {
    const auth = c.get("resourceAuth");
    return c.json({ ok: true, resourceType: "task", studentId: auth.studentId, resourceId: auth.resourceId });
  });

  resources.get("/certificates/:id", createResourceAuthorization("certificate"), (c) => {
    const auth = c.get("resourceAuth");
    return c.json({ ok: true, resourceType: "certificate", studentId: auth.studentId, resourceId: auth.resourceId });
  });

  resources.get("/profiles/:id", createResourceAuthorization("profile"), (c) => {
    const auth = c.get("resourceAuth");
    return c.json({ ok: true, resourceType: "profile", studentId: auth.studentId, resourceId: auth.resourceId });
  });

  return resources;
};

export default createResourcesRoutes;
