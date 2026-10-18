"use client";

import { useId, useMemo } from "react";
import {
  layoutAreaValueLabels,
  resolveAreaValueLabelCount,
} from "./area-value-label-layout";
import type { LineConfig } from "./chart-context";
import { chartCssVars, useChartStable } from "./chart-context";
import { selectEvenlySpacedIndices } from "./x-axis";

/** One final layer shares label space across every line series. */
export function LineValueLabels({ series }: { series: LineConfig[] }) {
  const {
    chartPhase,
    data,
    innerHeight,
    innerWidth,
    xAccessor,
    xScale,
    yScale,
    yScales,
  } = useChartStable();
  const id = useId();
  const labels = useMemo(() => {
    if (!["revealing", "ready", "exitingReady"].includes(chartPhase)) {
      return [];
    }
    const visible = data
      .map((datum, index) => ({ datum, index, x: xScale(xAccessor(datum)) }))
      .filter(({ x }) => Number.isFinite(x) && x >= 0 && x <= innerWidth);

    return series.flatMap((line, seriesIndex) => {
      if (!line.showValue) {
        return [];
      }
      const scale = yScales[String(line.yAxisId ?? "left")] ?? yScale;
      const points = visible.filter(
        ({ datum }) =>
          typeof datum[line.dataKey] === "number" &&
          Number.isFinite(datum[line.dataKey])
      );
      const count = resolveAreaValueLabelCount(
        points.length,
        innerWidth,
        2,
        points.length
      );
      const indices =
        count === 1 ? [0] : selectEvenlySpacedIndices(points.length, count);

      return indices.flatMap((position) => {
        const point = position == null ? undefined : points[position];
        if (!point) {
          return [];
        }
        const value = point.datum[line.dataKey] as number;
        const y = scale(value);
        if (!Number.isFinite(y)) {
          return [];
        }
        const text =
          line.valueLabelFormatter?.(value) ??
          value.toLocaleString("fa-IR", { maximumFractionDigits: 0 });
        return [
          {
            index: point.index,
            seriesIndex,
            x: point.x,
            y,
            width: text.length * 7 + 8,
            height: 12,
            text,
            color:
              typeof line.valueLabelColor === "function"
                ? line.valueLabelColor(value)
                : (line.valueLabelColor ??
                  line.stroke ??
                  chartCssVars.linePrimary),
          },
        ];
      });
    });
  }, [
    chartPhase,
    data,
    innerWidth,
    series,
    xAccessor,
    xScale,
    yScale,
    yScales,
  ]);
  const placed = useMemo(
    () => layoutAreaValueLabels(labels, innerWidth, innerHeight),
    [innerHeight, innerWidth, labels]
  );

  if (!placed.length) {
    return null;
  }

  return (
    <g pointerEvents="none">
      <defs>
        <filter
          colorInterpolationFilters="sRGB"
          height="200%"
          id={`line-value-label-halo-${id}`}
          width="160%"
          x="-30%"
          y="-50%"
        >
          <feMorphology
            in="SourceAlpha"
            operator="dilate"
            radius={1.5}
            result="expandedText"
          />
          <feGaussianBlur
            in="expandedText"
            result="softHalo"
            stdDeviation={1.25}
          />
          <feFlood floodColor="var(--background)" result="haloColor" />
          <feComposite
            in="haloColor"
            in2="softHalo"
            operator="in"
            result="halo"
          />
          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fontSize={10} fontWeight={600} textAnchor="middle">
        {placed.map((label) => {
          const item = labels[label.source];
          if (!item) {
            return null;
          }
          return (
            <text
              direction="ltr"
              dominantBaseline="middle"
              fill={item.color}
              filter={`url(#line-value-label-halo-${id})`}
              key={`${item.seriesIndex}-${item.index}`}
              x={label.x}
              y={label.y}
            >
              {item.text}
            </text>
          );
        })}
      </g>
    </g>
  );
}
