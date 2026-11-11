"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useUploadReceipt } from "../hooks/use-expenses";

export function ScanButton() {
  const upload = useUploadReceipt();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate({ file });
    e.target.value = "";
  }

  return (
    <div className="flex gap-2">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        className="flex-1"
        onClick={() => cameraRef.current?.click()}
        disabled={upload.isPending}
      >
        {upload.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        Escanear ticket
      </Button>
      <Button
        variant="secondary"
        onClick={() => galleryRef.current?.click()}
        disabled={upload.isPending}
      >
        <Upload className="h-4 w-4" />
      </Button>
    </div>
  );
}
