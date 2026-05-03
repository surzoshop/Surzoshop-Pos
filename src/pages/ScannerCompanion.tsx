import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, CheckCircle2, Copy, Link2, Loader2, RefreshCw, ScanLine, Smartphone, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RTC_CONFIG, decodeSignal, encodeSignal, extractSignalValue, waitForIceGatheringComplete } from "@/lib/webrtcPairing";

type Phase = "connect" | "camera";
type ScanLog = { code: string; at: number };

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function ScannerCompanion() {
  const [phase, setPhase] = useState<Phase>("connect");
  const [offerInput, setOfferInput] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("ডেস্কটপ POS-এর offer code দিন");
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [startingCamera, setStartingCamera] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      pcRef.current?.close();
    };
  }, []);

  const canStartCamera = connected && phase === "camera";
  const answerUrl = useMemo(() => {
    if (!answerText) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("answer", answerText);
    return url.toString();
  }, [answerText]);

  const handleInstall = async () => {
    if (!deferred) {
      toast.info("ইনস্টল প্রম্পট এখনই পাওয়া যাচ্ছে না। ব্রাউজার মেনু থেকেও ইনস্টল করতে পারেন।");
      return;
    }
    await deferred.prompt();
    setDeferred(null);
  };

  const startPairing = async () => {
    const offerEncoded = extractSignalValue(offerInput, "offer");
    if (!offerEncoded) {
      toast.error("Offer code দিন");
      return;
    }

    try {
      setConnecting(true);
      setStatus("POS-এর সাথে কানেক্ট হচ্ছে...");
      const offer = decodeSignal(offerEncoded);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setConnected(true);
          setPhase("camera");
          setStatus("কানেক্টেড — এখন স্ক্যান করুন");
          toast.success("POS-এর সাথে সংযোগ হয়েছে");
        } else if (["failed", "disconnected", "closed"].includes(state)) {
          setConnected(false);
          setStatus("সংযোগ বিচ্ছিন্ন হয়েছে");
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        dcRef.current = channel;
        channel.onopen = () => {
          setConnected(true);
          setPhase("camera");
          setStatus("কানেক্টেড — এখন স্ক্যান করুন");
        };
        channel.onclose = () => setConnected(false);
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGatheringComplete(pc);
      if (!pc.localDescription) throw new Error("Answer তৈরি হয়নি");
      setAnswerText(encodeSignal(pc.localDescription.toJSON()));
      setStatus("Answer তৈরি হয়েছে — এটি ডেস্কটপে পেস্ট করুন");
    } catch (error) {
      console.error(error);
      toast.error("Pairing সম্পন্ন করা যায়নি");
      setStatus("Pairing ব্যর্থ হয়েছে");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (!canStartCamera) return;
    let cancelled = false;
    setStartingCamera(true);
    setScanError(null);
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(list);
        const back = list.findIndex(d => /back|rear|environment/i.test(d.label));
        const idx = back >= 0 ? back : Math.min(deviceIndex, Math.max(0, list.length - 1));
        setDeviceIndex(idx);

        const constraints: MediaStreamConstraints = list.length > 0 && list[idx]?.deviceId
          ? { video: { deviceId: { exact: list[idx].deviceId } } }
          : { video: { facingMode: { ideal: "environment" } } };

        const controls = await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
          if (result) {
            const code = result.getText();
            if (dcRef.current?.readyState === "open") {
              dcRef.current.send(JSON.stringify({ type: "barcode", code, at: Date.now() }));
              setLogs(prev => [{ code, at: Date.now() }, ...prev].slice(0, 8));
              toast.success(`পাঠানো হয়েছে: ${code}`);
            }
          }
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e: any) {
        if (cancelled) return;
        setScanError(e?.message || "Camera access failed");
      } finally {
        if (!cancelled) setStartingCamera(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [canStartCamera, deviceIndex]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    setDeviceIndex(i => (i + 1) % devices.length);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-container-low))] text-foreground pb-8">
      <div className="safe-top px-4 pt-4 max-w-md mx-auto space-y-4">
        <div className="text-center space-y-2 pt-2">
          <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <ScanLine className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black">Scanner Companion</h1>
          <p className="text-sm text-muted-foreground">মোবাইল থেকে সরাসরি আপনার POS-এ বারকোড পাঠান</p>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">অ্যাপ ইনস্টল</p>
              <p className="text-xs text-muted-foreground">আলাদা scanner app হিসেবে ব্যবহার করুন</p>
            </div>
            {isStandalone ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary"><CheckCircle2 className="h-4 w-4" /> ইনস্টলড</span>
            ) : (
              <Button variant="outline" size="sm" onClick={handleInstall}>Install</Button>
            )}
          </div>
          {isIOS && !isStandalone && <p className="text-xs text-muted-foreground">Safari → Share → Add to Home Screen</p>}
        </Card>

        {phase === "connect" && (
          <>
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold"><Link2 className="h-4 w-4 text-primary" /> POS Pairing</div>
              <p className="text-xs text-muted-foreground">ডেস্কটপ POS-এ "Mobile Pair" চাপুন, সেখানে দেখানো offer code এখানে পেস্ট করুন।</p>
              <Input
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value)}
                placeholder="Offer code / link paste করুন"
                className="min-h-12"
              />
              <Button onClick={startPairing} disabled={connecting} className="w-full gradient-primary text-primary-foreground">
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />} Connect to POS
              </Button>
              <p className="text-xs text-muted-foreground">{status}</p>
            </Card>

            {answerText && (
              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2 font-bold"><Smartphone className="h-4 w-4 text-primary" /> Desktop-এ Answer দিন</div>
                <div className="bg-background rounded-xl p-3 overflow-hidden">
                  <QRCode value={answerUrl || answerText} size={180} className="mx-auto h-auto w-full max-w-[180px]" />
                </div>
                <textarea
                  value={answerText}
                  readOnly
                  className="w-full min-h-28 rounded-xl border bg-background p-3 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(answerText); toast.success("Answer copy হয়েছে"); }}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(answerUrl || answerText); toast.success("Link copy হয়েছে"); }}>
                    <Link2 className="h-4 w-4" /> Link
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {phase === "camera" && (
          <>
            <Card className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold flex items-center gap-2">{connected ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-destructive" />} {connected ? "POS Connected" : "Disconnected"}</p>
                <p className="text-xs text-muted-foreground">{status}</p>
              </div>
              <Button variant="outline" size="sm" onClick={switchCamera} disabled={devices.length < 2}><RefreshCw className="h-4 w-4" /></Button>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="relative bg-black aspect-[3/4]">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                {!scanError && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/35" style={{ clipPath: "polygon(0 0,100% 0,100% 100%,0 100%,0 28%,12% 28%,12% 72%,88% 72%,88% 28%,0 28%)" }} />
                    <div className="absolute left-[12%] right-[12%] top-[28%] bottom-[28%] rounded-3xl border-2 border-primary">
                      <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-primary/80 animate-pulse" />
                    </div>
                    <p className="absolute bottom-4 inset-x-0 text-center text-xs font-medium text-white">বারকোড ফ্রেমের মধ্যে রাখুন</p>
                  </div>
                )}
                {startingCamera && !scanError && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                {scanError && <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4 bg-black/75">{scanError}</div>}
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-bold">সাম্প্রতিক scan</div>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">এখনও কোন barcode পাঠানো হয়নি</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={`${log.code}-${log.at}`} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                      <span className="font-medium text-sm truncate">{log.code}</span>
                      <span className="text-[11px] text-muted-foreground">{new Date(log.at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
