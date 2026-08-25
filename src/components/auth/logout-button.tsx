"use client";

import { useFormStatus } from "react-dom";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

function LogoutSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" className="w-full md:w-auto" disabled={pending}>
      {pending ? "Signing out…" : "Logout"}
    </Button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <LogoutSubmit />
    </form>
  );
}
