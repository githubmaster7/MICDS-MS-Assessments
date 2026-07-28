// Single source of truth for gender labels/colors, previously duplicated
// (with a real, since-fixed color bug) across admin/teachers, admin/groups,
// and admin/carousel as three independent local components.

export const GENDER_LABELS: Record<string, string> = { MALE: "Boys", FEMALE: "Girls" };

const BADGE_COLORS: Record<string, string> = {
  MALE: "bg-blue-50 text-blue-700 border-blue-100",
  FEMALE: "bg-pink-50 text-pink-700 border-pink-100",
};

const DOT_COLORS: Record<string, string> = {
  MALE: "bg-blue-400",
  FEMALE: "bg-pink-400",
};

export function GenderBadge({ gender }: { gender: string | null }) {
  if (!gender) return <span className="text-xs text-gray-400">Any</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${BADGE_COLORS[gender] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {GENDER_LABELS[gender] ?? gender}
    </span>
  );
}

export function GenderDot({ gender }: { gender: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${DOT_COLORS[gender] ?? "bg-gray-400"}`}
      title={GENDER_LABELS[gender] ?? gender}
    />
  );
}
