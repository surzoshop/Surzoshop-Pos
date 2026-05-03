import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, RefreshCw, AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

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

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result, _err, ctrl) => {
            if (result) {
              const code = result.getText();
              ctrl.stop();
              onDetected(code);
            }
          }
        );
        if (cancelled) { controls.stop(); return; }
        controlsRef.current = controls;
        setStarting(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Camera access failed");
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceIndex]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    setDeviceIndex(i => (i + 1) % devices.length);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[3/4] sm:aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

          {/* Scanner overlay */}
          {!error && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/40" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 30%, 10% 30%, 10% 70%, 90% 70%, 90% 30%, 0 30%)" }} />
              <div className="absolute left-[10%] right-[10%] top-[30%] bottom-[30%] border-2 border-primary rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.0)]">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl" />
                <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-primary/80 animate-pulse" />
              </div>
              <p className="absolute bottom-4 left-0 right-0 text-center text-white text-xs font-medium">
                বারকোডটি সবুজ ফ্রেমে রাখুন
              </p>
            </div>
          )}

          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-black/80">
              <AlertCircle className="h-10 w-10 text-destructive mb-2" />
              <p className="font-bold mb-1">Camera ব্যবহার করা যাচ্ছে না</p>
              <p className="text-xs opacity-80">{error}</p>
              <p className="text-[11px] opacity-60 mt-3">ব্রাউজার সেটিংস থেকে camera permission দিন।</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 bg-card">
          <Button variant="outline" size="sm" onClick={switchCamera} disabled={devices.length < 2}>
            <RefreshCw className="h-4 w-4 mr-1" /> Camera switch
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" /> বন্ধ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
