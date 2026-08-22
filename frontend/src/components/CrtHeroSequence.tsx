import { useEffect, useRef, useState, type FC } from 'react';
import { ChevronDown } from 'lucide-react';

const FRAME_COUNT = 240;
const LAST_FRAME_INDEX = FRAME_COUNT - 1;
const EASING = 0.12;

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(Math.max(value, minimum), maximum)
);

const getFrameSource = (index: number): string => (
  `/frames/ezgif-frame-${String(index + 1).padStart(3, '0')}.jpg`
);

const CrtHeroSequence: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const frameIndexRef = useRef(0);
  const currentProgressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const isReadyRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;

    const drawFrame = (index: number): boolean => {
      const image = imagesRef.current[index];
      if (!image?.complete || image.naturalWidth === 0) return false;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const scale = Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const x = (canvasWidth - width) / 2;
      const y = (canvasHeight - height) / 2;

      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.drawImage(image, x, y, width, height);
      return true;
    };

    const updateTargetProgress = (): void => {
      if (reducedMotionRef.current) return;
      const rect = wrapper.getBoundingClientRect();
      const scrollDistance = wrapper.offsetHeight - window.innerHeight;
      const rawProgress = scrollDistance > 0 ? -rect.top / scrollDistance : 0;
      targetProgressRef.current = Number.isFinite(rawProgress) ? clamp(rawProgress, 0, 1) : 0;
    };

    const resizeCanvas = (): void => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * pixelRatio);
      canvas.height = Math.round(window.innerHeight * pixelRatio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      drawFrame(reducedMotionRef.current ? LAST_FRAME_INDEX : frameIndexRef.current);
    };

    const animate = (): void => {
      if (reducedMotionRef.current) {
        drawFrame(LAST_FRAME_INDEX);
      } else if (isReadyRef.current) {
        const difference = targetProgressRef.current - currentProgressRef.current;
        currentProgressRef.current = Math.abs(difference) < 0.0001
          ? targetProgressRef.current
          : currentProgressRef.current + difference * EASING;

        const nextIndex = clamp(Math.floor(currentProgressRef.current * LAST_FRAME_INDEX), 0, LAST_FRAME_INDEX);
        if (nextIndex !== frameIndexRef.current && drawFrame(nextIndex)) {
          frameIndexRef.current = nextIndex;
          setCurrentFrame(nextIndex);
        }
      }
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    const handleMotionChange = (event: MediaQueryListEvent): void => {
      reducedMotionRef.current = event.matches;
      if (event.matches) {
        currentProgressRef.current = 1;
        targetProgressRef.current = 1;
        frameIndexRef.current = LAST_FRAME_INDEX;
        setCurrentFrame(LAST_FRAME_INDEX);
        drawFrame(LAST_FRAME_INDEX);
      } else {
        updateTargetProgress();
        currentProgressRef.current = targetProgressRef.current;
      }
    };

    resizeCanvas();
    updateTargetProgress();
    animationFrameRef.current = window.requestAnimationFrame(animate);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', updateTargetProgress, { passive: true });
    motionQuery.addEventListener('change', handleMotionChange);

    let cancelled = false;
    let completeCount = 0;
    const images: HTMLImageElement[] = Array.from({ length: FRAME_COUNT }, (_, index) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = getFrameSource(index);
      image.onload = () => {
        if (cancelled) return;
        completeCount += 1;
        setLoadedCount(completeCount);
        if (index === 0) drawFrame(0);
        if (completeCount === FRAME_COUNT) {
          isReadyRef.current = true;
          if (reducedMotionRef.current) {
            frameIndexRef.current = LAST_FRAME_INDEX;
            setCurrentFrame(LAST_FRAME_INDEX);
            drawFrame(LAST_FRAME_INDEX);
          } else {
            updateTargetProgress();
          }
        }
      };
      return image;
    });
    imagesRef.current = images;

    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('scroll', updateTargetProgress);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  const loadProgress = Math.round((loadedCount / FRAME_COUNT) * 100);
  const displayFrame = String(currentFrame + 1).padStart(3, '0');

  return (
    <div className="crt-sequence" ref={wrapperRef}>
      <div className="crt-sequence-stage">
        <canvas ref={canvasRef} className="crt-sequence-canvas" aria-label="Nexora risk intelligence sequence" />
        <div className="crt-sequence-scanlines" aria-hidden="true" />
        <div className="crt-sequence-vignette" aria-hidden="true" />
        <div className="crt-sequence-copy">
          <p className="crt-sequence-kicker">Personalized vulnerability triage</p>
          <h1>Fix the risks<br /><span>that matter first.</span></h1>
          <p>Nexora ranks CVSS severity, CISA KEV exploitation, EPSS likelihood, and your critical systems into a focused remediation queue.</p>
        </div>
        <p className="crt-sequence-frame" aria-live="polite">RISK SIGNAL {displayFrame} / {FRAME_COUNT}</p>
        {loadedCount < FRAME_COUNT && (
          <div className="crt-sequence-loading" role="status">
            <div className="crt-sequence-progress"><span style={{ '--sequence-progress': `${loadProgress}%` } as React.CSSProperties} /></div>
            <span>Indexing risk signals {loadProgress}%</span>
          </div>
        )}
        <div className="crt-sequence-cue" aria-hidden="true"><ChevronDown size={20} /></div>
      </div>
    </div>
  );
};

export default CrtHeroSequence;
