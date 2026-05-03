import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ScannerCompanion from "@/pages/ScannerCompanion";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <Toaster />
    <Sonner />
    <ScannerCompanion />
  </>
);
