"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { SignOutButton } from "./sign-out";

type IconName =
  | "dashboard"
  | "calendar"
  | "clock"
  | "edit"
  | "upload"
  | "download"
  | "users"
  | "layers";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  icon: IconName;
}

interface Section {
  title: string;
  items: NavItem[];
}

const SECTIONS: Section[] = [
  {
    title: "Reports",
    items: [
      { href: "/dashboard", label: "Daily dashboard", roles: ["admin", "editor", "viewer"], icon: "dashboard" },
      { href: "/monthly", label: "Monthly summary", roles: ["admin", "editor", "viewer"], icon: "calendar" },
      { href: "/twelve-hour", label: "12-hour report", roles: ["admin", "editor", "viewer"], icon: "clock" },
      { href: "/export", label: "Export report", roles: ["admin", "editor", "viewer"], icon: "download" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/entry", label: "Data entry", roles: ["admin", "editor"], icon: "edit" },
      { href: "/import", label: "Bulk import", roles: ["admin", "editor"], icon: "upload" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/users", label: "Users & roles", roles: ["admin"], icon: "users" },
      { href: "/admin/networks", label: "Accounts & apps", roles: ["admin"], icon: "layers" },
    ],
  },
];

export function Nav({ role, email }: { role: UserRole; email: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gray-900 text-gray-100">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold shadow-lg shadow-brand-900/40">
          G
        </div>
        <div className="text-sm font-semibold leading-tight">
          Gaming Apps
          <div className="text-[11px] font-normal text-gray-400">
            Revenue dashboard
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => i.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-brand-600 font-medium text-white shadow-sm"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        className={active ? "text-white" : "text-gray-400 group-hover:text-gray-200"}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-1 flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold uppercase">
            {(email ?? "?").slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-gray-200">{email}</div>
            <span className="chip mt-0.5 bg-white/10 uppercase tracking-wide text-gray-300">
              {role}
            </span>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `shrink-0 ${className ?? ""}`,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5M12 3v12" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
  }
}
