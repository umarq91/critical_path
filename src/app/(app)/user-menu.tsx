"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABEL, type Role } from "@/constants/roles";
import { signOut } from "@/app/auth/_actions";
import { initials } from "@/lib/utils";

type Profile = {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: Role;
};

export function UserMenu({ profile }: { profile: Profile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-accent-teal text-text-inverse">
            {initials(profile.full_name, profile.email)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden flex-col items-start sm:flex">
          <span className="text-label text-foreground">{profile.full_name ?? profile.email}</span>
          <span className="text-caption text-muted-foreground">{ROLE_LABEL[profile.role]}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="font-medium">{profile.full_name ?? profile.email}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {profile.email} · {ROLE_LABEL[profile.role]}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
