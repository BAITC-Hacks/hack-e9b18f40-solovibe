"use client";

import { useId, type CSSProperties, type SVGAttributes } from "react";
import { cn } from "../ui/utils";

export interface CitySculptureProps extends Omit<SVGAttributes<SVGSVGElement>, "children"> {
  districtValues?: readonly number[];
  selectedDistrictIndex?: number | null;
  label?: string;
}

interface BlockGeometry {
  x: number;
  y: number;
  width: number;
  depth: number;
  minHeight: number;
  maxHeight: number;
}

const blocks: readonly BlockGeometry[] = [
  { x: 154, y: 306, width: 70, depth: 28, minHeight: 78, maxHeight: 158 },
  { x: 240, y: 278, width: 86, depth: 32, minHeight: 112, maxHeight: 220 },
  { x: 340, y: 313, width: 76, depth: 29, minHeight: 92, maxHeight: 184 },
  { x: 425, y: 270, width: 91, depth: 34, minHeight: 134, maxHeight: 244 },
  { x: 532, y: 297, width: 68, depth: 27, minHeight: 86, maxHeight: 166 },
];

const defaultValues = [0.22, 0.63, 0.38, 0.82, 0.3] as const;

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function CitySculpture({
  districtValues,
  selectedDistrictIndex = null,
  label,
  className,
  style,
  ...props
}: CitySculptureProps) {
  const rawId = useId().replaceAll(":", "");
  const porcelainId = `porcelain-${rawId}`;
  const enamelId = `enamel-${rawId}`;
  const shadowId = `shadow-${rawId}`;

  return (
    <svg
      viewBox="0 0 760 470"
      className={cn("h-auto w-full overflow-visible", className)}
      style={{ "--sculpture-accent": "var(--accent)", ...style } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      <defs>
        <linearGradient id={porcelainId} x1="0" y1="0" x2="0.82" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.48" stopColor="#f4f8f5" />
          <stop offset="1" stopColor="#dce7e1" />
        </linearGradient>
        <linearGradient id={enamelId} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#1b9b89" />
          <stop offset="0.45" stopColor="var(--sculpture-accent)" />
          <stop offset="1" stopColor="var(--accent-dark)" />
        </linearGradient>
        <filter id={shadowId} x="-30%" y="-50%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>

      <ellipse cx="390" cy="403" rx="292" ry="34" fill="#153e3921" filter={`url(#${shadowId})`} />

      <path
        d="M90 302 522 221c16-3 31-1 44 6l115 60c9 5 8 13-3 16l-437 112c-18 5-37 3-51-5L83 319c-8-6-5-14 7-17Z"
        fill="#d5e1da"
      />
      <path
        d="M84 307c-4 4-2 9 5 14l101 89c14 9 33 11 51 6l437-112c6-2 10-5 10-8v18c0 5-4 9-12 11L243 438c-19 5-39 3-54-7L84 340c-6-5-9-10-8-15Z"
        fill="#b8cbc2"
      />
      <path
        d="M90 289 522 208c16-3 31-1 44 6l115 60c9 5 8 13-3 16L241 402c-18 5-37 3-51-5L83 306c-8-6-5-14 7-17Z"
        fill={`url(#${porcelainId})`}
        stroke="#ffffff"
        strokeWidth="3"
      />

      <path
        d="M128 361c111 21 212 9 305-22 91-30 157-54 221-84"
        fill="none"
        stroke="#183c3920"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M126 351c109 19 211 7 302-23 91-30 157-54 220-84"
        fill="none"
        stroke={`url(#${enamelId})`}
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="M126 347c109 19 211 7 302-23 91-30 157-54 220-84"
        fill="none"
        stroke="#ffffff55"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {blocks.map((block, index) => {
        const value = clamp(districtValues?.[index] ?? defaultValues[index]);
        const height = block.minHeight + (block.maxHeight - block.minHeight) * value;
        const rise = block.depth * 0.56;
        const selected = selectedDistrictIndex === index;
        const top = block.y - height;
        const outline = selected ? "var(--accent)" : "#c9d8d1";
        return (
          <g
            key={index}
            className="transition-[filter,opacity] duration-300 ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none"
            style={selected ? { filter: "drop-shadow(0 10px 12px #087f6f40)" } : undefined}
          >
            <path
              d={`M${block.x + block.width},${top} L${block.x + block.width + block.depth},${top - rise} L${block.x + block.width + block.depth},${block.y - rise} L${block.x + block.width},${block.y} Z`}
              fill={selected ? "#08695c" : "#9eb9ae"}
              stroke={outline}
              strokeWidth={selected ? 3 : 1.5}
              strokeLinejoin="round"
            />
            <path
              d={`M${block.x},${top} L${block.x + block.width},${top} L${block.x + block.width},${block.y} L${block.x},${block.y} Z`}
              fill={selected ? `url(#${enamelId})` : `url(#${porcelainId})`}
              stroke={outline}
              strokeWidth={selected ? 3 : 1.5}
              strokeLinejoin="round"
            />
            <path
              d={`M${block.x},${top} L${block.x + block.depth},${top - rise} L${block.x + block.width + block.depth},${top - rise} L${block.x + block.width},${top} Z`}
              fill={selected ? "#37ad9c" : "#ffffff"}
              stroke={outline}
              strokeWidth={selected ? 3 : 1.5}
              strokeLinejoin="round"
            />
            <path
              d={`M${block.x + 9},${top + 10} L${block.x + 9},${block.y - 12}`}
              fill="none"
              stroke={selected ? "#ffffff55" : "#ffffff"}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
