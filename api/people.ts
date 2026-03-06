import type { VercelRequest, VercelResponse } from "@vercel/node";

const HIBOB_API_URL = "https://api.hibob.com/v1/people/search";

// Custom column ID in HiBob that stores the team name
const TEAM_COLUMN = "column_1683672972880";

// Maps Framer CMS "Parent Hub" slugs to HiBob team column values.
// Derived from docs/cms.csv cross-referenced against live HiBob data.
// Empty hub prop → show all employees (no filter applied).
const HUB_TEAMS: Record<string, string[]> = {
  "ai": ["AI Products"],
  "client-services": ["Customer Delivery", "Customer Leadership", "Customer PM", "Customer Support", "Learning"],
  "customer-success": ["Customer Success"],
  "design": ["Product Design"],
  "engineering": ["Delivery", "Development", "Engineering Management", "Quality"],
  "field-engineering": ["Field Engineering", "Solutions Engineering"],
  "finance": ["Control", "FP&A"],
  "legal-infosec": ["Legal, Risk & Compliance", "Operations"],
  "marketing-gtm-engineering": ["ABFM", "Corporate Marketing", "Product Marketing", "RevOps", "SDR"],
  "model-development": [], // No matching HiBob team found — returns empty
  "people": ["People"],
  "pricing-innovation": ["Pricing & Innovation"],
  "product": ["Product Management", "Product Ops"],
  "sales-partnerships": ["Account Executives - International", "Account Executives - North America", "Account Executives - Strategic Accounts", "Partners", "Sales"],
  "talent": ["Talent"],
};

interface HibobEmployee {
  id?: string;
  displayName?: string;
  avatarUrl?: string;
  work?: {
    title?: string;
    department?: string;
    customColumns?: Record<string, string>;
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

  const hubParam = req.query["hub"];
  const hub = typeof hubParam === "string" ? hubParam.trim() : "";

  // If a hub is provided but not recognised, return an empty list rather than
  // leaking internal team names via an error message.
  if (hub && !(hub in HUB_TEAMS)) {
    res.status(200).json([]);
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

  // Fetch all active employees with no field restriction — HiBob does not
  // expose the team custom column via a fieldPath specifier, so we receive
  // the full record and pick what we need below.
  // Filtering by team happens in JS because HiBob's search API does not
  // support filtering on custom column values.
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

  // Filter by hub team list (empty hub = show everyone)
  const allowedTeams = hub ? new Set(HUB_TEAMS[hub]) : null;

  const people: PersonRecord[] = employees
    .filter((emp) => {
      if (!allowedTeams) return true;
      const team = emp.work?.customColumns?.[TEAM_COLUMN] ?? "";
      return allowedTeams.has(team);
    })
    .map((emp) => ({
      id: emp.id ?? "",
      name: emp.displayName ?? "",
      role: emp.work?.title ?? "",
      department: emp.work?.department ?? "",
      avatarUrl: emp.avatarUrl ?? "",
    }));

  res.status(200).json(people);
}
