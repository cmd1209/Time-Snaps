export const chartLineWidth = 3;
export const chartDotRadius = 3.5;
export const chartAreaOpacity = 0.28;

export function ChartLineGlow({ id, color, x, y, width, height }: { id: string; color: string; x: number; y: number; width: number; height: number }) {
  return <filter id={id} x={x} y={y} width={width} height={height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="blur" />
    <feFlood floodColor={color} floodOpacity="0.75" result="tint" />
    <feComposite in="tint" in2="blur" operator="in" result="glow" />
    <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
  </filter>;
}
