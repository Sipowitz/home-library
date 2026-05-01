import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import toast from "react-hot-toast";

type Params = {
  scannerRegionId: string;
  onScan: (isbn: string) => void;
  onError?: () => void;
};

export function useISBNScanner({ scannerRegionId, onScan, onError }: Params) {
  // 📷 Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);

  // 🔦 Torch state
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // ⏱️ Scanner timeout
  const scannerTimeoutRef = useRef<number | null>(null);

  // ✅ Prevent duplicate scans
  const scanLockRef = useRef(false);

  // -------------------
  // 📷 START SCANNER
  // -------------------
  useEffect(() => {
    if (!scannerOpen) return;

    const scanner = new Html5Qrcode(scannerRegionId);
    scannerRef.current = scanner;

    async function startScanner() {
      // ✅ Reset lock every time scanner opens
      scanLockRef.current = false;

      try {
        const cameras = await Html5Qrcode.getCameras();

        if (!cameras.length) {
          throw new Error("No cameras found");
        }

        // ✅ Prefer rear/back camera
        const rearCamera =
          cameras.find((c) => c.label.toLowerCase().includes("back")) ||
          cameras.find((c) => c.label.toLowerCase().includes("rear")) ||
          cameras.find((c) => c.label.toLowerCase().includes("environment")) ||
          cameras[0];

        await scanner.start(
          rearCamera.id,
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 120,
            },
          },
          async (decodedText) => {
            // ✅ Ignore duplicate scan callbacks
            if (scanLockRef.current) return;

            scanLockRef.current = true;

            // 📳 Haptic feedback
            if (navigator.vibrate) {
              navigator.vibrate(120);
            }

            toast.success("ISBN scanned");

            await stopScanner();

            onScan(decodedText);
          },
          () => {
            // ignore scan noise
          },
        );

        // ⏱️ Auto-close scanner after 10s
        scannerTimeoutRef.current = window.setTimeout(async () => {
          toast("Scanner timed out");

          await stopScanner();
        }, 10000);

        // 🔦 Detect torch support
        const capabilities = scanner.getRunningTrackCapabilities();

        console.log("CAMERA CAPABILITIES", capabilities);

        if (capabilities.torch) {
          setTorchSupported(true);
        }
      } catch (err) {
        console.error("Scanner failed to start", err);

        toast.error("Unable to access camera");

        setScannerOpen(false);

        onError?.();
      }
    }

    startScanner();

    return () => {
      stopScanner();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  // -------------------
  // 🛑 STOP SCANNER
  // -------------------
  async function stopScanner() {
    try {
      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current);
        scannerTimeoutRef.current = null;
      }

      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch (err) {
      console.error("Failed to stop scanner", err);
    }

    scannerRef.current = null;

    setTorchOn(false);
    setTorchSupported(false);

    setScannerOpen(false);
  }

  // -------------------
  // 🔦 TOGGLE TORCH
  // -------------------
  async function toggleTorch() {
    if (!scannerRef.current || !torchSupported) return;

    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn }],
      });

      setTorchOn((prev) => !prev);
    } catch (err) {
      console.error("Torch toggle failed", err);
    }
  }

  return {
    scannerOpen,
    setScannerOpen,

    torchOn,
    torchSupported,

    toggleTorch,
    stopScanner,
  };
}
