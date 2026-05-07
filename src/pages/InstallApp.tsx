import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import {
  Download, Smartphone, Share, Plus, CheckCircle2, Apple, Chrome, ScanLine,
  ArrowRight, Wifi, WifiOff, Link2, Copy, RefreshCw, QrCode, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useMobileScanner } from "@/hooks/useMobileScanner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [answerInput, setAnswerInput] = useState("");
  const scanner = useMobileScanner();

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone);
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isPreviewHost = typeof window !== "undefined" && (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  );
  const publishedUrl = "https://easy-kisti-shop.lovable.app";

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const installedHandler = () => {
      setInstalled(true); setDeferred(null);
      toast.success("অ্যাপ সফলভাবে ইনস্টল হয়েছে! 🎉");
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (isInIframe || isPreviewHost) {
      window.open(publishedUrl, "_blank", "noopener,noreferrer");
      toast.info("ইনস্টল করতে অ্যাপটি নতুন ট্যাবে খোলা হলো — সেখান থেকে ইনস্টল করুন।");
      return;
    }
    if (!deferred) {
      if (isAndroid) {
        toast.info("ব্রাউজার মেনু (⋮) → 'Install app' / 'Add to Home screen' ব্যবহার করুন।");
      } else {
        toast.info("ইনস্টল প্রম্পট এখনই উপলব্ধ নয়। ব্রাউজার মেনু থেকে ইনস্টল করুন।");
      }
      return;
    }
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") toast.success("ইনস্টল হচ্ছে...");
      else toast.info("ইনস্টল বাতিল হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "ইনস্টল করা যায়নি");
    } finally {
      setDeferred(null);
    }
  };

  const openPublished = () => window.open(publishedUrl, "_blank", "noopener,noreferrer");

  const submitAnswer = async () => {
    try {
      await scanner.submitAnswer(answerInput);
      setAnswerInput("");
      toast.success("Answer গৃহীত — সংযোগের অপেক্ষায়");
    } catch (e: any) {
      toast.error(e?.message || "Answer গ্রহণ করা যায়নি");
    }
  };

  const phaseBadge = useMemo(() => {
    switch (scanner.phase) {
      case "connected": return { color: "text-primary bg-primary/10", icon: <Wifi className="h-4 w-4" />, text: "Connected" };
      case "offer-ready": return { color: "text-amber-600 bg-amber-500/10", icon: <QrCode className="h-4 w-4" />, text: "QR প্রস্তুত" };
      case "preparing": return { color: "text-muted-foreground bg-muted", icon: <Loader2 className="h-4 w-4 animate-spin" />, text: "প্রস্তুত হচ্ছে" };
      case "failed": return { color: "text-destructive bg-destructive/10", icon: <WifiOff className="h-4 w-4" />, text: "ব্যর্থ" };
      default: return { color: "text-muted-foreground bg-muted", icon: <WifiOff className="h-4 w-4" />, text: "Disconnected" };
    }
  }, [scanner.phase]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-lg">
          <Smartphone className="h-8 w-8" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">অ্যাপ ইনস্টল ও Scanner Pairing</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          আপনার মূল POS অ্যাপ ইনস্টল করুন এবং মোবাইলকে wireless barcode scanner বানান
        </p>
      </div>

      {/* === Main POS install card === */}
      {isStandalone || installed ? (
        <Card className="p-6 flex items-center gap-4 border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-10 w-10 text-primary shrink-0" />
          <div>
            <h3 className="font-bold">মূল অ্যাপ ইনস্টল করা আছে</h3>
            <p className="text-sm text-muted-foreground">আপনি বর্তমানে ইনস্টল করা অ্যাপটি ব্যবহার করছেন।</p>
          </div>
        </Card>
      ) : (
        <Card className="p-6 md:p-8 text-center space-y-4">
          <Download className="h-12 w-12 mx-auto text-primary" />
          <div>
            <h2 className="text-xl font-bold mb-1">মূল POS অ্যাপ ইনস্টল করুন</h2>
            <p className="text-sm text-muted-foreground">
              {isIOS
                ? "iOS-এ Safari থেকে নিচের ধাপ অনুসরণ করুন"
                : deferred
                ? "নিচের বাটনে ক্লিক করে এখনই ইনস্টল করুন"
                : "ব্রাউজার ইনস্টল প্রম্পট প্রস্তুত হলে বাটন সক্রিয় হবে। নিচের ম্যানুয়াল ধাপগুলোও দেখুন।"}
            </p>
          </div>
          {!isIOS && (
            <Button size="lg" onClick={handleInstall} className="gradient-primary text-primary-foreground">
              <Download className="h-5 w-5" /> এখনই ইনস্টল করুন
            </Button>
          )}
        </Card>
      )}

      {/* === Scanner Companion App: install + pair flow === */}
      <Card className="p-5 md:p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-base">
              <ScanLine className="h-5 w-5 text-primary" /> Scanner Companion App
            </div>
            <p className="text-sm text-muted-foreground">
              মোবাইলকে wireless barcode scanner বানান — POS-এর সাথে সরাসরি WebRTC P2P সংযোগ।
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-bold ${phaseBadge.color}`}>
            {phaseBadge.icon} {phaseBadge.text}
          </span>
        </div>

        {/* How it works */}
        <div className="rounded-xl border bg-background p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">কীভাবে কাজ করে — ৩টি সহজ ধাপ</p>
          <ol className="text-sm space-y-1.5 list-decimal list-inside text-foreground/90">
            <li>এই কম্পিউটারে নিচের <span className="font-bold text-primary">"Pairing শুরু করুন"</span> চাপুন — একটি QR কোড আসবে।</li>
            <li>মোবাইলে Scanner App খুলুন (নিচের লিঙ্ক/QR থেকে), <span className="font-bold">QR scan</span> করুন বা link খুলুন।</li>
            <li>মোবাইল থেকে আসা <span className="font-bold">Answer code</span> এই কম্পিউটারে paste করুন → connection complete।</li>
          </ol>
          <p className="text-xs text-muted-foreground pt-1">এরপর POS পেজে গিয়ে মোবাইল ক্যামেরা দিয়ে scan করলেই product cart-এ যোগ হবে।</p>
        </div>

        {/* Step A — Open scanner on mobile */}
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="font-bold text-sm flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" /> ধাপ ১: মোবাইলে Scanner App খুলুন
          </div>
          <div className="grid sm:grid-cols-[auto,1fr] gap-4 items-center">
            <div className="bg-white rounded-xl p-3 mx-auto">
              <QRCode value={`${window.location.origin}/scanner.html`} size={130} className="h-auto w-[130px]" />
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">মোবাইল camera দিয়ে এই QR scan করুন, অথবা link খুলে phone-এ Scanner App হিসেবে install করুন।</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href="/scanner.html" target="_blank" rel="noopener noreferrer">
                    Open Scanner <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/scanner.html`); toast.success("Link copy হয়েছে"); }}>
                  <Copy className="h-4 w-4" /> Link copy
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Step B — Pairing */}
        <div className="rounded-xl border bg-background p-4 space-y-3">
          <div className="font-bold text-sm flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" /> ধাপ ২: Pairing শুরু করুন
          </div>

          {scanner.phase === "idle" || scanner.phase === "failed" ? (
            <Button onClick={scanner.startPairing} className="w-full gradient-primary text-primary-foreground">
              <QrCode className="h-4 w-4" /> Pairing শুরু করুন
            </Button>
          ) : (
            <div className="space-y-3">
              {scanner.phase === "preparing" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Offer তৈরি হচ্ছে...
                </div>
              )}

              {scanner.offerText && (
                <>
                  <div className="bg-white rounded-xl p-4">
                    <QRCode value={scanner.pairLink} size={180} className="mx-auto h-auto w-full max-w-[200px]" />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">এই QR মোবাইল Scanner App-এ scan করুন</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm"
                      onClick={() => { navigator.clipboard.writeText(scanner.pairLink); toast.success("Link copy হয়েছে"); }}>
                      <Link2 className="h-4 w-4" /> Pair link
                    </Button>
                    <Button variant="outline" size="sm" onClick={scanner.startPairing}>
                      <RefreshCw className="h-4 w-4" /> নতুন QR
                    </Button>
                  </div>
                </>
              )}

              {scanner.phase !== "connected" && scanner.offerText && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-xs font-bold">ধাপ ৩: মোবাইল থেকে Answer code এখানে paste করুন</label>
                  <textarea
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="মোবাইল Scanner App-এ আসা answer code / link"
                    className="w-full min-h-24 rounded-xl border bg-background p-3 text-xs"
                  />
                  <Button onClick={submitAnswer} className="w-full gradient-primary text-primary-foreground">
                    Connect Scanner
                  </Button>
                </div>
              )}

              {scanner.phase === "connected" && (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
                  <CheckCircle2 className="h-5 w-5" /> মোবাইল scanner connected — POS পেজে scan করুন
                </div>
              )}

              <p className="text-xs text-muted-foreground">{scanner.status}</p>
            </div>
          )}
        </div>
      </Card>

      {/* === Manual install steps === */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold">
            <Apple className="h-5 w-5" /> iPhone / iPad (Safari)
          </div>
          <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
            <li>Safari ব্রাউজারে এই পেজ খুলুন</li>
            <li>নিচের <Share className="h-4 w-4 inline" /> Share বাটনে ট্যাপ করুন</li>
            <li>"Add to Home Screen" <Plus className="h-4 w-4 inline" /> নির্বাচন করুন</li>
            <li>"Add" ট্যাপ করুন</li>
          </ol>
        </Card>
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold">
            <Chrome className="h-5 w-5" /> Android / Chrome / Edge
          </div>
          <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
            <li>উপরের "এখনই ইনস্টল করুন" বাটনে ক্লিক করুন</li>
            <li>অথবা ব্রাউজার মেনু (⋮) থেকে "Install app" নির্বাচন করুন</li>
            <li>"Install" নিশ্চিত করুন</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
