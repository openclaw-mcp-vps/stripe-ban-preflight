"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Loader2, LockKeyhole } from "lucide-react";

interface PricingCheckoutProps {
  isUnlocked: boolean;
}

export default function PricingCheckout({ isUnlocked }: PricingCheckoutProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);

  const checkoutUrl = useMemo(() => {
    const productId = process.env.NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID;

    if (!productId) {
      return null;
    }

    const params = new URLSearchParams({
      embed: "1",
      logo: "0",
      media: "0",
      "checkout[custom][source]": "stripe-ban-preflight",
    });

    return `https://checkout.lemonsqueezy.com/buy/${productId}?${params.toString()}`;
  }, []);

  const onUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setUnlockLoading(true);
    setUnlockMessage(null);

    try {
      const response = await fetch("/api/lemonsqueezy/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ?? "Purchase not found yet. Wait a minute and retry activation.",
        );
      }

      setUnlockMessage("Access unlocked. Redirecting to your dashboard...");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setUnlockMessage(
        error instanceof Error ? error.message : "Unable to verify purchase",
      );
    } finally {
      setUnlockLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Script src="https://app.lemonsqueezy.com/js/lemon.js" strategy="afterInteractive" />

      {isUnlocked ? (
        <a
          href="/dashboard"
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#238636] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2ea043]"
        >
          Open dashboard
        </a>
      ) : checkoutUrl ? (
        <a
          href={checkoutUrl}
          className="lemonsqueezy-button inline-flex w-full items-center justify-center rounded-xl bg-[#238636] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2ea043]"
        >
          Start preflight at $19/mo
        </a>
      ) : (
        <p className="rounded-xl border border-[#f0883e]/50 bg-[#f0883e]/10 p-3 text-sm text-[#f6b58c]">
          Set `NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID` to enable checkout overlay.
        </p>
      )}

      {!isUnlocked ? (
        <form onSubmit={onUnlock} className="space-y-3 rounded-xl border border-white/10 bg-[#0d1117] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#c9d1d9]">
            <LockKeyhole className="h-4 w-4 text-[#58a6ff]" />
            Already purchased? Unlock access
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="billing@yourcompany.com"
            className="w-full rounded-lg border border-white/15 bg-[#161b22] px-3 py-2 text-sm text-[#f0f6fc] outline-none transition focus:border-[#58a6ff]"
          />
          <button
            type="submit"
            disabled={unlockLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-[#c9d1d9] transition hover:border-[#58a6ff] hover:text-[#58a6ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {unlockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verify purchase and unlock
          </button>
          {unlockMessage ? (
            <p className="text-xs text-[#9ea7b3]">{unlockMessage}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
