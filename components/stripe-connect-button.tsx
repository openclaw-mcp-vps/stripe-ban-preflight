import Link from "next/link";
import { Link2, ShieldCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StripeConnectButtonProps {
  connectedAccountId: string | null;
}

export function StripeConnectButton({ connectedAccountId }: StripeConnectButtonProps) {
  if (!process.env.STRIPE_CONNECT_CLIENT_ID) {
    return (
      <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Add `STRIPE_CONNECT_CLIENT_ID` to enable Stripe OAuth.
      </p>
    );
  }

  return (
    <Link
      href="/api/stripe/connect"
      className={cn(
        buttonVariants({
          variant: connectedAccountId ? "outline" : "default",
          size: "lg",
        }),
        connectedAccountId
          ? "gap-2 rounded-xl border-border bg-card text-foreground hover:bg-card/80"
          : "gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {connectedAccountId ? <ShieldCheck className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {connectedAccountId ? "Reconnect Stripe" : "Connect Stripe (Read-Only)"}
    </Link>
  );
}
