import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { cropAndScaleImage } from '../utils/imageUtils';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
  title?: string;
  outputWidth?: number;
  outputHeight?: number;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  title = 'Crop & Zoom Profile Image',
  outputWidth = 400,
  outputHeight = 400,
}) => {
  const { theme } = useSettings();
  const effectiveBorderColor = theme.transparentAllBorders ? 'transparent' : theme.borderColor;
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Load natural dimensions when imageSrc changes
  useEffect(() => {
    if (imageSrc) {
      const img = new Image();
      const onLoad = () => {
        setImgNaturalSize({
          width: img.naturalWidth || img.width || 400,
          height: img.naturalHeight || img.height || 400,
        });
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      };
      img.onload = onLoad;
      img.onerror = () => {
        console.error('Failed to load image in ImageCropperModal');
        setImgNaturalSize({ width: 400, height: 400 });
      };
      img.src = imageSrc;
      if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
        onLoad();
      }
    }
  }, [imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.5, Math.min(4, newZoom));
    setZoom(clamped);
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleConfirmCrop = async () => {
    if (!imageSrc || imgNaturalSize.width === 0) return;
    setIsProcessing(true);

    try {
      // Crop calculation based on 250px preview viewport
      const viewportSize = 250;
      const baseScale = Math.min(viewportSize / imgNaturalSize.width, viewportSize / imgNaturalSize.height);
      const effectiveScale = Math.max(0.001, baseScale * zoom);

      // Calculate origin offset in natural image coordinates
      const displayedWidth = imgNaturalSize.width * effectiveScale;
      const displayedHeight = imgNaturalSize.height * effectiveScale;

      // Center of viewport
      const viewportCenterX = viewportSize / 2;
      const viewportCenterY = viewportSize / 2;

      // Top left of displayed image relative to viewport top left
      const imgTopLeftX = viewportCenterX - displayedWidth / 2 + position.x;
      const imgTopLeftY = viewportCenterY - displayedHeight / 2 + position.y;

      // Crop box (viewport) in natural image coordinates
      const rawCropX = (0 - imgTopLeftX) / effectiveScale;
      const rawCropY = (0 - imgTopLeftY) / effectiveScale;
      const rawCropW = viewportSize / effectiveScale;
      const rawCropH = viewportSize / effectiveScale;

      const cropX = Math.max(0, Math.min(imgNaturalSize.width - 1, rawCropX));
      const cropY = Math.max(0, Math.min(imgNaturalSize.height - 1, rawCropY));
      const cropW = Math.max(1, Math.min(imgNaturalSize.width - cropX, rawCropW));
      const cropH = Math.max(1, Math.min(imgNaturalSize.height - cropY, rawCropH));

      const croppedDataUrl = await cropAndScaleImage(
        imageSrc,
        {
          x: cropX,
          y: cropY,
          width: cropW,
          height: cropH,
        },
        outputWidth,
        outputHeight
      );

      onCropComplete(croppedDataUrl);
      onClose();
    } catch (err: any) {
      console.error('Failed to crop image:', err);
      alert('Error cropping image: ' + (err?.message || 'Please try another image.'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div 
        className="relative w-full max-w-md border rounded-2xl shadow-2xl flex flex-col overflow-hidden theme-border-hover"
        style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
        >
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4" style={{ color: theme.textColor }} />
            <h3 className="font-bold text-sm" style={{ color: theme.textColor }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg border hover:opacity-80 cursor-pointer transition-opacity"
            style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Crop Box (250px x 250px) */}
        <div className="p-6 flex flex-col items-center justify-center space-y-4">
          <div className="text-[11px] opacity-70 text-center font-medium" style={{ color: theme.textColor }}>
            Drag to move • Slider to zoom • Output constrained to max <strong>{outputWidth}x{outputHeight}px</strong>
          </div>

          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            className="relative w-[250px] h-[250px] rounded-2xl overflow-hidden border-2 shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-center"
            style={{ backgroundColor: theme.bgColor, borderColor: theme.borderHoverColor || effectiveBorderColor }}
          >
            {/* Guide circle mask */}
            <div className="absolute inset-0 rounded-full border border-white/40 pointer-events-none z-10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />

            {/* Draggable & Scalable Image */}
            <img
              src={imageSrc}
              alt="Crop target"
              draggable={false}
              className="max-w-none transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Zoom Slider & Controls */}
          <div className="w-full max-w-[260px] space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleZoomChange(zoom - 0.2)}
                className="p-1.5 rounded-lg border hover:opacity-80 cursor-pointer"
                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                style={{ backgroundColor: theme.bgColor, accentColor: theme.buttonColor }}
              />
              <button
                type="button"
                onClick={() => handleZoomChange(zoom + 0.2)}
                className="p-1.5 rounded-lg border hover:opacity-80 cursor-pointer"
                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-between items-center text-[11px]">
              <span className="font-semibold opacity-75" style={{ color: theme.textColor }}>Zoom: {Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border hover:opacity-80 font-semibold cursor-pointer"
                style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="px-6 py-4 border-t flex justify-end gap-2"
          style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: theme.bgColor, borderColor: effectiveBorderColor, color: theme.textColor }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirmCrop}
            className="px-5 py-2 rounded-xl text-xs font-bold border shadow-lg flex items-center gap-1.5 transition-all cursor-pointer hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: theme.buttonColor,
              color: theme.buttonTextColor,
              borderColor: effectiveBorderColor,
            }}
          >
            <Check className="w-4 h-4" />
            {isProcessing ? 'Saving...' : 'Apply & Save (400x400)'}
          </button>
        </div>
      </div>
    </div>
  );
};
