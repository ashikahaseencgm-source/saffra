import logoIcon from "../../assets/logo.png";

/** A deterministic, QR-code-*looking* pattern for the demo UPI/QR flow. Not a
 * real scannable code — purely a visual stand-in so the Demo Checkout reads
 * as a believable payment screen. */
export function FakeQr({ seed }: { seed: string }) {
  const size = 11;
  const cells: boolean[] = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  for (let i = 0; i < size * size; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    cells.push((hash >> 16) % 3 !== 0);
  }

  const isFinder = (r: number, c: number) => (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);

  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-2xl bg-white p-3 shadow-inner ring-1 ring-borderc">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }).map((_, i) => {
          const r = Math.floor(i / size);
          const c = i % size;
          const filled = isFinder(r, c) ? (r % 2 === 0 || c % 2 === 0) : cells[i];
          return <div key={i} className={filled ? "bg-primary" : "bg-transparent"} />;
        })}
      </div>
      <div className="absolute flex h-9 w-9 items-center justify-center rounded-lg bg-white p-1 shadow">
        <img src={logoIcon} alt="" className="h-full w-full rounded" />
      </div>
    </div>
  );
}
