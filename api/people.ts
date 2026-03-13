import type { VercelRequest, VercelResponse } from "@vercel/node";

const HIBOB_API_URL = "https://api.hibob.com/v1/people/search";

const WEBSITE_HUB_FIELD = "field_1773332818757";

interface HibobEmployee {
  id?: string;
  firstName?: string;
  displayName?: string;
  avatarUrl?: string;
  custom?: Record<string, unknown>;
  work?: {
    title?: string;
    department?: string;
  };
}

interface HibobSearchResponse {
  employees: HibobEmployee[];
}

interface PersonRecord {
  id: string;
  name: string;
  role: string;
  department: string;
  avatarUrl: string;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if ("name" in item && typeof item.name === "string") return item.name;
          if ("value" in item && typeof item.value === "string")
            return item.value;
        }
        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getWebsiteHubValues(employee: HibobEmployee): string[] {
  return toStringArray(employee.custom?.[WEBSITE_HUB_FIELD]);
}

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function setCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers["origin"] as string | undefined;
  const allowedOrigins = getAllowedOrigins();

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
    return true;
  }

  // Origin not in allowlist — no CORS headers set, browser will block the response
  return false;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    setCorsHeaders(req, res);
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  setCorsHeaders(req, res);

  const hubParam = req.query["hub"];
  const hub = typeof hubParam === "string" ? hubParam.trim() : "";

  const serviceUserId = process.env.HIBOB_SERVICE_USER_ID;
  const token = process.env.HIBOB_TOKEN;

  if (!serviceUserId || !token) {
    console.error("Hibob credentials not configured");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  const credentials = Buffer.from(`${serviceUserId}:${token}`).toString(
    "base64",
  );

  const searchBody = {
    humanReadable: "REPLACE",
    showInactive: false,
  };

  let hibobResponse: Response;
  try {
    hibobResponse = await fetch(HIBOB_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(searchBody),
    });
  } catch (err) {
    console.error("Failed to reach Hibob API:", err);
    res.status(502).json({ error: "Failed to reach Hibob API" });
    return;
  }

  if (!hibobResponse.ok) {
    console.error("Hibob API error:", hibobResponse.status);
    res.status(502).json({ error: "Hibob API returned an error" });
    return;
  }

  const data = (await hibobResponse.json()) as HibobSearchResponse;
  const employees = data.employees ?? [];

  const requestedHubs = hub
    ? new Set(
        hub
          .split(",")
          .map((value) => slugify(value))
          .filter(Boolean),
      )
    : null;

  const people: PersonRecord[] = employees
    .filter((emp) => {
      if (!requestedHubs || requestedHubs.size === 0) return true;

      const employeeHubs = getWebsiteHubValues(emp).map(slugify);
      return employeeHubs.some((employeeHub) => requestedHubs.has(employeeHub));
    })
    .map((emp) => ({
      id: emp.id ?? "",
      name: emp.firstName ?? emp.displayName ?? "",
      role: emp.work?.title ?? "",
      department: emp.work?.department ?? "",
      avatarUrl: emp.avatarUrl ?? "",
    }));

  res.status(200).json(people);
}
