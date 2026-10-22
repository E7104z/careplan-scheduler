import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  icon?: ReactNode;
  destructive?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  label?: string;
}

export function Menu({ trigger, items, label }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className="z-50 min-w-[180px] rounded-md border border-line bg-surface p-1 shadow-pop"
        >
          {label ? (
            <DropdownMenu.Label className="px-2 py-1 text-[13px] font-medium text-ink-3">
              {label}
            </DropdownMenu.Label>
          ) : null}
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink outline-none focus:bg-sunk",
                item.destructive && "text-block",
              )}
            >
              {item.icon}
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
