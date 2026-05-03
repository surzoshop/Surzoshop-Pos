import LZString from "lz-string";

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

export async function waitForIceGatheringComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }, 5000);
  });
}

export function encodeSignal(signal: RTCSessionDescriptionInit) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(signal));
}

export function decodeSignal(encoded: string): RTCSessionDescriptionInit {
  const decoded = LZString.decompressFromEncodedURIComponent(encoded);
  if (!decoded) throw new Error("Signal decode failed");
  return JSON.parse(decoded) as RTCSessionDescriptionInit;
}

export function extractSignalValue(raw: string, key: "offer" | "answer") {
  const value = raw.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.searchParams.get(key) ?? url.searchParams.get("signal") ?? value;
  } catch {
    return value;
  }
}
