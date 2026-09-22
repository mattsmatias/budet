"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * "Lisää kotinäyttöön" -kortti.
 *
 * Androidilla ja Chromella selain antaa asennuskehotteen, jonka painike
 * avaa. iPhonella kehotetta ei ole, joten näytetään kaksi askelta Jaa-
 * valikon kautta. Kortti ei näy lainkaan, jos Kate on jo avattu
 * kotinäytöltä: asennetulle ei kannata tarjota asennusta.
 */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "hidden" | "prompt" | "ios";

function subscribe() {
  return () => {};
}

function standalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

export function InstallCard({ t }: { t: AdminText }) {
  const installed = useSyncExternalStore(subscribe, standalone, () => true);
  const ios = useSyncExternalStore(subscribe, isIos, () => false);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const mode: Mode = installed ? "hidden" : event ? "prompt" : ios ? "ios" : "hidden";

  if (done) {
    return (
      <div className="rf-install" role="status">
        <p className="text-[14px] font-semibold">{t.loput.installDone}</p>
      </div>
    );
  }

  if (mode === "hidden") return null;

  return (
    <div className="rf-install">
      <div className="flex items-start gap-3.5">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="shrink-0 rounded-[11px]"
        />
        <div className="min-w-0">
          <p className="text-[15px] font-bold tracking-[-0.01em]">
            {t.loput.installTitle}
          </p>
          <p
            className="mt-1 text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.loput.installBody}
          </p>
        </div>
      </div>

      {mode === "prompt" && event ? (
        <button
          type="button"
          className="rf-press rf-install-button mt-3.5 w-full"
          onClick={async () => {
            await event.prompt();
            const choice = await event.userChoice;
            if (choice.outcome === "accepted") setDone(true);
            setEvent(null);
          }}
        >
          {t.loput.installButton}
        </button>
      ) : (
        <ol className="mt-3.5 space-y-2 text-[13px]">
          <li className="flex items-center gap-2.5">
            <span className="rf-install-step">1</span>
            <span className="flex items-center gap-1.5">
              {t.loput.installIosStep1}
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                aria-hidden="true"
                style={{ color: "var(--rf-blue)" }}
              >
                <path
                  d="M12 15V3.5M8 7.5l4-4 4 4M6.5 11H5v9.5h14V11h-1.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="rf-install-step">2</span>
            {t.loput.installIosStep2}
          </li>
        </ol>
      )}
    </div>
  );
}
