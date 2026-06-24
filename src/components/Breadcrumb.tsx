"use client";

import Link from "next/link";
import { Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  /** If omitted the item is treated as the current page — rendered as plain text */
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4">
      {items.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {/* Separator — rendered before every item except the first */}
            {!isFirst && (
              <span className="text-muted-foreground select-none">/</span>
            )}

            {/* Home icon only on the first item */}
            {isFirst && (
              <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}

            {/* Link or plain text */}
            {!isLast && item.href ? (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
