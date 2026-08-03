"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Props = {
  label: string;
};

export function SignOutButton({ label }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Even if the call to Supabase fails, we still want to clear the
      // local session and redirect away from the protected area.
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="ps-btn ps-btn--danger"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "…" : label}
    </button>
  );
}
