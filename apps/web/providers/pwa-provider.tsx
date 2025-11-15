"use client";

import { useEffect } from "react";

export function PWAProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              const event = new CustomEvent("pwa:update-available");
              window.dispatchEvent(event);
            }
          });
        });
      } catch (error) {
        console.error("No se pudo registrar el service worker", error);
      }
    };

    register();

    const handleBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      window.deferredPWAInstallPrompt = event;
      window.dispatchEvent(new CustomEvent("pwa:install-available"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  return null;
}

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  interface Window {
    deferredPWAInstallPrompt?: BeforeInstallPromptEvent;
  }
}
