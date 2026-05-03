import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { RTC_CONFIG, decodeSignal, encodeSignal, extractSignalValue, waitForIceGatheringComplete } from "@/lib/webrtcPairing";

type Phase = "idle" | "preparing" | "offer-ready" | "connected" | "failed";
type Listener = (code: string) => void;

type Ctx = {
  phase: Phase;
  status: string;
  offerText: string;
  pairLink: string;
  startPairing: () => Promise<void>;
  submitAnswer: (raw: string) => Promise<void>;
  reset: () => void;
  subscribe: (fn: Listener) => () => void;
};

const MobileScannerContext = createContext<Ctx | null>(null);

export function MobileScannerProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("Pairing শুরু করুন");
  const [offerText, setOfferText] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const listeners = useRef<Set<Listener>>(new Set());

  useEffect(() => () => { dcRef.current?.close(); pcRef.current?.close(); }, []);

  const reset = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    setOfferText("");
    setPhase("idle");
    setStatus("Pairing শুরু করুন");
  }, []);

  const startPairing = useCallback(async () => {
    try {
      reset();
      setPhase("preparing");
      setStatus("Offer তৈরি হচ্ছে...");
      const pc = new RTCPeerConnection(RTC_CONFIG);
      const dc = pc.createDataChannel("barcode-scanner");
      pcRef.current = pc;
      dcRef.current = dc;

      dc.onopen = () => { setPhase("connected"); setStatus("মোবাইল scanner connected"); };
      dc.onclose = () => { setPhase("idle"); setStatus("সংযোগ বন্ধ হয়েছে"); };
      dc.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "barcode" && payload.code) {
            listeners.current.forEach(fn => fn(String(payload.code)));
          }
        } catch {}
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          setStatus("সংযোগ বিচ্ছিন্ন");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);
      if (!pc.localDescription) throw new Error("Offer তৈরি হয়নি");
      setOfferText(encodeSignal(pc.localDescription.toJSON()));
      setPhase("offer-ready");
      setStatus("QR code মোবাইলে scan করুন");
    } catch (e: any) {
      setPhase("failed");
      setStatus(e?.message || "Pairing ব্যর্থ");
    }
  }, [reset]);

  const submitAnswer = useCallback(async (raw: string) => {
    if (!pcRef.current) throw new Error("আগে pairing শুরু করুন");
    const encoded = extractSignalValue(raw, "answer");
    if (!encoded) throw new Error("Answer code দিন");
    const answer = decodeSignal(encoded);
    await pcRef.current.setRemoteDescription(answer);
    setStatus("Answer গৃহীত — সংযোগের অপেক্ষায়");
  }, []);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  const pairLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!offerText) return `${window.location.origin}/scanner.html`;
    const url = new URL(`${window.location.origin}/scanner.html`);
    url.searchParams.set("offer", offerText);
    return url.toString();
  }, [offerText]);

  const value = useMemo(() => ({ phase, status, offerText, pairLink, startPairing, submitAnswer, reset, subscribe }),
    [phase, status, offerText, pairLink, startPairing, submitAnswer, reset, subscribe]);

  return <MobileScannerContext.Provider value={value}>{children}</MobileScannerContext.Provider>;
}

export function useMobileScanner() {
  const ctx = useContext(MobileScannerContext);
  if (!ctx) throw new Error("useMobileScanner must be used inside MobileScannerProvider");
  return ctx;
}
