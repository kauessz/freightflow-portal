"use client";

import Link from "next/link";
import { Anchor, Building2, Ship } from "lucide-react";

interface MasterDataNavProps {
  activePath: string;
}

const ITEMS = [
  { href: "/dashboard/ports", label: "Ports", icon: Building2 },
  { href: "/dashboard/vessels", label: "Vessels", icon: Ship },
  { href: "/dashboard/voyages", label: "Voyages", icon: Anchor },
];

export default function MasterDataNav({ activePath }: MasterDataNavProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activePath === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
              active
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
