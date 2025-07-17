"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LayoutDashboard, Package, ShoppingCart, History, Settings, Menu, ClipboardCheck, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  {
    name: "ダッシュボード",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "在庫管理",
    href: "/inventory",
    icon: Package,
    children: [
      {
        name: "在庫状況",
        href: "/inventory",
        icon: Package,
      },
      {
        name: "在庫点検",
        href: "/inventory/check",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    name: "発注管理",
    href: "/orders",
    icon: ShoppingCart,
    children: [
      {
        name: "手動発注",
        href: "/orders/manual",
        icon: Plus,
      },
      {
        name: "注文履歴",
        href: "/orders/history",
        icon: History,
      },
    ],
  },
  {
    name: "商品管理",
    href: "/products",
    icon: Package,
  },
  {
    name: "設定",
    href: "/settings",
    icon: Settings,
  },
]

function NavigationItems() {
  const pathname = usePathname()

  return (
    <nav className="space-y-2">
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

        return (
          <div key={item.name}>
            <Link href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn("w-full justify-start gap-2", isActive && "bg-secondary")}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Button>
            </Link>

            {item.children && isActive && (
              <div className="ml-6 mt-2 space-y-1">
                {item.children.map((child) => {
                  const isChildActive = pathname === child.href
                  return (
                    <Link key={child.href} href={child.href}>
                      <Button
                        variant={isChildActive ? "secondary" : "ghost"}
                        size="sm"
                        className={cn("w-full justify-start gap-2", isChildActive && "bg-secondary")}
                      >
                        <child.icon className="w-3 h-3" />
                        {child.name}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow pt-5 bg-background border-r overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-bold">消耗品管理</h1>
          </div>
          <div className="mt-8 flex-grow flex flex-col px-4">
            <NavigationItems />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div className="md:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-16 px-4 bg-background border-b">
          <h1 className="text-xl font-bold">消耗品管理</h1>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <div className="mt-8">
                <NavigationItems />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="h-16" /> {/* Spacer for fixed header */}
      </div>

      {/* Desktop content offset */}
      <div className="hidden md:block md:pl-64" />
    </>
  )
}
