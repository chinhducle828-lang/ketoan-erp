import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

/**
 * Sankey Chart Component
 * Hiển thị I-O Matrix dưới dạng Sankey diagram
 * Sử dụng D3.js để render
 */
export default function SankeyChart({ data, width = 800, height = 600 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || !data.nodes || !data.links || data.nodes.length === 0) {
      return;
    }

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Create Sankey generator
    const sankey = d3.sankey()
      .nodeWidth(20)
      .nodePadding(20)
      .nodeAlign(d3.sankeyJustify)
      .extent([[1, 1], [width - 1, height - 5]]);

    // Prepare data
    const { nodes, links } = sankey({
      nodes: data.nodes.map(d => ({ ...d })),
      links: data.links.map(d => ({ ...d })),
    });

    // Color scale based on node type
    const colorScale = d3.scaleOrdinal()
      .domain(['material', 'product', 'waste', 'account'])
      .range(['#3b82f6', '#10b981', '#ef4444', '#f59e0b']);

    // Draw links
    const link = svg.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.3)
      .selectAll('g')
      .data(links)
      .join('g')
      .attr('stroke', d => colorScale(d.type || 'account'))
      .attr('stroke-width', d => Math.max(1, d.width));

    link.append('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', d => colorScale(d.type || 'account'))
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => Math.max(1, d.width));

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    node.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => Math.max(1, d.y1 - d.y0))
      .attr('fill', d => colorScale(d.type || 'account'))
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5)
      .attr('rx', 3)
      .attr('ry', 3);

    // Add labels
    node.append('text')
      .attr('x', d => d.x0 < width / 2 ? (d.x1 - d.x0) + 6 : -6)
      .attr('y', d => (d.y1 - d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .text(d => d.name)
      .each(function(d) {
        // Truncate long names
        const text = d3.select(this);
        const maxWidth = 100;
        let textContent = text.text();
        while (text.node().getComputedTextLength() > maxWidth && textContent.length > 0) {
          textContent = textContent.slice(0, -1);
          text.text(textContent + '...');
        }
      });

    // Add value labels on hover
    node.append('title')
      .text(d => `${d.name}\n${d.value?.toLocaleString('vi-VN')}đ`);

  }, [data, width, height]);

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Không có dữ liệu để hiển thị</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <svg ref={svgRef}></svg>
    </div>
  );
}