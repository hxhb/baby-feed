// WHO Child Growth Standards (0-24 months)
// Source: WHO Multicentre Growth Reference Study (MGRS)
// Weight-for-age and Length/Height-for-age percentiles (P3, P15, P50, P85, P97)

export interface WHODataPoint {
  /** Age in months */
  month: number
  P3: number
  P15: number
  P50: number
  P85: number
  P97: number
}

// ==================== BOYS ====================

// Weight-for-age (kg), Boys 0-24 months
export const boysWeightForAge: WHODataPoint[] = [
  { month: 0, P3: 2.5, P15: 2.9, P50: 3.3, P85: 3.9, P97: 4.3 },
  { month: 1, P3: 3.4, P15: 3.9, P50: 4.5, P85: 5.1, P97: 5.7 },
  { month: 2, P3: 4.3, P15: 4.9, P50: 5.6, P85: 6.3, P97: 7.0 },
  { month: 3, P3: 5.0, P15: 5.7, P50: 6.4, P85: 7.2, P97: 7.9 },
  { month: 4, P3: 5.6, P15: 6.3, P50: 7.0, P85: 7.8, P97: 8.6 },
  { month: 5, P3: 6.0, P15: 6.7, P50: 7.5, P85: 8.4, P97: 9.2 },
  { month: 6, P3: 6.4, P15: 7.1, P50: 7.9, P85: 8.8, P97: 9.7 },
  { month: 7, P3: 6.7, P15: 7.4, P50: 8.3, P85: 9.2, P97: 10.2 },
  { month: 8, P3: 6.9, P15: 7.7, P50: 8.6, P85: 9.6, P97: 10.5 },
  { month: 9, P3: 7.1, P15: 8.0, P50: 8.9, P85: 9.9, P97: 10.9 },
  { month: 10, P3: 7.4, P15: 8.2, P50: 9.2, P85: 10.2, P97: 11.2 },
  { month: 11, P3: 7.6, P15: 8.4, P50: 9.4, P85: 10.5, P97: 11.5 },
  { month: 12, P3: 7.7, P15: 8.6, P50: 9.6, P85: 10.8, P97: 11.8 },
  { month: 13, P3: 7.9, P15: 8.8, P50: 9.9, P85: 11.0, P97: 12.1 },
  { month: 14, P3: 8.1, P15: 9.0, P50: 10.1, P85: 11.3, P97: 12.4 },
  { month: 15, P3: 8.3, P15: 9.2, P50: 10.3, P85: 11.5, P97: 12.7 },
  { month: 16, P3: 8.4, P15: 9.4, P50: 10.5, P85: 11.7, P97: 12.9 },
  { month: 17, P3: 8.6, P15: 9.6, P50: 10.7, P85: 12.0, P97: 13.2 },
  { month: 18, P3: 8.8, P15: 9.8, P50: 10.9, P85: 12.2, P97: 13.5 },
  { month: 19, P3: 8.9, P15: 10.0, P50: 11.1, P85: 12.5, P97: 13.7 },
  { month: 20, P3: 9.1, P15: 10.1, P50: 11.3, P85: 12.7, P97: 14.0 },
  { month: 21, P3: 9.2, P15: 10.3, P50: 11.5, P85: 12.9, P97: 14.3 },
  { month: 22, P3: 9.4, P15: 10.5, P50: 11.8, P85: 13.2, P97: 14.5 },
  { month: 23, P3: 9.5, P15: 10.7, P50: 12.0, P85: 13.4, P97: 14.8 },
  { month: 24, P3: 9.7, P15: 10.8, P50: 12.2, P85: 13.6, P97: 15.1 },
]

// Length/Height-for-age (cm), Boys 0-24 months
export const boysLengthForAge: WHODataPoint[] = [
  { month: 0, P3: 46.3, P15: 47.9, P50: 49.9, P85: 51.8, P97: 53.4 },
  { month: 1, P3: 51.1, P15: 52.7, P50: 54.7, P85: 56.7, P97: 58.4 },
  { month: 2, P3: 54.7, P15: 56.4, P50: 58.4, P85: 60.4, P97: 62.2 },
  { month: 3, P3: 57.6, P15: 59.3, P50: 61.4, P85: 63.5, P97: 65.3 },
  { month: 4, P3: 59.9, P15: 61.7, P50: 63.9, P85: 66.0, P97: 67.8 },
  { month: 5, P3: 61.8, P15: 63.6, P50: 65.9, P85: 68.1, P97: 70.0 },
  { month: 6, P3: 63.4, P15: 65.2, P50: 67.6, P85: 69.9, P97: 71.9 },
  { month: 7, P3: 64.8, P15: 66.7, P50: 69.2, P85: 71.6, P97: 73.5 },
  { month: 8, P3: 66.2, P15: 68.1, P50: 70.6, P85: 73.1, P97: 75.1 },
  { month: 9, P3: 67.5, P15: 69.4, P50: 72.0, P85: 74.5, P97: 76.5 },
  { month: 10, P3: 68.7, P15: 70.6, P50: 73.3, P85: 75.9, P97: 77.9 },
  { month: 11, P3: 69.9, P15: 71.9, P50: 74.5, P85: 77.1, P97: 79.2 },
  { month: 12, P3: 71.0, P15: 73.0, P50: 75.7, P85: 78.4, P97: 80.5 },
  { month: 13, P3: 72.1, P15: 74.1, P50: 76.9, P85: 79.6, P97: 81.8 },
  { month: 14, P3: 73.1, P15: 75.2, P50: 78.0, P85: 80.8, P97: 83.0 },
  { month: 15, P3: 74.1, P15: 76.2, P50: 79.1, P85: 82.0, P97: 84.2 },
  { month: 16, P3: 75.0, P15: 77.2, P50: 80.2, P85: 83.1, P97: 85.4 },
  { month: 17, P3: 76.0, P15: 78.2, P50: 81.2, P85: 84.2, P97: 86.5 },
  { month: 18, P3: 76.9, P15: 79.1, P50: 82.3, P85: 85.4, P97: 87.7 },
  { month: 19, P3: 77.7, P15: 80.0, P50: 83.2, P85: 86.4, P97: 88.8 },
  { month: 20, P3: 78.6, P15: 80.9, P50: 84.2, P85: 87.5, P97: 89.8 },
  { month: 21, P3: 79.4, P15: 81.8, P50: 85.1, P85: 88.5, P97: 91.0 },
  { month: 22, P3: 80.2, P15: 82.6, P50: 86.0, P85: 89.5, P97: 92.0 },
  { month: 23, P3: 81.0, P15: 83.5, P50: 86.9, P85: 90.4, P97: 93.0 },
  { month: 24, P3: 81.7, P15: 84.3, P50: 87.8, P85: 91.4, P97: 94.0 },
]

// ==================== GIRLS ====================

// Weight-for-age (kg), Girls 0-24 months
export const girlsWeightForAge: WHODataPoint[] = [
  { month: 0, P3: 2.4, P15: 2.8, P50: 3.2, P85: 3.7, P97: 4.2 },
  { month: 1, P3: 3.2, P15: 3.6, P50: 4.2, P85: 4.8, P97: 5.4 },
  { month: 2, P3: 3.9, P15: 4.5, P50: 5.1, P85: 5.9, P97: 6.5 },
  { month: 3, P3: 4.5, P15: 5.1, P50: 5.8, P85: 6.7, P97: 7.4 },
  { month: 4, P3: 5.0, P15: 5.6, P50: 6.4, P85: 7.3, P97: 8.1 },
  { month: 5, P3: 5.4, P15: 6.1, P50: 6.9, P85: 7.8, P97: 8.7 },
  { month: 6, P3: 5.7, P15: 6.4, P50: 7.3, P85: 8.3, P97: 9.2 },
  { month: 7, P3: 6.0, P15: 6.7, P50: 7.6, P85: 8.7, P97: 9.6 },
  { month: 8, P3: 6.3, P15: 7.0, P50: 8.0, P85: 9.0, P97: 10.0 },
  { month: 9, P3: 6.5, P15: 7.3, P50: 8.2, P85: 9.3, P97: 10.4 },
  { month: 10, P3: 6.7, P15: 7.5, P50: 8.5, P85: 9.6, P97: 10.7 },
  { month: 11, P3: 6.9, P15: 7.7, P50: 8.7, P85: 9.9, P97: 11.0 },
  { month: 12, P3: 7.0, P15: 7.9, P50: 8.9, P85: 10.1, P97: 11.3 },
  { month: 13, P3: 7.2, P15: 8.1, P50: 9.2, P85: 10.4, P97: 11.6 },
  { month: 14, P3: 7.4, P15: 8.3, P50: 9.4, P85: 10.6, P97: 11.9 },
  { month: 15, P3: 7.6, P15: 8.5, P50: 9.6, P85: 10.9, P97: 12.2 },
  { month: 16, P3: 7.7, P15: 8.7, P50: 9.8, P85: 11.1, P97: 12.5 },
  { month: 17, P3: 7.9, P15: 8.9, P50: 10.0, P85: 11.4, P97: 12.7 },
  { month: 18, P3: 8.1, P15: 9.1, P50: 10.2, P85: 11.6, P97: 13.0 },
  { month: 19, P3: 8.2, P15: 9.2, P50: 10.4, P85: 11.8, P97: 13.3 },
  { month: 20, P3: 8.4, P15: 9.4, P50: 10.6, P85: 12.1, P97: 13.5 },
  { month: 21, P3: 8.6, P15: 9.6, P50: 10.9, P85: 12.3, P97: 13.8 },
  { month: 22, P3: 8.7, P15: 9.8, P50: 11.1, P85: 12.5, P97: 14.1 },
  { month: 23, P3: 8.9, P15: 10.0, P50: 11.3, P85: 12.8, P97: 14.3 },
  { month: 24, P3: 9.0, P15: 10.2, P50: 11.5, P85: 13.0, P97: 14.6 },
]

// Length/Height-for-age (cm), Girls 0-24 months
export const girlsLengthForAge: WHODataPoint[] = [
  { month: 0, P3: 45.6, P15: 47.1, P50: 49.1, P85: 51.1, P97: 52.7 },
  { month: 1, P3: 50.0, P15: 51.5, P50: 53.7, P85: 55.8, P97: 57.4 },
  { month: 2, P3: 53.2, P15: 54.9, P50: 57.1, P85: 59.2, P97: 59.9 },
  { month: 3, P3: 55.8, P15: 57.5, P50: 59.8, P85: 62.1, P97: 63.8 },
  { month: 4, P3: 57.8, P15: 59.6, P50: 62.1, P85: 64.5, P97: 66.2 },
  { month: 5, P3: 59.6, P15: 61.4, P50: 64.0, P85: 66.4, P97: 68.2 },
  { month: 6, P3: 61.0, P15: 63.0, P50: 65.7, P85: 68.2, P97: 70.0 },
  { month: 7, P3: 62.5, P15: 64.4, P50: 67.3, P85: 69.8, P97: 71.7 },
  { month: 8, P3: 63.7, P15: 65.8, P50: 68.7, P85: 71.4, P97: 73.3 },
  { month: 9, P3: 65.0, P15: 67.0, P50: 70.1, P85: 72.8, P97: 74.8 },
  { month: 10, P3: 66.2, P15: 68.2, P50: 71.5, P85: 74.2, P97: 76.1 },
  { month: 11, P3: 67.4, P15: 69.4, P50: 72.8, P85: 75.5, P97: 77.5 },
  { month: 12, P3: 68.6, P15: 70.6, P50: 74.0, P85: 76.8, P97: 78.9 },
  { month: 13, P3: 69.8, P15: 71.8, P50: 75.2, P85: 78.1, P97: 80.2 },
  { month: 14, P3: 70.9, P15: 72.9, P50: 76.4, P85: 79.3, P97: 81.4 },
  { month: 15, P3: 72.0, P15: 74.1, P50: 77.5, P85: 80.5, P97: 82.7 },
  { month: 16, P3: 73.0, P15: 75.2, P50: 78.6, P85: 81.7, P97: 83.9 },
  { month: 17, P3: 74.1, P15: 76.3, P50: 79.7, P85: 82.9, P97: 85.2 },
  { month: 18, P3: 75.1, P15: 77.3, P50: 80.7, P85: 84.0, P97: 86.4 },
  { month: 19, P3: 76.0, P15: 78.3, P50: 81.7, P85: 85.1, P97: 87.5 },
  { month: 20, P3: 77.0, P15: 79.3, P50: 82.7, P85: 86.2, P97: 88.7 },
  { month: 21, P3: 77.9, P15: 80.3, P50: 83.7, P85: 87.3, P97: 89.8 },
  { month: 22, P3: 78.8, P15: 81.2, P50: 84.6, P85: 88.3, P97: 90.8 },
  { month: 23, P3: 79.7, P15: 82.1, P50: 85.5, P85: 89.3, P97: 91.9 },
  { month: 24, P3: 80.5, P15: 83.0, P50: 86.4, P85: 90.2, P97: 92.9 },
]

export type GrowthMetric = 'weight' | 'height'

/**
 * Get WHO growth standard data for a given gender and metric
 */
export function getWHOData(gender: string, metric: GrowthMetric): WHODataPoint[] {
  if (metric === 'weight') {
    return gender === 'FEMALE' ? girlsWeightForAge : boysWeightForAge
  }
  return gender === 'FEMALE' ? girlsLengthForAge : boysLengthForAge
}

/**
 * Interpolate WHO percentile value at a fractional month age
 */
function interpolateWHO(data: WHODataPoint[], monthAge: number, percentile: keyof Omit<WHODataPoint, 'month'>): number {
  if (monthAge <= 0) return data[0][percentile]
  if (monthAge >= 24) return data[data.length - 1][percentile]

  const lowerIdx = Math.floor(monthAge)
  const upperIdx = Math.ceil(monthAge)

  if (lowerIdx === upperIdx || upperIdx >= data.length) {
    return data[Math.min(lowerIdx, data.length - 1)][percentile]
  }

  const fraction = monthAge - lowerIdx
  const lowerVal = data[lowerIdx][percentile]
  const upperVal = data[upperIdx][percentile]

  return Number((lowerVal + fraction * (upperVal - lowerVal)).toFixed(2))
}

export interface WHOGrowthCurvePoint {
  /** Age in months (fractional) */
  ageMonths: number
  /** Formatted label */
  label: string
  P3: number
  P15: number
  P50: number
  P85: number
  P97: number
}

/**
 * Generate WHO growth curve data points for a given age range.
 * The curve covers from minMonth to maxMonth with 1-month step.
 */
export function generateWHOCurve(
  gender: string,
  metric: GrowthMetric,
  minMonth: number,
  maxMonth: number,
): WHOGrowthCurvePoint[] {
  const data = getWHOData(gender, metric)
  const points: WHOGrowthCurvePoint[] = []

  const start = Math.max(0, Math.floor(minMonth))
  const end = Math.min(24, Math.ceil(maxMonth))

  for (let m = start; m <= end; m++) {
    points.push({
      ageMonths: m,
      label: `${m}月龄`,
      P3: interpolateWHO(data, m, 'P3'),
      P15: interpolateWHO(data, m, 'P15'),
      P50: interpolateWHO(data, m, 'P50'),
      P85: interpolateWHO(data, m, 'P85'),
      P97: interpolateWHO(data, m, 'P97'),
    })
  }

  return points
}
