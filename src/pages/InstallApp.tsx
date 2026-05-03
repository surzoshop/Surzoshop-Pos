import { useEffect, useState } from "react";
import { Download, Smartphone, Share, Plus, CheckCircle2, Apple, Chrome, ScanLine, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("অ্যাপ সফলভাবে ইনস্টল হয়েছে! 🎉");
    });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferred) {
      toast.info("ইনস্টল প্রম্পট এখনই উপলব্ধ নয়। কিছুক্ষণ পরে আবার চেষ্টা করুন বা ব্রাউজার মেনু থেকে ইনস্টল করুন।");
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      toast.success("ইনস্টল হচ্ছে...");
    }
    setDeferred(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-primary-foreground shadow-lg">
          <Smartphone className="h-8 w-8" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">সূর্য শপ অ্যাপ ইনস্টল করুন</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          আপনার ফোন বা ডেস্কটপে অ্যাপ ইনস্টল করুন — দ্রুত অ্যাক্সেস, ফুল-স্ক্রিন অভিজ্ঞতা
        </p>
      </div>

      <Card className="p-5 md:p-6 border-primary/20 bg-primary/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-base"><ScanLine className="h-5 w-5 text-primary" /> Scanner Companion App</div>
            <p className="text-sm text-muted-foreground">মোবাইলকে barcode scanner remote হিসেবে ব্যবহার করুন এবং সরাসরি POS-এ product পাঠান।</p>
          </div>
          <Button asChild className="gradient-primary text-primary-foreground">
            <a href="/scanner.html">
              Open Scanner App <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </Card>

      {isStandalone || installed ? (
        <Card className="p-6 flex items-center gap-4 border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-10 w-10 text-primary" />
          <div>
            <h3 className="font-bold">অ্যাপ ইতিমধ্যে ইনস্টল করা আছে</h3>
            <p className="text-sm text-muted-foreground">আপনি বর্তমানে ইনস্টল করা অ্যাপটি ব্যবহার করছেন।</p>
          </div>
        </Card>
      ) : (
        <Card className="p-6 md:p-8 text-center space-y-4">
          <Download className="h-12 w-12 mx-auto text-primary" />
          <div>
            <h2 className="text-xl font-bold mb-1">এক ক্লিকে ইনস্টল</h2>
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

      <Card className="p-5 bg-muted/30">
        <h3 className="font-bold mb-2">ইনস্টল করলে যা পাবেন</h3>
        <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
          <li>হোম স্ক্রিন থেকে দ্রুত অ্যাক্সেস</li>
          <li>ফুল-স্ক্রিন নেটিভ অ্যাপ অভিজ্ঞতা</li>
          <li>ক্যামেরা বারকোড স্ক্যানার সহজে</li>
          <li>দ্রুত লোডিং ও স্মুথ পারফরম্যান্স</li>
        </ul>
      </Card>
    </div>
  );
}
