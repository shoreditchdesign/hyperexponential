import type { VercelRequest, VercelResponse } from "@vercel/node";

const HIBOB_API_URL = "https://api.hibob.com/v1/people/search";

interface HibobEmployee {
  id?: string;
  displayName?: string;
  avatarUrl?: string;
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
  res: VercelResponse
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

  const department = req.query["department"];
  if (!department || typeof department !== "string" || !department.trim()) {
    res.status(400).json({ error: "Missing required query parameter: department" });
    return;
  }

  const serviceUserId = process.env.HIBOB_SERVICE_USER_ID;
  const token = process.env.HIBOB_TOKEN;

  if (!serviceUserId || !token) {
    console.error("Hibob credentials not configured");
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  const credentials = Buffer.from(`${serviceUserId}:${token}`).toString("base64");

  const searchBody = {
    fields: ["id", "displayName", "avatarUrl", "work.title", "work.department"],
    filters: [
      {
        fieldPath: "work.department",
        operator: "equals",
        values: [department.trim()],
      },
    ],
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

  const people: PersonRecord[] = (data.employees ?? []).map((emp) => ({
    id: emp.id ?? "",
    name: emp.displayName ?? "",
    role: emp.work?.title ?? "",
    department: emp.work?.department ?? "",
    avatarUrl: emp.avatarUrl ?? "",
  }));

  res.status(200).json(people);
}
