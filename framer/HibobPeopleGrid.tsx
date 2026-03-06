import { addPropertyControls, ControlType } from "framer";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

// ─── Config ─────────────────────────────────────────────────────────────────
// All brand tokens and layout values live here.
// Edit this section to update the component across the board.

// API proxy
const DEFAULT_PROXY_URL = "https://hyperexponential-sd.vercel.app";

// Load more
const ITEMS_PER_PAGE = 6; // people revealed per "Load more" click

// Grid spacing
const COLUMN_GAP = 24; // px
const ROW_GAP = 32; // px

// Avatar
const AVATAR_SIZE = 48; // px
const AVATAR_FALLBACK_FONT_SIZE = 14; // px
const AVATAR_FALLBACK_COLOR = "#999999";
const AVATAR_FALLBACK_BACKGROUND = "#e8e8e8";
const AVATAR_ITEM_GAP = 12; // px gap between avatar and text column

// Name (primary text)
const NAME_FONT_FAMILY = '"FFF Acid Grotesk Book", sans-serif';
const NAME_FONT_SIZE = "16px";
const NAME_FONT_WEIGHT = 350;
const NAME_LINE_HEIGHT = "160%";
const NAME_COLOR = "#5d5d5d";

// Role (secondary text)
const ROLE_FONT_FAMILY =
  '"FFF Acid Grotesk Normal", "FFF Acid Grotesk Normal Placeholder", sans-serif';
const ROLE_FONT_SIZE = "12px";
const ROLE_FONT_WEIGHT = 400;
const ROLE_LINE_HEIGHT = "150%";
const ROLE_COLOR = "#505862";

// Load more button tokens
const FONT_FAMILY = "FFF Acid Grotesk, sans-serif";
const ACTIVE_TEXT_COLOR = "#F7F7F7";
const TEXT_SIZE = "14px";
const TEXT_WEIGHT = 500;
const LINE_HEIGHT = "150%";
const TAB_PADDING_VERTICAL = "8px";
const TAB_PADDING_HORIZONTAL = "16px";
const PAGINATION_BACKGROUND_COLOR = "#0F1924";
const BORDER_RADIUS = "150px";

const baseButtonStyles: CSSProperties = {
  padding: `${TAB_PADDING_VERTICAL} ${TAB_PADDING_HORIZONTAL}`,
  fontFamily: FONT_FAMILY,
  fontSize: TEXT_SIZE,
  fontWeight: TEXT_WEIGHT,
  lineHeight: LINE_HEIGHT,
  border: "none",
  background: PAGINATION_BACKGROUND_COLOR,
  color: ACTIVE_TEXT_COLOR,
  cursor: "pointer",
  borderRadius: BORDER_RADIUS,
  transition: "all 0.2s ease",
  whiteSpace: "nowrap" as const,
  minWidth: "80px",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface Person {
  id: string;
  name: string;
  role: string;
  department: string;
  avatarUrl: string;
}

interface HibobPeopleGridProps {
  hub: string;
  proxyUrl: string;
  totalNumber: string;
  cellsPerPage: number;
  columns: number;
  style?: CSSProperties;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
// Matches the error-fallback pattern from docs/example.tsx.
// Tries the Hibob avatarUrl; falls back to an initials circle.

function Avatar({ src, name }: { src: string; name: string }) {
  const [hasError, setHasError] = useState(false);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sharedStyle: CSSProperties = {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: "50%",
    flexShrink: 0,
  };

  if (!src || hasError) {
    return (
      <div
        style={{
          ...sharedStyle,
          background: AVATAR_FALLBACK_BACKGROUND,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: NAME_FONT_FAMILY,
          fontSize: AVATAR_FALLBACK_FONT_SIZE,
          fontWeight: NAME_FONT_WEIGHT,
          color: AVATAR_FALLBACK_COLOR,
          userSelect: "none",
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setHasError(true)}
      style={{ ...sharedStyle, objectFit: "cover" }}
    />
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: AVATAR_ITEM_GAP }}
    >
      <div
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: "50%",
          background: "#ebebeb",
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            width: 120,
            height: 13,
            borderRadius: 4,
            background: "#ebebeb",
          }}
        />
        <div
          style={{
            width: 80,
            height: 11,
            borderRadius: 4,
            background: "#f3f3f3",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 */
export default function HibobPeopleGrid(props: HibobPeopleGridProps) {
  const { hub, proxyUrl, totalNumber, cellsPerPage, columns, style } = props;
  const resolvedProxyUrl = proxyUrl || DEFAULT_PROXY_URL;
  const pageSize =
    Number.isFinite(cellsPerPage) && cellsPerPage > 0
      ? Math.floor(cellsPerPage)
      : ITEMS_PER_PAGE;

  const parsedTotalNumber = Number.parseInt(totalNumber, 10);
  const totalLimit =
    Number.isFinite(parsedTotalNumber) && parsedTotalNumber > 0
      ? parsedTotalNumber
      : null;

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setPeople([]);
    setVisibleCount(pageSize);

    const url = hub
      ? `${resolvedProxyUrl}/api/people?hub=${encodeURIComponent(hub)}`
      : `${resolvedProxyUrl}/api/people`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Person[]>;
      })
      .then((data) => {
        setPeople(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [hub, resolvedProxyUrl]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize]);

  const gridStyle: CSSProperties = {
    width: "100%",
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    columnGap: COLUMN_GAP,
    rowGap: ROW_GAP,
    ...style,
  };

  const nameStyle: CSSProperties = {
    fontFamily: NAME_FONT_FAMILY,
    fontSize: NAME_FONT_SIZE,
    fontWeight: NAME_FONT_WEIGHT,
    lineHeight: NAME_LINE_HEIGHT,
    color: NAME_COLOR,
    margin: 0,
  };

  const roleStyle: CSSProperties = {
    fontFamily: ROLE_FONT_FAMILY,
    fontSize: ROLE_FONT_SIZE,
    fontWeight: ROLE_FONT_WEIGHT,
    lineHeight: ROLE_LINE_HEIGHT,
    color: ROLE_COLOR,
    margin: 0,
  };

  if (loading) {
    return (
      <div style={gridStyle}>
        {Array.from({ length: columns * 2 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: "100%", ...roleStyle, opacity: 0.6 }}>
        Unable to load team members.
      </div>
    );
  }

  if (people.length === 0 && hub) {
    return (
      <div style={{ width: "100%", ...roleStyle, opacity: 0.6 }}>
        No team members found for &ldquo;{hub}&rdquo;.
      </div>
    );
  }

  const limitedPeople = totalLimit ? people.slice(0, totalLimit) : people;
  const visiblePeople = limitedPeople.slice(0, visibleCount);
  const remaining = limitedPeople.length - visibleCount;
  const nextBatch = Math.min(pageSize, remaining);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}
    >
      <div style={gridStyle}>
        {visiblePeople.map((person) => (
          <div
            key={person.id || person.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: AVATAR_ITEM_GAP,
            }}
          >
            <Avatar src={person.avatarUrl} name={person.name} />
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={nameStyle}>{person.name}</span>
              <span style={roleStyle}>{person.role}</span>
            </div>
          </div>
        ))}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount((v) => v + pageSize)}
          style={baseButtonStyles}
        >
          Load {nextBatch} more
        </button>
      )}
    </div>
  );
}

// ─── Framer property controls ────────────────────────────────────────────────
// Only data and layout props that may vary per page instance.
// Visual tokens are managed in the Config section above.

addPropertyControls(HibobPeopleGrid, {
  hub: {
    type: ControlType.String,
    title: "Hub",
    defaultValue: "",
    placeholder: "e.g. engineering",
    description:
      "Connect to the CMS 'Parent Hub' slug. Leave empty to show all employees.",
  },
  proxyUrl: {
    type: ControlType.String,
    title: "Proxy URL",
    defaultValue: DEFAULT_PROXY_URL,
    description: "Base URL of the Vercel deployment. No trailing slash.",
  },
  totalNumber: {
    type: ControlType.String,
    title: "Total Number",
    defaultValue: "",
    placeholder: "e.g. 12",
    description: "Maximum people to show. Leave empty to show all.",
  },
  cellsPerPage: {
    type: ControlType.Number,
    title: "Cells / Page",
    defaultValue: ITEMS_PER_PAGE,
    min: 1,
    step: 1,
    displayStepper: true,
  },
  columns: {
    type: ControlType.Number,
    title: "Columns",
    defaultValue: 4,
    min: 1,
    max: 6,
    step: 1,
    displayStepper: true,
  },
});
