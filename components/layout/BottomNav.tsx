"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserRound,
  Users,
  ClipboardList,
  FlaskConical,
  Wallet,
  Receipt,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Solo los 5 ítems más usados en móvil. El resto queda en "Más" (futuro). */
const mobileNavItems = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/atenciones", label: "Atenciones", icon: ClipboardList },
  { href: "/caja", label: "Caja", icon: Wallet },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full text-xs font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
