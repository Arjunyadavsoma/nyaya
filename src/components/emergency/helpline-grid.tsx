"use client";

import { Phone, MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Helpline {
  number: string;
  label: string;
  category: string;
  description?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  police: "Police",
  fire: "Fire",
  medical: "Medical",
  women: "Women",
  child: "Children",
  cyber: "Cyber",
  senior: "Senior Citizens",
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "border-primary/30 bg-primary/5",
  police: "border-primary/30 bg-primary/5",
  fire: "border-emergency/30 bg-emergency/5",
  medical: "border-success/30 bg-success/5",
  women: "border-accent/30 bg-accent/5",
  child: "border-accent/30 bg-accent/5",
  cyber: "border-chart-5/30 bg-chart-5/5",
  senior: "border-warning/30 bg-warning/5",
};

export function HelplineGrid({ helplines }: { helplines: Helpline[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {helplines.map((h) => (
        <a
          key={h.number}
          href={`tel:${h.number}`}
          className={`group rounded-lg border p-3 hover:shadow-md transition-all ${CATEGORY_COLORS[h.category] ?? "border-border bg-card"}`}
        >
          <div className="flex items-center justify-between mb-1">
            <Phone className="h-4 w-4 text-emergency" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[h.category] ?? h.category}
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground">{h.number}</div>
          <div className="text-xs font-medium mt-0.5 leading-tight">{h.label}</div>
          {h.description && (
            <div className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-2">{h.description}</div>
          )}
        </a>
      ))}
    </div>
  );
}

export function NearbyStationCard({ station, distance }: { station: { name: string; address: string; phone?: string | null }; distance?: number }) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate">{station.name}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 ml-6">{station.address}</div>
          {distance != null && <div className="text-xs text-primary mt-1 ml-6">{distance.toFixed(1)} km away</div>}
        </div>
        {station.phone && (
          <a href={`tel:${station.phone}`} className="tap-target shrink-0 inline-flex items-center justify-center rounded-md bg-emergency/10 text-emergency px-3 hover:bg-emergency/20 transition-colors" aria-label={`Call ${station.name}`}>
            <Phone className="h-4 w-4" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
