/* global d3 */

const LIFE_TREE_DATA = {
  name: "Life",
  children: [
    {
      name: "Work",
      children: [
        { name: "Finance" },
        { name: "Home" },
        { name: "Life structuring" },
        { name: "Goals" },
        { name: "Job" },
        {
          name: "Projects",
          children: [
            { name: "AI-Assisted Applications + Interview Prep Platform" },
            {
              name: "AI-Assisted General Integrated Automation + Learning Platform",
              children: [
                {
                  name: "Why it should be a learning platform",
                  children: [{ name: "To know what you build" }],
                },
                {
                  name: "Integrations",
                  children: [{ name: "openclaw" }],
                },
              ],
            },
            { name: "Foundational Research" },
          ],
        },
      ],
    },
    {
      name: "Health",
      children: [
        {
          name: "Body",
          children: [
            { name: "Basketball" },
            { name: "Tennis" },
            { name: "Skating" },
            { name: "Climbing" },
            { name: "Swimming" },
            { name: "Cycling" },
            { name: "Strength" },
            { name: "Focus points" },
          ],
        },
        {
          name: "Mind",
          children: [
            { name: "Logs" },
            {
              name: "Transformation mediums",
              children: [{ name: "Math" }, { name: "Physics" }, { name: "Computer science" }, { name: "AI" }],
            },
          ],
        },
        { name: "Goals" },
      ],
    },
    {
      name: "Relationships",
      children: [{ name: "Family" }, { name: "Friends" }, { name: "Goals" }, { name: "Unfamiliars" }],
    },
    { name: "OS 1" },
  ],
};

function initLifeTree() {
  if (typeof d3 === "undefined") {
    throw new Error("D3 not found. Ensure the D3 script is loaded before tree.js.");
  }

  const svg = d3.select("#treeSvg");
  if (svg.empty()) return;

  // Zoom container: zoom/pan transform is applied here.
  const gZoom = svg.append("g").attr("class", "treeZoom");
  // Content container: margin translation applied here.
  const g = gZoom.append("g").attr("class", "treeContent");

  const linkGen = d3
    .linkHorizontal()
    .x((d) => d.y)
    .y((d) => d.x);

  const state = {
    i: 0,
    hasUserInteracted: false,
    margin: { top: 36, right: 60, bottom: 36, left: 60 },
    nodeRowSpacing: 34,
    nodeColSpacing: 190,
  };

  const root = d3.hierarchy(LIFE_TREE_DATA);
  root.x0 = 0;
  root.y0 = 0;

  // Start with an “overview”: show root + top-level, keep deeper nodes collapsed.
  if (root.children) root.children.forEach(collapse);

  const zoom = d3
    .zoom()
    .scaleExtent([0.15, 2.5])
    .on("zoom", (event) => {
      if (event.sourceEvent) state.hasUserInteracted = true;
      gZoom.attr("transform", event.transform);
    });

  svg.call(zoom).on("dblclick.zoom", null);

  function getViewport() {
    const node = svg.node();
    const width = node?.clientWidth ?? 0;
    const height = node?.clientHeight ?? 0;
    return {
      width: width > 0 ? width : window.innerWidth,
      height: height > 0 ? height : window.innerHeight,
    };
  }

  function layoutTree() {
    const tree = d3.tree().nodeSize([state.nodeRowSpacing, state.nodeColSpacing]);
    tree(root);
    root.descendants().forEach((d) => {
      // Left-to-right growth: depth controls horizontal distance (y-axis here).
      d.y = d.depth * state.nodeColSpacing;
    });
    const nodes = root.descendants();
    const links = root.links();

    // Position "OS 1" to the far right and roughly centered vertically.
    const os1 = nodes.find((d) => d.data?.name === "OS 1");
    if (os1) {
      const otherNodes = nodes.filter((d) => d !== os1);
      const maxY = (d3.max(otherNodes, (d) => d.y) ?? 0) + state.nodeColSpacing;
      os1.y = maxY;

      const goalNodes = nodes.filter((d) => d.data?.name === "Goals");
      const centerFromGoals = goalNodes.length
        ? d3.mean(goalNodes, (d) => d.x)
        : (() => {
            const nonRoot = otherNodes.filter((d) => d.depth > 0);
            const minX = d3.min(nonRoot, (d) => d.x);
            const maxX = d3.max(nonRoot, (d) => d.x);
            if (typeof minX === "number" && typeof maxX === "number") return (minX + maxX) / 2;
            return 0;
          })();

      os1.x = typeof centerFromGoals === "number" ? centerFromGoals : 0;
    }

    return { nodes, links };
  }

  function update({ fit = false } = {}) {
    const { width, height } = getViewport();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    g.attr("transform", `translate(${state.margin.left},${state.margin.top})`);

    const { nodes, links } = layoutTree();

    // Ensure stable node ids before we key any joins off them.
    nodes.forEach((d) => {
      if (!d.id) d.id = ++state.i;
    });

    // Hide the default tree link "Life → OS 1"; we'll connect Goals → OS 1 instead.
    const treeLinks = links.filter((l) => l.target?.data?.name !== "OS 1");

    // Links
    const linkSel = g.selectAll("path.treeLink").data(treeLinks, (d) => d.target.id);

    linkSel
      .enter()
      .append("path")
      .attr("class", "treeLink")
      .attr("d", (d) => linkGen({ source: d.source, target: d.target }))
      .merge(linkSel)
      .attr("d", (d) => linkGen({ source: d.source, target: d.target }));

    linkSel.exit().remove();

    // Cross-links: connect all visible "Goals" nodes to the single "OS 1" node.
    const os1 = nodes.find((d) => d.data?.name === "OS 1");
    const goalNodes = nodes.filter((d) => d.data?.name === "Goals");
    const crossLinks =
      os1 && goalNodes.length ? goalNodes.map((gNode) => ({ source: gNode, target: os1 })) : [];

    const crossSel = g
      .selectAll("path.treeLinkCross")
      .data(crossLinks, (d) => `${d.source.id}->${d.target.id}`);

    crossSel
      .enter()
      .append("path")
      .attr("class", "treeLink treeLinkCross")
      .attr("d", (d) => linkGen({ source: d.source, target: d.target }))
      .merge(crossSel)
      .attr("d", (d) => linkGen({ source: d.source, target: d.target }));

    crossSel.exit().remove();

    // Nodes
    const nodeSel = g.selectAll("g.treeNode").data(nodes, (d) => {
      return d.id;
    });

    const nodeEnter = nodeSel
      .enter()
      .append("g")
      .attr("class", "treeNode")
      .attr("transform", (d) => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.preventDefault();
        toggle(d);
        update({ fit: false });
      });

    nodeEnter
      .append("circle")
      .attr("r", (d) => (d.depth === 0 ? 9 : 7));

    nodeEnter
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d) => (d.depth === 0 ? 14 : 12))
      .attr("text-anchor", "start")
      .text((d) => d.data.name);

    nodeEnter.append("title").text((d) => d.data.name);

    const nodeMerge = nodeEnter.merge(nodeSel);

    nodeMerge
      .attr("transform", (d) => `translate(${d.y},${d.x})`)
      .classed("treeNode--internal", (d) => Boolean(d.children))
      .classed("treeNode--leaf", (d) => !d.children && !d._children)
      .classed("treeNode--collapsed", (d) => Boolean(d._children) && !d.children);

    nodeSel.exit().remove();

    if (fit && !state.hasUserInteracted) {
      fitToView({ width, height, nodes });
    }
  }

  function fitToView({ width, height, nodes }) {
    const padding = 40;
    const points = nodes.map((d) => ({
      // Convert to SVG coordinates after margins are applied.
      x: d.y + state.margin.left,
      y: d.x + state.margin.top,
    }));

    const minX = d3.min(points, (p) => p.x) ?? 0;
    const maxX = d3.max(points, (p) => p.x) ?? 0;
    const minY = d3.min(points, (p) => p.y) ?? 0;
    const maxY = d3.max(points, (p) => p.y) ?? 0;

    const boxW = Math.max(1, maxX - minX);
    const boxH = Math.max(1, maxY - minY);

    const scale = Math.max(
      0.15,
      Math.min(2.5, Math.min((width - padding * 2) / boxW, (height - padding * 2) / boxH)),
    );

    const tx = width / 2 - scale * (minX + maxX) / 2;
    const ty = height / 2 - scale * (minY + maxY) / 2;

    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function toggle(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
      return;
    }
    if (d._children) {
      d.children = d._children;
      d._children = null;
    }
  }

  function collapse(d) {
    if (!d.children) return;
    d._children = d.children;
    d.children = null;
    d._children.forEach(collapse);
  }

  update({ fit: true });

  window.addEventListener(
    "resize",
    () => {
      update({ fit: true });
    },
    { passive: true },
  );
}

initLifeTree();
