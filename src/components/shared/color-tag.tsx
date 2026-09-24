import { Badge } from "@/components/ui/badge";

interface ColorTagProps {
  label: string;
  color: string;
}

// Generic coloured label — season tag, brand tag, key-stage tag, DPSP category, delay-reason
// tag all render through this, driven by whatever hex value the entity itself stores
// (seasons.color, brands.color, ...) rather than a fixed config map like StatusBadge, which
// is why the colours are inline style, not Tailwind classes — an arbitrary user-picked hex
// has no matching utility. `1a` suffix on the background is a hex alpha (~10% opacity), same
// tint-over-border-and-text treatment as the status badges.
export const ColorTag = ({ label, color }: ColorTagProps) => {
  return (
    <Badge
      variant="outline"
      className="max-w-full"
      style={{ borderColor: color, color, backgroundColor: `${color}1a` }}
      title={label}
    >
      <span className="truncate">{label}</span>
    </Badge>
  );
};
