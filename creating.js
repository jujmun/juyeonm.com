(function () {
  var NS = "http://www.w3.org/2000/svg";
  var VIEW_W = 1000;
  var VIEW_H = 560;
  var HUB_R = 5.5;
  var NODE_R = 3.5;

  function svgEl(name, attrs) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] != null) node.setAttribute(key, String(attrs[key]));
    });
    return node;
  }

  function hubAnchor(cluster) {
    if (cluster === "technical") return { x: VIEW_W * 0.3, y: VIEW_H * 0.5 };
    return { x: VIEW_W * 0.7, y: VIEW_H * 0.5 };
  }

  function layout(nodes) {
    var byCluster = {};
    var positions = {};

    nodes.forEach(function (node) {
      if (!byCluster[node.cluster]) byCluster[node.cluster] = [];
      if (node.hub) {
        var at = hubAnchor(node.cluster);
        positions[node.id] = {
          id: node.id,
          label: node.label,
          hub: true,
          cluster: node.cluster,
          r: HUB_R,
          x: at.x,
          y: at.y
        };
      } else {
        byCluster[node.cluster].push(node);
      }
    });

    Object.keys(byCluster).forEach(function (cluster) {
      var children = byCluster[cluster];
      var hub = hubAnchor(cluster);
      var n = children.length;
      if (!n) return;

      var radius = Math.min(VIEW_W, VIEW_H) * 0.22;
      var start = cluster === "technical" ? Math.PI * 0.55 : -Math.PI * 0.45;
      var end = cluster === "technical" ? Math.PI * 1.45 : Math.PI * 0.45;

      children.forEach(function (child, i) {
        var t = n === 1 ? 0.5 : i / (n - 1);
        var angle = start + t * (end - start);
        positions[child.id] = {
          id: child.id,
          label: child.label,
          hub: false,
          cluster: child.cluster,
          r: NODE_R,
          x: hub.x + Math.cos(angle) * radius,
          y: hub.y + Math.sin(angle) * radius
        };
      });
    });

    return positions;
  }

  function labelPlace(node, hub) {
    if (node.hub) {
      return { x: node.x, y: node.y + 22, anchor: "middle" };
    }
    var dx = node.x - hub.x;
    var dy = node.y - hub.y;
    var len = Math.hypot(dx, dy) || 1;
    var pad = 14;
    return {
      x: node.x + (dx / len) * pad,
      y: node.y + (dy / len) * pad,
      anchor: dx >= 0 ? "start" : "end"
    };
  }

  function toward(from, to, dist) {
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var len = Math.hypot(dx, dy) || 1;
    return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
  }

  function edgePath(a, b) {
    var start = toward(a, b, a.r);
    var end = toward(b, a, b.r);
    if (a.cluster === b.cluster) {
      return "M " + start.x + " " + start.y + " L " + end.x + " " + end.y;
    }
    var mx = (start.x + end.x) / 2;
    var my = (start.y + end.y) / 2;
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var dist = Math.hypot(dx, dy) || 1;
    var bow = dist * 0.12;
    var cx = mx + (-dy / dist) * bow;
    var cy = my + (dx / dist) * bow;
    return "M " + start.x + " " + start.y + " Q " + cx + " " + cy + " " + end.x + " " + end.y;
  }

  function neighborsOf(id, edges) {
    var linked = {};
    edges.forEach(function (edge) {
      if (edge.from === id) linked[edge.to] = true;
      if (edge.to === id) linked[edge.from] = true;
    });
    return linked;
  }

  function render(svg, data) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    svg.setAttribute("viewBox", "0 0 " + VIEW_W + " " + VIEW_H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Technical and Non-technical");

    var positions = layout(data.nodes);
    var defs = svgEl("defs");
    var marker = svgEl("marker", {
      id: "arrow-causal",
      viewBox: "0 0 10 10",
      refX: "9",
      refY: "5",
      markerWidth: "6",
      markerHeight: "6",
      orient: "auto"
    });
    marker.appendChild(svgEl("path", { d: "M 0 1.2 L 9 5 L 0 8.8", fill: "none", stroke: "#161616", "stroke-width": "1.2" }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    var edgeLayer = svgEl("g", { class: "edges" });
    var nodeLayer = svgEl("g", { class: "nodes" });

    data.edges.forEach(function (edge, i) {
      var a = positions[edge.from];
      var b = positions[edge.to];
      if (!a || !b) return;
      var kind = edge.kind || "bridge";
      var path = svgEl("path", {
        class: "edge kind-" + kind,
        d: edgePath(a, b),
        "data-from": edge.from,
        "data-to": edge.to,
        "data-i": String(i)
      });
      if (kind === "causal") path.setAttribute("marker-end", "url(#arrow-causal)");
      edgeLayer.appendChild(path);
    });

    data.nodes.forEach(function (raw) {
      var node = positions[raw.id];
      if (!node) return;
      var hub = hubAnchor(node.cluster);
      var place = labelPlace(node, hub);
      var g = svgEl("g", {
        class: "node" + (node.hub ? " hub" : ""),
        "data-id": node.id
      });
      g.appendChild(svgEl("circle", {
        class: "hit",
        cx: node.x,
        cy: node.y,
        r: 18
      }));
      g.appendChild(svgEl("circle", {
        class: "dot",
        cx: node.x,
        cy: node.y,
        r: node.r
      }));
      var text = svgEl("text", {
        x: place.x,
        y: place.y,
        "text-anchor": place.anchor
      });
      text.textContent = node.label;
      g.appendChild(text);
      nodeLayer.appendChild(g);
    });

    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);

    var nodeEls = svg.querySelectorAll(".node");
    nodeEls.forEach(function (g) {
      g.addEventListener("mouseenter", function () {
        var id = g.getAttribute("data-id");
        var linked = neighborsOf(id, data.edges);
        svg.classList.add("is-hover");
        g.classList.add("is-on");
        nodeEls.forEach(function (other) {
          var otherId = other.getAttribute("data-id");
          if (linked[otherId]) other.classList.add("is-on");
        });
        svg.querySelectorAll(".edge").forEach(function (edge) {
          if (edge.getAttribute("data-from") === id || edge.getAttribute("data-to") === id) {
            edge.classList.add("is-on");
          }
        });
      });
      g.addEventListener("mouseleave", function () {
        svg.classList.remove("is-hover");
        svg.querySelectorAll(".is-on").forEach(function (el) {
          el.classList.remove("is-on");
        });
      });
    });
  }

  var svg = document.getElementById("web");
  if (!svg) return;

  fetch("creating.json")
    .then(function (res) { return res.json(); })
    .then(function (data) { render(svg, data); });
})();
