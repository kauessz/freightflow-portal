"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
  unauthorizedTo?: string;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function RequireAuth({
  children,
  allowedRoles,
  redirectTo = "/login",
  unauthorizedTo = "/dashboard",
}: RequireAuthProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(redirectTo);
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      router.replace(unauthorizedTo);
    }
  }, [allowedRoles, isAuthenticated, isLoading, redirectTo, router, unauthorizedTo, user]);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <FullPageSpinner />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
