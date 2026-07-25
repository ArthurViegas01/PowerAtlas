import { describe, expect, it } from 'vitest'

import { correlationMatrix, extent, histogram, mean, pearson, quantile, topN } from './stats'

describe('extent / mean', () => {
  it('finds min and max', () => {
    expect(extent([3, 1, 2])).toEqual({ min: 1, max: 3 })
  })

  it('returns null for an empty list', () => {
    expect(extent([])).toBeNull()
  })

  it('averages', () => {
    expect(mean([2, 4, 6])).toBe(4)
    expect(mean([])).toBe(0)
  })
})

describe('quantile', () => {
  it('interpolates the median', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
  })

  it('handles the extremes', () => {
    expect(quantile([10, 20, 30], 0)).toBe(10)
    expect(quantile([10, 20, 30], 1)).toBe(30)
  })
})

describe('pearson', () => {
  it('is 1 for a perfect positive line', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
  })

  it('is -1 for a perfect negative line', () => {
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1)
  })

  it('is 0 with no variance or too few points', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0)
    expect(pearson([1], [2])).toBe(0)
  })
})

describe('histogram', () => {
  it('bins linearly and counts every value', () => {
    const bins = histogram([0, 1, 2, 3, 4], 2)
    expect(bins).toHaveLength(2)
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(5)
  })

  it('drops non-positive values in log mode but keeps the rest', () => {
    const bins = histogram([0, 1, 10, 100, 1000], 4, true)
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(4)
    expect(bins[0].x0).toBeCloseTo(1)
  })

  it('collapses to one bin when every value is equal', () => {
    expect(histogram([5, 5, 5], 10)).toEqual([{ x0: 5, x1: 5, count: 3 }])
  })
})

describe('topN / correlationMatrix', () => {
  it('takes the largest by accessor', () => {
    expect(topN([{ v: 1 }, { v: 3 }, { v: 2 }], (i) => i.v, 2)).toEqual([{ v: 3 }, { v: 2 }])
  })

  it('has a unit diagonal and is symmetric', () => {
    const m = correlationMatrix([
      { key: 'a', values: [1, 2, 3] },
      { key: 'b', values: [2, 4, 6] },
    ])
    expect(m[0][0]).toBe(1)
    expect(m[1][1]).toBe(1)
    expect(m[0][1]).toBeCloseTo(m[1][0])
  })
})
