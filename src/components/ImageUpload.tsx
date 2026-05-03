import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
}

export function ImageUpload({ value, onChange, bucket = "product-images", folder = "products" }: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const compressed = await compressImage(file, { maxSize: 800, quality: 0.82, mimeType: "image/webp" });
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
        contentType: "image/webp",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast({ title: "ছবি upload হয়েছে", description: `Size: ${(compressed.size / 1024).toFixed(0)} KB` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = () => onChange(null);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {value ? (
        <div className="relative w-full aspect-square max-w-[160px] rounded-xl overflow-hidden bg-[hsl(var(--surface-container-high))] group">
          <img src={value} alt="product" className="w-full h-full object-cover" loading="lazy" />
          <button
            type="button"
            onClick={remove}
            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full max-w-[160px] aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:bg-[hsl(var(--surface-container-low))] transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground font-medium">{busy ? "Uploading..." : "ছবি যোগ করুন"}</span>
        </button>
      )}
      {value && !busy && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-primary font-semibold inline-flex items-center gap-1 hover:underline"
        >
          <Upload className="h-3 w-3" /> পরিবর্তন
        </button>
      )}
    </div>
  );
}
