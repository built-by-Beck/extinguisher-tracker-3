import { BarcodeDetectorPolyfill } from '@undecaf/barcode-detector-polyfill';

export type FacingMode = 'environment' | 'user';
export type BarcodeFormat =
  | 'aztec' | 'code_128' | 'code_39' | 'code_93' | 'codabar'
  | 'data_matrix' | 'ean_13' | 'ean_8' | 'itf'
  | 'pdf417' | 'qr_code' | 'upc_a' | 'upc_e';

export interface DetectedBarcode {
  rawValue: string;
  format: BarcodeFormat | string;
  boundingBox?: DOMRectReadOnly;
  cornerPoints?: Array<{ x: number; y: number }>;
}

interface BarcodeDetectorCtor {
  new (opts?: { formats?: BarcodeFormat[] }): {
    detect(src: CanvasImageSource): Promise<DetectedBarcode[]>;
  };
  getSupportedFormats?: () => Promise<BarcodeFormat[]>;
}

export interface ScannerOptions {
  video: HTMLVideoElement;
  canvas?: HTMLCanvasElement | null;
  onScan: (text: string, code?: DetectedBarcode) => void;
  onError?: (error: Error) => void;
  intervalMs?: number;
  formats?: BarcodeFormat[];
  preferFacingMode?: FacingMode;
}

export interface Scanner {
  init(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  switchCamera(): Promise<void>;
}

interface StreamRequestOptions {
  allowOppositeFallback?: boolean;
}

export function createBarcodeScanner(opts: ScannerOptions): Scanner {
  const {
    video,
    canvas = null,
    onScan,
    onError,
    intervalMs = 100,
    formats,
    preferFacingMode = 'environment',
  } = opts;

  const Impl: BarcodeDetectorCtor =
    ((window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector as BarcodeDetectorCtor | undefined) ||
    (BarcodeDetectorPolyfill as unknown as BarcodeDetectorCtor);

  let detector: InstanceType<BarcodeDetectorCtor> | null = null;
  let stream: MediaStream | null = null;
  let timer: number | null = null;
  let scanning = false;
  let detectionInFlight = false;
  let lastFacingMode: FacingMode = preferFacingMode;

  const normalizeError = (err: unknown): Error => {
    if (err instanceof Error) return err;
    return new Error(typeof err === 'string' ? err : 'Barcode scanning failed.');
  };

  const shouldSurfaceDetectError = (err: unknown): boolean => {
    const message = normalizeError(err).message.toLowerCase();
    return (
      message.includes('wasm')
      || message.includes('import')
      || message.includes('fetch')
      || message.includes('network')
      || message.includes('module')
      || message.includes('barcode')
    );
  };

  const clearTimer = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const stopTracks = () => {
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (video as any).srcObject = null;
      video.pause();
    } catch { void 0; }
  };

  const getWorkingStream = async (
    desired: FacingMode,
    options: StreamRequestOptions = {},
  ) => {
    const { allowOppositeFallback = true } = options;
    const opposite: FacingMode = desired === 'environment' ? 'user' : 'environment';
    const tries: MediaStreamConstraints[] = [
      { video: { facingMode: { exact: desired }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
      { video: { facingMode: { ideal: desired }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
    ];

    if (allowOppositeFallback) {
      tries.push(
        { video: { facingMode: { exact: opposite } }, audio: false },
        { video: { facingMode: { ideal: opposite } }, audio: false },
        { video: true, audio: false },
      );
    }

    let lastErr: unknown = null;
    for (const c of tries) {
      try {
        return await navigator.mediaDevices.getUserMedia(c);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error('Unable to acquire camera');
  };

  const attachVideo = async (s: MediaStream) => {
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (video as any).srcObject = s;
    await new Promise<void>((r) => {
      const onLoaded = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        r();
      };
      video.addEventListener('loadedmetadata', onLoaded);
    });
    try {
      await video.play();
    } catch {
      await new Promise((r) => setTimeout(r, 50));
      try { await video.play(); } catch { void 0; }
    }
    // allow dimensions to populate
    await new Promise((r) => setTimeout(r, 200));
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  const draw = (barcodes: DetectedBarcode[]) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const b of barcodes) {
      const { boundingBox, cornerPoints } = b;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      if (cornerPoints?.length) {
        ctx.beginPath();
        ctx.moveTo(cornerPoints[0].x, cornerPoints[0].y);
        for (let i = 1; i < cornerPoints.length; i++) ctx.lineTo(cornerPoints[i].x, cornerPoints[i].y);
        ctx.closePath();
        ctx.stroke();
      } else if (boundingBox) {
        ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
      }
      const label = `${b.format || ''}${b.rawValue ? ': ' + b.rawValue : ''}`;
      const x = boundingBox?.x ?? cornerPoints?.[0]?.x ?? 10;
      const y = (boundingBox?.y ?? cornerPoints?.[0]?.y ?? 22) - 6;
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px system-ui, Arial';
      ctx.fillText(label, x, y);
    }
  };

  const ensureDetector = async () => {
    if (detector) return detector;
    const supported = Impl.getSupportedFormats ? await Impl.getSupportedFormats() : null;
    detector = new Impl({
      formats: formats || supported || [
        'code_128', 'code_39', 'code_93', 'ean_8', 'ean_13', 'upc_a', 'upc_e', 'qr_code', 'data_matrix', 'aztec', 'pdf417', 'itf', 'codabar',
      ],
    });
    return detector;
  };

  const startLoop = () => {
    clearTimer();
    scanning = true;
    timer = window.setInterval(async () => {
      if (!scanning || !detector || video.readyState < 2 || detectionInFlight) return;
      detectionInFlight = true;
      try {
        const codes = await detector!.detect(video);
        if (codes?.length) {
          draw(codes);
          const text = codes[0]?.rawValue;
          if (text) {
            // stop before firing callback to avoid races
            api.stop();
            onScan(String(text).trim(), codes[0]);
            try { navigator.vibrate?.(30); } catch { void 0; }
          }
        } else if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      } catch (err) {
        if (shouldSurfaceDetectError(err)) {
          api.stop();
          onError?.(normalizeError(err));
        }
      } finally {
        detectionInFlight = false;
      }
    }, intervalMs);
  };

  const api: Scanner = {
    async init() { await ensureDetector(); },
    async start() {
      await ensureDetector();
      stopTracks();
      stream = await getWorkingStream(lastFacingMode, {
        allowOppositeFallback: false,
      });
      const track = stream.getVideoTracks()[0];
      const facing = (track.getSettings?.().facingMode as FacingMode | undefined);
      if (facing) lastFacingMode = facing;
      await attachVideo(stream);
      startLoop();
    },
    stop() {
      scanning = false;
      detectionInFlight = false;
      clearTimer();
      stopTracks();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
    async switchCamera() {
      scanning = false;
      detectionInFlight = false;
      clearTimer();
      stopTracks();
      const desired: FacingMode = lastFacingMode === 'environment' ? 'user' : 'environment';
      stream = await getWorkingStream(desired);
      const track = stream.getVideoTracks()[0];
      const facing = (track.getSettings?.().facingMode as FacingMode | undefined);
      if (facing) lastFacingMode = facing;
      await attachVideo(stream);
      startLoop();
    },
  };

  return api;
}

export default createBarcodeScanner;
