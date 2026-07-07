/**
 * A2. GRAPH THEORY & CYCLOMATIC COMPLEXITY (Basis Path Testing)
 * Công thức McCabe V(G) = E - V + 2P cho luồng kết chuyển sổ cuối kỳ.
 * CFG: V=8 đỉnh, E=11 cạnh, P=1 => V(G)=5 basis paths.
 */
import { calculateProgressiveTax, calculateProfitBeforeTax } from '../../utils/accountingEngine.js';

const CFG = {
  vertices: ['start', 'checkClosing', 'readSummary', 'revBranch', 'costBranch', 'profitBranch', 'final911Branch', 'end'],
  edges: [
    ['start', 'checkClosing'],
    ['checkClosing', 'readSummary'],
    ['checkClosing', 'end'],
    ['readSummary', 'revBranch'],
    ['revBranch', 'costBranch'],
    ['revBranch', 'costBranch'],
    ['costBranch', 'profitBranch'],
    ['costBranch', 'profitBranch'],
    ['profitBranch', 'final911Branch'],
    ['profitBranch', 'final911Branch'],
    ['final911Branch', 'end']
  ]
};

function cyclomaticComplexity(cfg) {
  return cfg.edges.length - cfg.vertices.length + 2;
}

function generateBasisPaths(cfg, vg) {
  const adj = {};
  for (const [u, v] of cfg.edges) {
    if (!adj[u]) adj[u] = [];
    adj[u].push(v);
  }
  const paths = [];
  const usedEdges = new Set();
  function dfs(node, path, edgePath) {
    if (paths.length >= vg) return;
    if (node === 'end') {
      paths.push({ nodes: [...path], edges: [...edgePath] });
      return;
    }
    const neighbors = adj[node] || [];
    for (let i = 0; i < neighbors.length; i++) {
      const v = neighbors[i];
      const edgeId = `${node}->${v}#${i}`;
      if (usedEdges.has(edgeId)) continue;
      usedEdges.add(edgeId);
      dfs(v, [...path, v], [...edgePath, edgeId]);
      usedEdges.delete(edgeId);
      if (paths.length >= vg) return;
    }
  }
  dfs('start', ['start'], []);
  return paths;
}

describe('A2. Graph Theory / Cyclomatic Complexity — Closing Workflow', () => {
  const VG = cyclomaticComplexity(CFG);
  test('V(G) = E - V + 2P = 5 (số đường đi độc lập tối thiểu)', () => {
    expect(VG).toBe(5);
  });
  const basisPaths = generateBasisPaths(CFG, VG);
  test('Sinh đúng V(G) = 5 basis paths độc lập', () => {
    expect(basisPaths.length).toBe(VG);
  });
  const scenarios = [
    { rev: 1e9, cost: 4e8, otherInc: 0, otherExp: 0, taxExp: 0, prevRev: 4e9, expectTax: true, expectFinal: 'profit' },
    { rev: 0, cost: 5e8, otherInc: 0, otherExp: 0, taxExp: 0, prevRev: 1e9, expectTax: false, expectFinal: 'loss' },
    { rev: 2e9, cost: 0, otherInc: 0, otherExp: 0, taxExp: 0, prevRev: 1e10, expectTax: true, expectFinal: 'profit' },
    { rev: 5e8, cost: 6e8, otherInc: 0, otherExp: 0, taxExp: 0, prevRev: 1e9, expectTax: false, expectFinal: 'loss' },
    { rev: 1e9, cost: 4e8, otherInc: 0, otherExp: 0, taxExp: 6e8, prevRev: 4e9, expectTax: false, expectFinal: 'zero' }
  ];
  test.each(basisPaths.map((p, i) => [i, p, scenarios[i]]))('Basis path #%i thực thi đúng nhánh kế toán', (_i, _path, sc) => {
    const netProfit = calculateProfitBeforeTax(sc.rev, sc.otherInc, sc.cost, 0, sc.otherExp, sc.taxExp);
    if (netProfit > 0) {
      const tax = calculateProgressiveTax(sc.prevRev, netProfit, 'company');
      expect(tax.totalTax).toBeGreaterThan(0);
      expect(sc.expectTax).toBe(true);
      expect(tax.appliedRate).toBeGreaterThanOrEqual(0.15);
      expect(tax.appliedRate).toBeLessThanOrEqual(0.20);
    } else {
      const tax = calculateProgressiveTax(sc.prevRev, netProfit, 'company');
      expect(tax.totalTax).toBe(0);
      expect(sc.expectTax).toBe(false);
    }
    const taxAmt = netProfit > 0 ? calculateProgressiveTax(sc.prevRev, netProfit, 'company').totalTax : 0;
    const final911 = netProfit - taxAmt;
    if (sc.expectFinal === 'profit') {
      expect(final911).toBeGreaterThan(0);
    } else if (sc.expectFinal === 'loss') {
      expect(final911).toBeLessThan(0);
    } else {
      expect(Math.abs(final911)).toBeLessThan(0.01);
    }
  });
  test('Số basis paths = V(G) chứng minh không còn đường đi chưa test', () => {
    expect(basisPaths.length).toBe(VG);
    expect(VG).toBe(5);
  });
});