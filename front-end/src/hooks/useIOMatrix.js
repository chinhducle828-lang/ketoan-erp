import { useState, useEffect, useCallback } from 'react';

/**
 * Hook quản lý I-O Matrix data
 * Fetch và transform data từ backend /api/io-matrix
 */
export default function useIOMatrix(period = 'month') {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch I-O Matrix data
  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/io-matrix?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMatrixData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch I-O Matrix:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchMatrix();

    const interval = setInterval(() => {
      fetchMatrix();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchMatrix]);

  // Transform data for Sankey chart
  const getSankeyData = useCallback(() => {
    if (!matrixData?.flows) return { nodes: [], links: [] };

    const nodeMap = new Map();
    const nodes = [];
    const links = [];

    // Create nodes
    matrixData.flows.forEach((flow, index) => {
      if (!nodeMap.has(flow.source)) {
        nodeMap.set(flow.source, nodes.length);
        nodes.push({ id: flow.source, name: flow.source_name || flow.source });
      }
      if (!nodeMap.has(flow.target)) {
        nodeMap.set(flow.target, nodes.length);
        nodes.push({ id: flow.target, name: flow.target_name || flow.target });
      }
    });

    // Create links
    matrixData.flows.forEach((flow) => {
      links.push({
        source: nodeMap.get(flow.source),
        target: nodeMap.get(flow.target),
        value: flow.amount,
        type: flow.type, // 'material', 'product', 'waste'
      });
    });

    return { nodes, links };
  }, [matrixData]);

  // Get summary statistics
  const getSummary = useCallback(() => {
    if (!matrixData) return null;

    const totalInput = matrixData.flows
      .filter(f => f.type === 'material')
      .reduce((sum, f) => sum + f.amount, 0);

    const totalOutput = matrixData.flows
      .filter(f => f.type === 'product')
      .reduce((sum, f) => sum + f.amount, 0);

    const totalWaste = matrixData.flows
      .filter(f => f.type === 'waste')
      .reduce((sum, f) => sum + f.amount, 0);

    const efficiency = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;

    return {
      totalInput,
      totalOutput,
      totalWaste,
      efficiency,
      inputOutputRatio: totalInput > 0 ? totalOutput / totalInput : 0,
    };
  }, [matrixData]);

  // Get department-wise breakdown
  const getDepartmentBreakdown = useCallback(() => {
    if (!matrixData?.flows) return [];

    const deptMap = new Map();

    matrixData.flows.forEach((flow) => {
      const dept = flow.source_dept || flow.target_dept || 'Unknown';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { department: dept, input: 0, output: 0, waste: 0 });
      }

      const deptData = deptMap.get(dept);
      if (flow.type === 'material') {
        deptData.input += flow.amount;
      } else if (flow.type === 'product') {
        deptData.output += flow.amount;
      } else if (flow.type === 'waste') {
        deptData.waste += flow.amount;
      }
    });

    return Array.from(deptMap.values());
  }, [matrixData]);

  return {
    matrixData,
    loading,
    error,
    lastUpdated,
    fetchMatrix,
    getSankeyData,
    getSummary,
    getDepartmentBreakdown,
  };
}

/**
 * Hook cho real-time I-O Matrix updates
 * Khi có event mới, tự động refresh
 */
export function useRealtimeIOMatrix(period = 'month') {
  const [isLive, setIsLive] = useState(true);
  const ioMatrix = useIOMatrix(period);

  // Listen for new events via WebSocket or polling
  useEffect(() => {
    if (!isLive) return;

    // Poll for new events every 10 seconds
    const interval = setInterval(() => {
      // Check if there are new events since last update
      const lastEventId = localStorage.getItem('lastEventId');
      
      fetch(`/api/events/latest?since=${lastEventId || 0}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.has_new_events) {
            // Refresh I-O Matrix
            ioMatrix.fetchMatrix();
            localStorage.setItem('lastEventId', data.latest_event_id);
          }
        })
        .catch(err => console.error('Failed to check new events:', err));
    }, 10000);

    return () => clearInterval(interval);
  }, [isLive, ioMatrix]);

  const toggleLive = useCallback(() => {
    setIsLive((prev) => !prev);
  }, []);

  return {
    ...ioMatrix,
    isLive,
    toggleLive,
  };
}