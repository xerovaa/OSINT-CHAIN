(function () {

    const canvas = document.getElementById("graphCanvas");
    const svg = document.getElementById("edgesSvg");
    const emptyState = document.getElementById("emptyState");
    const statusBar = document.getElementById("statusBar");
    const rainLayer = document.getElementById("rainLayer");
    const linkModeBtn = document.getElementById("linkModeBtn");
    const saveBtn = document.getElementById("saveBtn");
    const exportBtn = document.getElementById("exportBtn");
    const clearBtn = document.getElementById("clearBtn");
    const deleteNodeBtn = document.getElementById("deleteNodeBtn");
    const applyNodeBtn = document.getElementById("applyNodeBtn");
    const rainToggle = document.getElementById("rainToggle");
    const exportRainToggle = document.getElementById("exportRainToggle");
    const closeEditorBtn = document.getElementById("closeEditorBtn");
    const editorPanel = document.getElementById("editorPanel");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsOverlay = document.getElementById("settingsOverlay");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const nodeTitle = document.getElementById("nodeTitle");
    const nodeValue = document.getElementById("nodeValue");
    const nodeTag = document.getElementById("nodeTag");
    const autoLayoutBtn = document.getElementById("autoLayoutBtn");

    let nodes = [];
    let edges = [];
    let selectedNodeId = null;
    let dragState = null;
    let linkMode = false;
    let pendingLinkId = null;
    let previewMouse = { x: 0, y: 0 };
    let rainEnabled = true;
    let exportRainEnabled = true;
    let suppressClickId = null;
    let currentTheme = "dark";

    // ── Undo stack ─────────────────────────────────────────────────────────────
    const xerovaa_undoStack = [];
    const UNDO_LIMIT = 40;

    function xerovaa_snapshot() {
        const state = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges))
        };
        xerovaa_undoStack.push(state);
        if (xerovaa_undoStack.length > UNDO_LIMIT)
            xerovaa_undoStack.shift();
    }

    function xerovaa_undo() {
        if (xerovaa_undoStack.length === 0) {
            xerovaa_setStatus("Nothing to undo");
            return;
        }
        const prev = xerovaa_undoStack.pop();
        nodes = prev.nodes;
        edges = prev.edges;
        selectedNodeId = null;
        pendingLinkId = null;
        xerovaa_showEditor(null);
        xerovaa_render();
        xerovaa_setStatus("Undone");
    }

    // ── Type meta ──────────────────────────────────────────────────────────────
    const xerovaa_typeMeta = Object.freeze({
        user: { title: "User", value: "Primary profile / identity", icon: "◉" },
        email: { title: "Email", value: "mail@example.com", icon: "✉" },
        social: { title: "Social", value: "@username or profile URL", icon: "◎" },
        phone: { title: "Phone", value: "+1 (...)", icon: "◌" },
        website: { title: "Website", value: "https://example.com", icon: "◇" },
        other: { title: "Other", value: "Linked note / metadata", icon: "○" }
    });

    // ── Label colors ───────────────────────────────────────────────────────────
    const xerovaa_labels = Object.freeze({
        none: { name: "None", color: null },
        red: { name: "Critical", color: "#ef4444" },
        orange: { name: "Important", color: "#f97316" },
        yellow: { name: "Note", color: "#eab308" },
        green: { name: "Safe", color: "#22c55e" },
        blue: { name: "Info", color: "#3b82f6" },
        purple: { name: "Target", color: "#a855f7" }
    });

    // ── Utils ──────────────────────────────────────────────────────────────────
    function xerovaa_uid() {
        return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }

    function xerovaa_stamp() {
        const d = new Date();
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    function xerovaa_esc(v) {
        return String(v)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function xerovaa_setStatus(txt) {
        statusBar.textContent = txt;
    }

    function xerovaa_getNode(id) {
        return nodes.find((n) => n.id === id) || null;
    }

    // ── Theme ──────────────────────────────────────────────────────────────────
    function xerovaa_applyTheme(scheme) {
        currentTheme = scheme;
        document.body.classList.toggle("theme-light", scheme === "light");
        document.querySelectorAll(".scheme-btn").forEach((b) => {
            b.classList.toggle("active", b.dataset.scheme === scheme);
        });
    }
    document.querySelectorAll(".scheme-btn").forEach((btn) => {
        btn.addEventListener("click", () => xerovaa_applyTheme(btn.dataset.scheme));
    });

    // ── Settings ───────────────────────────────────────────────────────────────
    settingsBtn.addEventListener("click", () => settingsOverlay.classList.remove("hidden"));
    closeSettingsBtn.addEventListener("click", () => settingsOverlay.classList.add("hidden"));
    settingsOverlay.addEventListener("click", (e) => {
        if (e.target === settingsOverlay) settingsOverlay.classList.add("hidden");
    });

    // ── Rain ───────────────────────────────────────────────────────────────────
    function xerovaa_buildRain() {
        rainLayer.innerHTML = "";
        for (let i = 0; i < 95; i++) {
            const drop = document.createElement("div");
            drop.className = "rain-drop";
            drop.style.left = `${Math.random() * 100}%`;
            drop.style.height = `${32 + Math.random() * 68}px`;
            drop.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
            drop.style.animationDuration = `${(1.2 + Math.random() * 1.9).toFixed(2)}s`;
            drop.style.opacity = (0.25 + Math.random() * 0.55).toFixed(2);
            rainLayer.appendChild(drop);
        }
    }

    function xerovaa_toggleRain() {
        rainEnabled = !rainEnabled;
        rainLayer.style.display = rainEnabled ? "block" : "none";
        rainToggle.classList.toggle("active", rainEnabled);
        xerovaa_setStatus(rainEnabled ? "Rain enabled" : "Rain disabled");
    }

    function xerovaa_toggleExportRain() {
        exportRainEnabled = !exportRainEnabled;
        exportRainToggle.classList.toggle("active", exportRainEnabled);
        xerovaa_setStatus(exportRainEnabled ? "Export rain on" : "Export rain off");
    }

    rainToggle.addEventListener("click", xerovaa_toggleRain);
    exportRainToggle.addEventListener("click", xerovaa_toggleExportRain);

    // ── Editor ─────────────────────────────────────────────────────────────────
    function xerovaa_clearEditor() {
        nodeTitle.value = "";
        nodeValue.value = "";
        nodeTag.value = "";
        document.querySelectorAll(".label-dot").forEach((d) => d.classList.remove("active"));
    }

    function xerovaa_fillEditor(node) {
        if (!node) { xerovaa_clearEditor(); return; }
        nodeTitle.value = node.title || "";
        nodeValue.value = node.value || "";
        nodeTag.value = node.tag || "";
        document.querySelectorAll(".label-dot").forEach((d) => {
            d.classList.toggle("active", d.dataset.label === (node.label || "none"));
        });
    }

    function xerovaa_showEditor(node) {
        if (!node) {
            editorPanel.classList.add("hidden");
            xerovaa_clearEditor();
            return;
        }
        xerovaa_fillEditor(node);
        editorPanel.classList.remove("hidden");
    }

    function xerovaa_focusEditor() {
        editorPanel.classList.remove("hidden");
        setTimeout(() => nodeTitle.focus(), 40);
    }

    // ── Node CRUD ──────────────────────────────────────────────────────────────
    function xerovaa_createNode(type) {
        xerovaa_snapshot();
        const meta = xerovaa_typeMeta[type] || xerovaa_typeMeta.other;
        const idx = nodes.length;
        const node = {
            id: xerovaa_uid(),
            type,
            label: "none",
            title: meta.title,
            value: meta.value,
            tag: "",
            timestamp: xerovaa_stamp(),
            x: 260 + (idx % 4) * 170,
            y: 200 + (idx % 3) * 120,
            width: 238,
            height: 164,
            icon: meta.icon
        };
        nodes.push(node);
        selectedNodeId = node.id;
        xerovaa_showEditor(node);
        xerovaa_render();
        xerovaa_setStatus(`${meta.title} node created`);
    }

    function xerovaa_selectNode(id) {
        selectedNodeId = id;
        xerovaa_showEditor(xerovaa_getNode(id));
        xerovaa_render();
    }

    function xerovaa_deleteSelected() {
        if (!selectedNodeId) return;
        xerovaa_snapshot();
        nodes = nodes.filter((n) => n.id !== selectedNodeId);
        edges = edges.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId);
        selectedNodeId = null;
        pendingLinkId = null;
        xerovaa_showEditor(null);
        xerovaa_render();
        xerovaa_setStatus("Node deleted");
    }

    function xerovaa_applyEditor() {
        const node = xerovaa_getNode(selectedNodeId);
        if (!node) return;
        xerovaa_snapshot();
        node.title = nodeTitle.value.trim() || xerovaa_typeMeta[node.type].title;
        node.value = nodeValue.value.trim();
        node.tag = nodeTag.value.trim();
        const activeDot = document.querySelector(".label-dot.active");
        node.label = activeDot ? activeDot.dataset.label : "none";
        xerovaa_render();
        xerovaa_setStatus("Node updated");
    }

    // ── Label dots click ───────────────────────────────────────────────────────
    document.querySelectorAll(".label-dot").forEach((dot) => {
        dot.addEventListener("click", () => {
            document.querySelectorAll(".label-dot").forEach((d) => d.classList.remove("active"));
            dot.classList.add("active");
        });
    });

    // ── Auto layout (force-directed) ───────────────────────────────────────────
    function xerovaa_autoLayout() {
        if (nodes.length === 0) return;
        xerovaa_snapshot();

        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        const cX = W / 2;
        const cY = H / 2;

        // Начальное расположение — компактная сетка по центру
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const startX = cX - (cols * 260) / 2;
        const startY = cY - (Math.ceil(nodes.length / cols) * 200) / 2;

        nodes.forEach((node, i) => {
            node.x = startX + (i % cols) * 260;
            node.y = startY + Math.floor(i / cols) * 200;
        });

        const ITERATIONS = 220;
        const REPULSE = 22000;
        const ATTRACT = 0.038;
        const IDEAL_LEN = 300;
        const DAMPING = 0.78;

        // Отступы с учётом размера карточки
        const PAD_X = 16;
        const PAD_Y = 16;
        const MAX_X = (node) => W - node.width - PAD_X;
        const MAX_Y = (node) => H - node.height - PAD_Y;
        const MIN_Y = 110; // ниже brand-pill

        const vel = nodes.map(() => ({ vx: 0, vy: 0 }));

        for (let iter = 0; iter < ITERATIONS; iter++) {
            const force = nodes.map(() => ({ fx: 0, fy: 0 }));

            // Отталкивание между всеми парами
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                    const f = REPULSE / (dist * dist);
                    const nx = (dx / dist) * f;
                    const ny = (dy / dist) * f;
                    force[i].fx += nx;
                    force[i].fy += ny;
                    force[j].fx -= nx;
                    force[j].fy -= ny;
                }
            }

            // Притяжение вдоль рёбер
            for (const edge of edges) {
                const fi = nodes.findIndex((n) => n.id === edge.from);
                const ti = nodes.findIndex((n) => n.id === edge.to);
                if (fi < 0 || ti < 0) continue;
                const dx = nodes[ti].x - nodes[fi].x;
                const dy = nodes[ti].y - nodes[fi].y;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const f = ATTRACT * (dist - IDEAL_LEN);
                const nx = (dx / dist) * f;
                const ny = (dy / dist) * f;
                force[fi].fx += nx;
                force[fi].fy += ny;
                force[ti].fx -= nx;
                force[ti].fy -= ny;
            }

            // Лёгкое притяжение к центру чтобы граф не разлетался
            nodes.forEach((node, i) => {
                force[i].fx += (cX - node.x) * 0.003;
                force[i].fy += (cY - node.y) * 0.003;
            });

            // Применяем силы + клампим в границы канваса
            nodes.forEach((node, i) => {
                vel[i].vx = (vel[i].vx + force[i].fx) * DAMPING;
                vel[i].vy = (vel[i].vy + force[i].fy) * DAMPING;
                node.x += vel[i].vx;
                node.y += vel[i].vy;
                node.x = Math.max(PAD_X, Math.min(node.x, MAX_X(node)));
                node.y = Math.max(MIN_Y, Math.min(node.y, MAX_Y(node)));
            });
        }

        xerovaa_render();
        xerovaa_setStatus("Auto layout applied");
    }

    autoLayoutBtn.addEventListener("click", xerovaa_autoLayout);

    // ── Geometry ───────────────────────────────────────────────────────────────
    function xerovaa_rightAnchor(node) {
        return { x: node.x + node.width, y: node.y + node.height / 2 };
    }
    function xerovaa_leftAnchor(node) {
        return { x: node.x, y: node.y + node.height / 2 };
    }
    function xerovaa_buildCurve(a, b) {
        const dx = Math.max(110, Math.abs(b.x - a.x) * 0.45);
        return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
    }

    // ── Render edges ───────────────────────────────────────────────────────────
    function xerovaa_renderEdges() {
        const paths = [];
        for (const edge of edges) {
            const from = xerovaa_getNode(edge.from);
            const to = xerovaa_getNode(edge.to);
            if (!from || !to) continue;
            paths.push(`<path class="edge-path" d="${xerovaa_buildCurve(xerovaa_rightAnchor(from), xerovaa_leftAnchor(to))}"/>`);
        }
        if (linkMode && pendingLinkId) {
            const from = xerovaa_getNode(pendingLinkId);
            if (from) {
                paths.push(`<path class="edge-path edge-preview" d="${xerovaa_buildCurve(xerovaa_rightAnchor(from), previewMouse)}"/>`);
            }
        }
        svg.innerHTML = paths.join("");
    }

    // ── Render nodes ───────────────────────────────────────────────────────────
    function xerovaa_renderNodes() {
        canvas.innerHTML = nodes.map((node) => {
            const labelKey = node.label || "none";
            const labelMeta = xerovaa_labels[labelKey];
            const labelColor = labelMeta && labelMeta.color ? labelMeta.color : null;

            const labelBadge = labelColor
                ? `<div class="node-label-badge" style="background:${labelColor}22;border-color:${labelColor}55;color:${labelColor}">
             ${xerovaa_esc(labelMeta.name)}
           </div>`
                : "";

            const labelGlow = labelColor
                ? `box-shadow:inset 0 1px 0 rgba(255,255,255,0.03),0 18px 40px rgba(0,0,0,0.24),0 0 0 1px ${labelColor}33;border-color:${labelColor}55;`
                : "";

            return `
        <div class="node ${node.type} ${selectedNodeId === node.id ? "selected" : ""}"
             data-id="${xerovaa_esc(node.id)}"
             style="left:${node.x}px;top:${node.y}px;${labelGlow}">
          ${labelColor ? `<div class="node-label-line" style="background:${labelColor}"></div>` : ""}
          <div class="node-top">
            <div class="node-icon">${xerovaa_esc(node.icon)}</div>
            <div class="node-type">${xerovaa_esc(node.type)}</div>
          </div>
          <div class="node-line"></div>
          <div class="node-title">${xerovaa_esc(node.title)}</div>
          <div class="node-value">${xerovaa_esc(node.value)}</div>
          ${node.tag ? `<div class="node-tag">${xerovaa_esc(node.tag)}</div>` : ""}
          ${labelBadge}
          <div class="node-time">${xerovaa_esc(node.timestamp)}</div>
        </div>
      `;
        }).join("");
    }

    // ── Link mode ──────────────────────────────────────────────────────────────
    function xerovaa_tryConnect(id) {
        if (!linkMode) return false;
        if (!pendingLinkId) {
            pendingLinkId = id;
            xerovaa_setStatus("First node selected — click second node.");
            xerovaa_renderEdges();
            return true;
        }
        if (pendingLinkId === id) {
            pendingLinkId = null;
            xerovaa_setStatus("Connection cancelled");
            xerovaa_renderEdges();
            return true;
        }
        const already = edges.some(
            (e) => (e.from === pendingLinkId && e.to === id) || (e.from === id && e.to === pendingLinkId)
        );
        if (!already) {
            xerovaa_snapshot();
            edges.push({ id: xerovaa_uid(), from: pendingLinkId, to: id });
            xerovaa_setStatus("Nodes connected");
        } else {
            xerovaa_setStatus("Already connected");
        }
        pendingLinkId = null;
        xerovaa_render();
        return true;
    }

    // ── Bind node events ───────────────────────────────────────────────────────
    let lastClickTime = 0;
    let lastClickId = null;

    function xerovaa_bindNodeEvents() {
        canvas.querySelectorAll(".node").forEach((el) => {
            const id = el.dataset.id;
            if (!id) return;

            el.addEventListener("mousedown", (e) => {
                if (e.button !== 0) return;
                const node = xerovaa_getNode(id);
                if (!node) return;
                dragState = {
                    id,
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    offsetX: e.clientX - node.x,
                    offsetY: e.clientY - node.y,
                    moved: false
                };
            });

            el.addEventListener("click", () => {
                if (suppressClickId === id) { suppressClickId = null; return; }

                const now = Date.now();
                if (lastClickId === id && now - lastClickTime < 380) {
                    // Double click — open editor and focus title
                    xerovaa_selectNode(id);
                    xerovaa_focusEditor();
                    lastClickId = null;
                    lastClickTime = 0;
                    return;
                }
                lastClickId = id;
                lastClickTime = now;

                xerovaa_selectNode(id);
                xerovaa_tryConnect(id);
            });
        });
    }

    // ── Full render ────────────────────────────────────────────────────────────
    function xerovaa_render() {
        emptyState.style.display = nodes.length ? "none" : "block";
        xerovaa_renderNodes();
        xerovaa_renderEdges();
        xerovaa_bindNodeEvents();
        linkModeBtn.classList.toggle("active", linkMode);
        canvas.classList.toggle("connecting", linkMode);
    }

    // ── Project data ───────────────────────────────────────────────────────────
    function xerovaa_getProjectData() {
        return { version: 6, exportedAt: new Date().toISOString(), nodes, edges };
    }

    // ── Export HTML ────────────────────────────────────────────────────────────
    function xerovaa_buildExportHtml() {
        const project = xerovaa_getProjectData();

        const typeStyles = {
            user: { color: "#ffffff", glow: "rgba(255,255,255,0.15)", dim: "rgba(255,255,255,0.06)" },
            email: { color: "#e2e8f0", glow: "rgba(226,232,240,0.15)", dim: "rgba(226,232,240,0.06)" },
            social: { color: "#cbd5e1", glow: "rgba(203,213,225,0.15)", dim: "rgba(203,213,225,0.06)" },
            phone: { color: "#94a3b8", glow: "rgba(148,163,184,0.15)", dim: "rgba(148,163,184,0.06)" },
            website: { color: "#f1f5f9", glow: "rgba(241,245,249,0.15)", dim: "rgba(241,245,249,0.06)" },
            other: { color: "#64748b", glow: "rgba(100,116,139,0.15)", dim: "rgba(100,116,139,0.06)" }
        };

        const cardW = 240;
        const cardH = 190;
        const cols = Math.max(1, Math.ceil(Math.sqrt(project.nodes.length)));

        const positioned = project.nodes.map((node, i) => ({
            ...node,
            px: node.x ?? (80 + (i % cols) * (cardW + 120)),
            py: node.y ?? (80 + Math.floor(i / cols) * (cardH + 100))
        }));

        const totalW = Math.max(...positioned.map((n) => n.px + cardW + 80), 960);
        const totalH = Math.max(...positioned.map((n) => n.py + cardH + 80), 640);

        const svgEdges = project.edges.map((edge) => {
            const from = positioned.find((n) => n.id === edge.from);
            const to = positioned.find((n) => n.id === edge.to);
            if (!from || !to) return "";
            const ax = from.px + cardW, ay = from.py + cardH / 2;
            const bx = to.px, by = to.py + cardH / 2;
            const dx = Math.max(80, Math.abs(bx - ax) * 0.45);
            return `
        <path class="edge-shadow" d="M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}"/>
        <path class="edge"        d="M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}"/>
      `;
        }).join("");

        const rainHtml = exportRainEnabled
            ? `<div class="rain">${Array.from({ length: 90 }, () => {
                const left = (Math.random() * 100).toFixed(1);
                const delay = (Math.random() * 5).toFixed(2);
                const duration = (1.4 + Math.random() * 2.2).toFixed(2);
                const height = Math.round(30 + Math.random() * 80);
                const opacity = (0.12 + Math.random() * 0.42).toFixed(2);
                return `<div class="drop" style="left:${left}%;height:${height}px;animation-delay:${delay}s;animation-duration:${duration}s;opacity:${opacity}"></div>`;
            }).join("")}</div>`
            : "";

        const cards = positioned.map((node) => {
            const c = typeStyles[node.type] || typeStyles.other;
            const labelKey = node.label || "none";
            const labelMeta = xerovaa_labels[labelKey];
            const labelColor = labelMeta && labelMeta.color ? labelMeta.color : null;

            const labelBadgeHtml = labelColor
                ? `<div class="card-label" style="background:${labelColor}22;border:1px solid ${labelColor}55;color:${labelColor}">${xerovaa_esc(labelMeta.name)}</div>`
                : "";

            const labelLineHtml = labelColor
                ? `<div class="card-label-line" style="background:${labelColor}"></div>`
                : "";

            const extraGlow = labelColor
                ? `0 0 30px ${labelColor}22,`
                : "";

            return `
        <div class="card" style="left:${node.px}px;top:${node.py}px;--glow:${c.glow};--accent:${c.color};--dim:${c.dim};--extra-glow:${extraGlow}">
          ${labelLineHtml}
          <div class="card-glow"></div>
          <div class="card-border-top"></div>
          <div class="card-inner">
            <div class="card-top">
              <div class="card-icon">${xerovaa_esc(node.icon || "○")}</div>
              <div class="card-type">${xerovaa_esc(node.type).toUpperCase()}</div>
            </div>
            <div class="card-divider"></div>
            <div class="card-title">${xerovaa_esc(node.title)}</div>
            <div class="card-value">${xerovaa_esc(node.value).replaceAll("\n", "<br>")}</div>
            ${node.tag ? `<div class="card-tag"># ${xerovaa_esc(node.tag)}</div>` : ""}
            ${labelBadgeHtml}
            <div class="card-time">${xerovaa_esc(node.timestamp || "")}</div>
          </div>
          <div class="card-shine"></div>
        </div>
      `;
        }).join("");

        const connRows = project.edges.map((edge) => {
            const from = positioned.find((n) => n.id === edge.from);
            const to = positioned.find((n) => n.id === edge.to);
            if (!from || !to) return "";
            return `
        <div class="conn-row">
          <span class="conn-node">${xerovaa_esc(from.title)}</span>
          <span class="conn-arrow">⟶</span>
          <span class="conn-node">${xerovaa_esc(to.title)}</span>
        </div>
      `;
        }).join("");

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>XEROVAA — Report</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#060709;font-family:'Inter',sans-serif;color:#f1f3f9;min-height:100vh;overflow-x:hidden}
.bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.026) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.026) 1px,transparent 1px);background-size:54px 54px}
.bg-vignette{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse 120% 80% at 50% 50%,transparent 20%,rgba(0,0,0,0.82) 100%)}
.rain{position:fixed;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.drop{position:absolute;top:-140px;width:1.5px;border-radius:999px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,0.75),transparent);filter:blur(0.4px);animation:fall linear infinite}
@keyframes fall{from{transform:translateY(-140px)}to{transform:translateY(115vh)}}
.header{position:relative;z-index:10;padding:34px 0 24px;display:flex;align-items:center;justify-content:center}
.brand-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:default}
.brand-wrap::before{content:'';position:absolute;inset:-16px;border-radius:999px;border:1px solid rgba(255,255,255,0.06);animation:pulse-ring 6s linear infinite}
@keyframes pulse-ring{0%,100%{transform:scale(1);border-color:rgba(255,255,255,0.06)}50%{transform:scale(1.04);border-color:rgba(255,255,255,0.14)}}
.brand{position:relative;padding:16px 48px;border-radius:999px;border:1px solid rgba(255,255,255,0.1);background:linear-gradient(160deg,rgba(18,20,28,0.9),rgba(8,10,16,0.95));backdrop-filter:blur(20px);font-size:20px;font-weight:900;letter-spacing:.3em;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06),0 20px 40px rgba(0,0,0,0.5);transition:letter-spacing .5s cubic-bezier(.22,1,.36,1),border-color .4s ease,box-shadow .4s ease;overflow:hidden}
.brand::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.07) 50%,transparent 70%);background-size:250% 100%;background-position:250% 0;transition:background-position .7s ease;border-radius:inherit}
.brand-wrap:hover .brand::after{background-position:-100% 0}
.brand-wrap:hover .brand{letter-spacing:.44em;border-color:rgba(255,255,255,0.22);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1),0 0 60px rgba(255,255,255,0.06),0 30px 60px rgba(0,0,0,0.6)}
.brand-dot{position:absolute;width:4px;height:4px;border-radius:50%;background:#fff;top:50%;left:50%;opacity:0;transition:opacity .3s ease;pointer-events:none}
.brand-dot:nth-child(1){animation:orb1 3s linear infinite}
.brand-dot:nth-child(2){animation:orb2 3s linear infinite}
.brand-dot:nth-child(3){animation:orb3 3s linear infinite}
@keyframes orb1{from{transform:translate(-50%,-50%) rotate(0deg) translateX(110px)}to{transform:translate(-50%,-50%) rotate(360deg) translateX(110px)}}
@keyframes orb2{from{transform:translate(-50%,-50%) rotate(120deg) translateX(110px)}to{transform:translate(-50%,-50%) rotate(480deg) translateX(110px)}}
@keyframes orb3{from{transform:translate(-50%,-50%) rotate(240deg) translateX(110px)}to{transform:translate(-50%,-50%) rotate(600deg) translateX(110px)}}
.brand-wrap:hover .brand-dot{opacity:.55}
.meta-row{position:relative;z-index:10;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:32px}
.meta-pill{padding:5px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:.1em}
.meta-pill strong{color:rgba(255,255,255,0.65);font-weight:600}
.canvas-wrap{position:relative;z-index:5;margin:0 auto;width:${totalW}px;height:${totalH}px}
.edges-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible}
.edge-shadow{fill:none;stroke:rgba(0,0,0,0.55);stroke-width:4;stroke-linecap:round;filter:blur(3px)}
.edge{fill:none;stroke:rgba(255,255,255,0.12);stroke-width:1.6;stroke-linecap:round;stroke-dasharray:6 9;animation:dash 22s linear infinite}
@keyframes dash{to{stroke-dashoffset:-300}}
.card{position:absolute;width:240px;border-radius:18px;border:1px solid rgba(255,255,255,0.07);background:linear-gradient(160deg,rgba(14,16,24,0.94),rgba(8,10,16,0.98));backdrop-filter:blur(18px);box-shadow:var(--extra-glow) inset 0 1px 0 rgba(255,255,255,0.04),0 16px 40px rgba(0,0,0,0.44);cursor:default;z-index:2;overflow:hidden;transition:transform .38s cubic-bezier(.22,1,.36,1),border-color .32s ease,box-shadow .38s ease}
.card:hover{transform:translateY(-8px) scale(1.028);border-color:rgba(255,255,255,0.18);box-shadow:var(--extra-glow) inset 0 1px 0 rgba(255,255,255,0.07),0 0 0 1px rgba(255,255,255,0.06),0 0 50px var(--glow),0 36px 70px rgba(0,0,0,0.6)}
.card-label-line{position:absolute;top:0;left:0;right:0;height:2px;z-index:5}
.card-border-top{position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:0;transition:opacity .35s ease}
.card:hover .card-border-top{opacity:.5}
.card-glow{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse 80% 50% at 50% -5%,var(--glow),transparent 70%);opacity:0;transition:opacity .38s ease}
.card:hover .card-glow{opacity:1}
.card-shine{position:absolute;inset:0;z-index:10;pointer-events:none;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.044) 50%,transparent 70%);background-size:250% 100%;background-position:250% 0;transition:background-position .65s ease}
.card:hover .card-shine{background-position:-100% 0}
.card-inner{position:relative;z-index:2;padding:18px}
.card-top{display:flex;align-items:center;gap:10px}
.card-icon{width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--accent);flex-shrink:0;transition:transform .32s ease,box-shadow .32s ease,background .32s ease}
.card:hover .card-icon{transform:scale(1.14) rotate(-6deg);background:var(--dim);box-shadow:0 0 16px var(--glow)}
.card-type{font-size:9px;font-weight:800;letter-spacing:.22em;color:var(--accent);opacity:.7;transition:opacity .28s ease}
.card:hover .card-type{opacity:1}
.card-divider{height:1px;margin:13px 0 11px;background:linear-gradient(90deg,var(--accent),transparent);opacity:.12;border-radius:999px;transition:opacity .32s ease}
.card:hover .card-divider{opacity:.3}
.card-title{font-size:16px;font-weight:700;line-height:1.2;margin-bottom:10px;letter-spacing:-.01em;transition:color .28s ease}
.card:hover .card-title{color:#fff}
.card-value{background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:10px 12px;font-size:12px;color:#6b7280;line-height:1.55;min-height:50px;word-break:break-all;transition:color .32s ease,border-color .32s ease}
.card:hover .card-value{color:#9ca3af;border-color:rgba(255,255,255,0.1)}
.card-tag{margin-top:11px;font-size:10px;font-weight:700;letter-spacing:.14em;color:var(--accent);opacity:.5;transition:opacity .28s ease}
.card:hover .card-tag{opacity:.9}
.card-label{display:inline-block;margin-top:10px;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.1em}
.card-time{margin-top:10px;text-align:right;font-size:10px;color:#2d3340;transition:color .28s ease}
.card:hover .card-time{color:#4b5563}
.connections{position:relative;z-index:10;max-width:660px;margin:40px auto 0;padding:0 24px 60px}
.conn-title{font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,0.18);margin-bottom:14px;text-align:center}
.conn-box{border-radius:16px;border:1px solid rgba(255,255,255,0.06);background:rgba(10,12,18,0.7);backdrop-filter:blur(12px);overflow:hidden}
.conn-row{display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid rgba(255,255,255,0.04);transition:background .22s ease}
.conn-row:last-child{border-bottom:none}
.conn-row:hover{background:rgba(255,255,255,0.025)}
.conn-node{font-size:13px;font-weight:600;color:rgba(255,255,255,0.7)}
.conn-arrow{color:rgba(255,255,255,0.2);font-size:14px;flex-shrink:0}
.footer{position:relative;z-index:10;text-align:center;padding:0 0 40px;font-size:10px;letter-spacing:.18em;color:rgba(255,255,255,0.06)}
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="bg-vignette"></div>
${rainHtml}
<div class="header">
  <div class="brand-wrap">
    <div class="brand-dot"></div>
    <div class="brand-dot"></div>
    <div class="brand-dot"></div>
    <div class="brand"># XEROVAA</div>
  </div>
</div>
<div class="meta-row">
  <div class="meta-pill"><strong>${project.nodes.length}</strong> nodes</div>
  <div class="meta-pill"><strong>${project.edges.length}</strong> connections</div>
  <div class="meta-pill">${new Date(project.exportedAt).toLocaleString()}</div>
</div>
<div class="canvas-wrap">
  <svg class="edges-svg">${svgEdges}</svg>
  ${cards}
</div>
${project.edges.length ? `
<div class="connections">
  <div class="conn-title">Connections</div>
  <div class="conn-box">${connRows}</div>
</div>` : ""}
<div class="footer">XEROVAA · ${new Date(project.exportedAt).toLocaleString()}</div>
</body>
</html>`;
    }

    // ── Native bridge ──────────────────────────────────────────────────────────
    function xerovaa_postNative(msg) {
        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage(msg);
        } else {
            console.warn("[XEROVAA] WebView2 bridge not found");
            xerovaa_setStatus("Bridge unavailable");
        }
    }

    function xerovaa_saveJson() {
        xerovaa_postNative(`SAVE_PROJECT:${JSON.stringify(xerovaa_getProjectData(), null, 2)}`);
    }

    function xerovaa_exportHtml() {
        xerovaa_postNative(`EXPORT_REPORT:${xerovaa_buildExportHtml()}`);
    }

    window.nativeReceive = function (data) {
        try {
            const payload = typeof data === "string" ? JSON.parse(data) : data;
            if (payload.type === "save-project-result")
                xerovaa_setStatus(payload.ok ? "Project JSON saved" : "Failed to save JSON");
            if (payload.type === "export-report-result")
                xerovaa_setStatus(payload.ok ? "HTML exported" : "Failed to export HTML");
        } catch (err) {
            console.error("[XEROVAA] nativeReceive:", err);
        }
    };

    // ── Toolbar ────────────────────────────────────────────────────────────────
    document.querySelectorAll(".toolbar-btn[data-type]").forEach((btn) => {
        btn.addEventListener("click", () => xerovaa_createNode(btn.dataset.type));
    });

    linkModeBtn.addEventListener("click", () => {
        linkMode = !linkMode;
        pendingLinkId = null;
        xerovaa_setStatus(linkMode ? "Connect mode on" : "Connect mode off");
        xerovaa_render();
    });

    deleteNodeBtn.addEventListener("click", xerovaa_deleteSelected);
    applyNodeBtn.addEventListener("click", xerovaa_applyEditor);
    saveBtn.addEventListener("click", xerovaa_saveJson);
    exportBtn.addEventListener("click", xerovaa_exportHtml);

    clearBtn.addEventListener("click", () => {
        xerovaa_snapshot();
        nodes = []; edges = [];
        selectedNodeId = null; pendingLinkId = null; suppressClickId = null;
        xerovaa_showEditor(null);
        xerovaa_render();
        xerovaa_setStatus("Graph cleared");
    });

    closeEditorBtn.addEventListener("click", () => {
        selectedNodeId = null;
        xerovaa_showEditor(null);
        xerovaa_render();
    });

    canvas.addEventListener("click", (e) => {
        if (e.target !== canvas) return;
        selectedNodeId = null;
        xerovaa_showEditor(null);
        if (linkMode) {
            pendingLinkId = null;
            xerovaa_setStatus("Connection cancelled");
        }
        xerovaa_render();
    });

    window.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        previewMouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (!dragState) {
            if (linkMode && pendingLinkId) xerovaa_renderEdges();
            return;
        }

        const node = xerovaa_getNode(dragState.id);
        if (!node) return;

        const dx = Math.abs(e.clientX - dragState.startMouseX);
        const dy = Math.abs(e.clientY - dragState.startMouseY);
        if (dx > 4 || dy > 4) dragState.moved = true;

        node.x = e.clientX - dragState.offsetX;
        node.y = e.clientY - dragState.offsetY - rect.top;

        const maxX = canvas.clientWidth - node.width - 12;
        const maxY = canvas.clientHeight - node.height - 12;
        node.x = Math.max(12, Math.min(node.x, maxX));
        node.y = Math.max(96, Math.min(node.y, maxY));

        const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
        if (el) { el.style.left = `${node.x}px`; el.style.top = `${node.y}px`; }

        xerovaa_renderEdges();
    });

    window.addEventListener("mouseup", () => {
        if (dragState && dragState.moved) suppressClickId = dragState.id;
        dragState = null;
    });

    window.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            xerovaa_undo();
            return;
        }
        if (e.key === "Escape") {
            if (linkMode) {
                linkMode = false;
                pendingLinkId = null;
                xerovaa_setStatus("Connect mode off");
                xerovaa_render();
                return;
            }
            if (selectedNodeId) {
                selectedNodeId = null;
                xerovaa_showEditor(null);
                xerovaa_render();
            }
            if (!settingsOverlay.classList.contains("hidden")) {
                settingsOverlay.classList.add("hidden");
            }
        }
    });

    // ── Boot ───────────────────────────────────────────────────────────────────
    xerovaa_buildRain();
    xerovaa_render();
    xerovaa_setStatus("Ready");

})();