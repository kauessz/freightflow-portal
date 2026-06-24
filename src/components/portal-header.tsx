"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Building2, Map, Package, Ship, Users, Container } from "lucide-react";
import { AuthUserInfo } from "@/types";
import { Button } from "@/components/ui/button";

interface PortalHeaderProps {
  user?: AuthUserInfo | null;
  onLogout?: () => void;
  activePath?: string;
}

function isActive(pathname: string | undefined, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PortalHeader({
  user,
  onLogout,
  activePath,
}: PortalHeaderProps) {
  const links = useMemo(() => {
    const baseLinks = [
      { href: "/dashboard", label: "Shipments", icon: Package, show: true },
      { href: "/map", label: "Fleet Map", icon: Map, show: true },
      { href: "/dashboard/ports", label: "Ports", icon: Building2, show: true },
      { href: "/dashboard/vessels", label: "Vessels", icon: Ship, show: true },
      { href: "/dashboard/voyages", label: "Voyages", icon: Ship, show: true },
      {
        href: "/dashboard/cabotagem/import",
        label: "Cabotagem",
        icon: Container,
        show: user?.role === "ADMIN" || user?.role === "OPERATOR",
      },
      {
        href: "/dashboard/customers",
        label: "Customers",
        icon: Building2,
        show: user?.role !== "CLIENT",
      },
      {
        href: "/dashboard/users",
        label: "Users",
        icon: Users,
        show: user?.role === "ADMIN",
      },
    ];

    return baseLinks.filter((link) => link.show);
  }, [user]);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <Ship className="h-6 w-6 text-primary" />
          <Link href="/dashboard" className="text-xl font-bold">
            FreightFlow
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(activePath, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden xl:inline text-sm text-muted-foreground">
              {user.name} · <span className="text-xs font-medium">{user.role}</span>
            </span>
          )}
          {onLogout && (
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
