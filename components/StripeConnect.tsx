"use client";

import { useState } from "react";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";

interface StripeConnectProps {
  connectedAccountId: string | null;
}

export default function StripeConnect({ connectedAccountId }: StripeConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    window.location.href = "/api/stripe/connect";
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#161b22] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#f0f6fc]">Stripe Read-Only Access</h2>
          <p className="mt-1 text-sm text-[#9ea7b3]">
            Connect once, then we continuously score dispute and policy signals from your live Stripe account.
          </p>
          {connectedAccountId ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-[#2ea043]">
              <CheckCircle2 className="h-4 w-4" />
              Connected account: {connectedAccountId}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#f0883e]">No Stripe account connected yet.</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleConnect}
          disabled={isConnecting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#238636] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {connectedAccountId ? "Reconnect Stripe" : "Connect Stripe"}
        </button>
      </div>
    </section>
  );
}
