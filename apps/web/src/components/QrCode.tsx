import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * A real, scannable QR code drawn as one SVG path: crisp at any size, prints
 * cleanly, and needs no image file. Medium error correction survives a
 * smudged or slightly creased table card.
 */
export function QrCode({
  value,
  size = 160,
  className,
  title,
}: {
  value: string;
  size?: number;
  className?: string;
  /** Read out by screen readers, e.g. "QR code to open Saffra". */
  title?: string;
}) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value]);

  const quietZone = 2;
  const box = count + quietZone * 2;
  return (
    <svg
      role="img"
      aria-label={title ?? `QR code for ${value}`}
      viewBox={`${-quietZone} ${-quietZone} ${box} ${box}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={-quietZone} y={-quietZone} width={box} height={box} fill="#fff" />
      <path d={path} fill="#0B1220" />
    </svg>
  );
}
