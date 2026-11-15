"use client";

import { UserButton } from "@clerk/nextjs";
import { Gem, KeyRound } from "lucide-react";

/** The user menu. Plans and AI & API keys live here instead of the main nav. Client-only: UserButton's compound parts can't be reached from a server component. */
export function AccountMenu({ showName }: { showName?: boolean }) {
  return (
    <UserButton showName={showName}>
      <UserButton.MenuItems>
        <UserButton.Link label="Plans" href="/pricing" labelIcon={<Gem className="size-4" />} />
        <UserButton.Link label="AI & API keys" href="/settings" labelIcon={<KeyRound className="size-4" />} />
      </UserButton.MenuItems>
    </UserButton>
  );
}
