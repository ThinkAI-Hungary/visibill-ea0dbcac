"""
Interactive Tkinter Graph Canvas for Graphify Dashboard.
Visualizes ego-networks with zoom, pan, drag-and-drop, and click-to-traverse.
"""

import math
import tkinter as tk
from typing import Dict, List, Any, Optional, Callable, Tuple

class GraphCanvas(tk.Canvas):
    def __init__(self, master, on_node_select: Optional[Callable[[str], None]] = None,
                 on_node_double_click: Optional[Callable[[str], None]] = None, **kwargs):
        # Default dark canvas background
        kwargs.setdefault("bg", "#0e1017")
        kwargs.setdefault("highlightthickness", 0)
        super().__init__(master, **kwargs)

        self.on_node_select = on_node_select
        self.on_node_double_click = on_node_double_click

        # Graph data
        self.center_id: Optional[str] = None
        self.nodes_data: List[Dict[str, Any]] = []
        self.links_data: List[Dict[str, Any]] = []

        # Layout state: node_id -> {x, y, radius, color, label, node}
        self.node_positions: Dict[str, Dict[str, Any]] = {}

        # Interaction state
        self.zoom_scale = 1.0
        self.pan_offset_x = 0.0
        self.pan_offset_y = 0.0
        self.dragged_node_id: Optional[str] = None
        self.selected_node_id: Optional[str] = None
        self.hovered_node_id: Optional[str] = None

        # Pan drag state
        self.last_mouse_x = 0
        self.last_mouse_y = 0
        self.is_panning = False

        # Bind events
        self.bind("<ButtonPress-1>", self._on_button_press)
        self.bind("<B1-Motion>", self._on_b1_motion)
        self.bind("<ButtonRelease-1>", self._on_button_release)
        self.bind("<Double-Button-1>", self._on_double_click)

        self.bind("<ButtonPress-3>", self._on_pan_start)
        self.bind("<B3-Motion>", self._on_pan_motion)
        self.bind("<ButtonRelease-3>", self._on_pan_end)

        self.bind("<MouseWheel>", self._on_mouse_wheel)
        self.bind("<Motion>", self._on_hover)

        self.bind("<Configure>", lambda e: self.redraw())

    def set_data(self, ego_data: Dict[str, Any]):
        self.center_id = ego_data.get("center_id")
        self.nodes_data = ego_data.get("nodes", [])
        self.links_data = ego_data.get("links", [])
        self.selected_node_id = self.center_id

        self._compute_layout()
        self.fit_view()

    def _compute_layout(self):
        self.node_positions.clear()
        if not self.nodes_data:
            return

        w = self.winfo_width() or 800
        h = self.winfo_height() or 600
        cx = w / 2
        cy = h / 2

        # Color schemes based on category / relation
        color_center = "#38bdf8"       # Bright cyan
        color_incoming = "#34d399"     # Emerald green (callers/importers)
        color_outgoing = "#fb923c"     # Amber / orange (dependencies)
        color_other = "#a78bfa"        # Purple

        # Identify incoming vs outgoing sets relative to center
        incoming_ids = set()
        outgoing_ids = set()
        if self.center_id:
            for l in self.links_data:
                if l.get("target") == self.center_id:
                    incoming_ids.add(l.get("source"))
                if l.get("source") == self.center_id:
                    outgoing_ids.add(l.get("target"))

        # Place center node
        if self.center_id:
            for n in self.nodes_data:
                if n["id"] == self.center_id:
                    self.node_positions[self.center_id] = {
                        "x": cx,
                        "y": cy,
                        "radius": 24,
                        "color": color_center,
                        "label": n.get("label", "Center"),
                        "node": n
                    }
                    break

        # Place surrounding nodes
        other_nodes = [n for n in self.nodes_data if n["id"] != self.center_id]
        n_count = len(other_nodes)
        if n_count == 0:
            return

        # Separate left (incoming), right (outgoing), and ambient
        left_nodes = [n for n in other_nodes if n["id"] in incoming_ids and n["id"] not in outgoing_ids]
        right_nodes = [n for n in other_nodes if n["id"] in outgoing_ids and n["id"] not in incoming_ids]
        both_or_other = [n for n in other_nodes if n not in left_nodes and n not in right_nodes]

        radius_x = min(w * 0.38, 300)
        radius_y = min(h * 0.38, 220)

        # Distribute left nodes in an arc on the left (120 to 240 deg)
        if left_nodes:
            angle_step = math.pi / max(len(left_nodes), 1)
            start_angle = math.pi / 2 + angle_step / 2
            for i, n in enumerate(left_nodes):
                ang = start_angle + i * angle_step
                self.node_positions[n["id"]] = {
                    "x": cx + radius_x * math.cos(ang),
                    "y": cy + radius_y * math.sin(ang),
                    "radius": 15,
                    "color": color_incoming,
                    "label": n.get("label", ""),
                    "node": n
                }

        # Distribute right nodes in an arc on the right (-60 to +60 deg)
        if right_nodes:
            angle_step = math.pi / max(len(right_nodes), 1)
            start_angle = -math.pi / 2 + angle_step / 2
            for i, n in enumerate(right_nodes):
                ang = start_angle + i * angle_step
                self.node_positions[n["id"]] = {
                    "x": cx + radius_x * math.cos(ang),
                    "y": cy + radius_y * math.sin(ang),
                    "radius": 15,
                    "color": color_outgoing,
                    "label": n.get("label", ""),
                    "node": n
                }

        # Distribute remaining nodes on top and bottom arcs
        if both_or_other:
            for i, n in enumerate(both_or_other):
                frac = i / max(len(both_or_other), 1)
                ang = frac * 2 * math.pi
                r = radius_x * 0.75
                self.node_positions[n["id"]] = {
                    "x": cx + r * math.cos(ang),
                    "y": cy + r * math.sin(ang),
                    "radius": 14,
                    "color": color_other,
                    "label": n.get("label", ""),
                    "node": n
                }

        # Run 15 relaxation steps to prevent overlapping
        self._relax_simulation(iterations=15)

    def _relax_simulation(self, iterations: int = 15):
        nodes = list(self.node_positions.values())
        for _ in range(iterations):
            for i in range(len(nodes)):
                n1 = nodes[i]
                if n1["node"]["id"] == self.center_id:
                    continue  # Keep center fixed
                for j in range(i + 1, len(nodes)):
                    n2 = nodes[j]
                    dx = n1["x"] - n2["x"]
                    dy = n1["y"] - n2["y"]
                    dist = math.hypot(dx, dy)
                    min_dist = n1["radius"] + n2["radius"] + 25
                    if 0 < dist < min_dist:
                        overlap = (min_dist - dist) / dist * 0.5
                        move_x = dx * overlap
                        move_y = dy * overlap
                        if n1["node"]["id"] != self.center_id:
                            n1["x"] += move_x
                            n1["y"] += move_y
                        if n2["node"]["id"] != self.center_id:
                            n2["x"] -= move_x
                            n2["y"] -= move_y

    def fit_view(self):
        self.zoom_scale = 1.0
        self.pan_offset_x = 0.0
        self.pan_offset_y = 0.0
        self.redraw()

    def redraw(self):
        self.delete("all")
        if not self.node_positions:
            w = self.winfo_width() or 400
            h = self.winfo_height() or 300
            self.create_text(w/2, h/2, text="Válassz ki egy elemet a kapcsolatok megjelenítéséhez",
                             fill="#71717a", font=("Segoe UI", 12))
            return

        cx = (self.winfo_width() or 800) / 2
        cy = (self.winfo_height() or 600) / 2

        def transform(x, y):
            tx = (x - cx) * self.zoom_scale + cx + self.pan_offset_x
            ty = (y - cy) * self.zoom_scale + cy + self.pan_offset_y
            return tx, ty

        # 1. Draw Links
        for link in self.links_data:
            src_id = link.get("source")
            tgt_id = link.get("target")
            if src_id in self.node_positions and tgt_id in self.node_positions:
                p1 = self.node_positions[src_id]
                p2 = self.node_positions[tgt_id]
                x1, y1 = transform(p1["x"], p1["y"])
                x2, y2 = transform(p2["x"], p2["y"])

                # Highlight if connected to selected/hovered node
                is_active = (src_id in (self.selected_node_id, self.hovered_node_id) or
                             tgt_id in (self.selected_node_id, self.hovered_node_id))
                line_color = "#38bdf8" if is_active else "#3f3f46"
                line_width = 2.5 if is_active else 1.2

                # Draw directional line with arrow
                self.create_line(x1, y1, x2, y2, fill=line_color, width=line_width,
                                 arrow=tk.LAST, arrowshape=(10, 12, 4))

                # If active, display relation label in midpoint
                if is_active and link.get("relation"):
                    mx = (x1 + x2) / 2
                    my = (y1 + y2) / 2
                    self.create_text(mx, my, text=link.get("relation"),
                                     fill="#94a3b8", font=("Segoe UI", 8, "italic"))

        # 2. Draw Nodes
        for nid, data in self.node_positions.items():
            tx, ty = transform(data["x"], data["y"])
            r = data["radius"] * self.zoom_scale

            is_center = (nid == self.center_id)
            is_selected = (nid == self.selected_node_id)
            is_hovered = (nid == self.hovered_node_id)

            # Node circle outline
            outline_color = "#ffffff" if (is_selected or is_hovered) else "#27272a"
            outline_width = 3 if is_selected else (2 if is_center else 1)

            # Outer glow for center
            if is_center:
                self.create_oval(tx - r - 4, ty - r - 4, tx + r + 4, ty + r + 4,
                                 outline="#38bdf8", width=1)

            # Main circle
            self.create_oval(tx - r, ty - r, tx + r, ty + r,
                             fill=data["color"], outline=outline_color, width=outline_width,
                             tags=("node", nid))

            # Node Label
            lbl = data["label"]
            if len(lbl) > 22:
                lbl = lbl[:20] + "..."
            font_size = max(8, int(10 * self.zoom_scale))
            font_weight = "bold" if is_center or is_selected else "normal"

            # Label text below node
            self.create_text(tx, ty + r + 12, text=lbl,
                             fill="#f4f4f5" if is_selected else "#d4d4d8",
                             font=("Segoe UI", font_size, font_weight),
                             tags=("label", nid))

        # Legend at bottom right
        self._draw_legend()

    def _draw_legend(self):
        w = self.winfo_width() or 800
        h = self.winfo_height() or 600
        legend_items = [
            ("Központi Elem", "#0284c7"),
            ("Bejövő (Hívók / Importálók)", "#10b981"),
            ("Kimenő (Függőségek)", "#f97316"),
            ("Egyéb Kapcsolat", "#8b5cf6"),
        ]
        start_y = h - 25 - (len(legend_items) * 20)
        self.create_rectangle(w - 240, start_y - 12, w - 12, h - 12,
                              fill="#13141d", outline="#252737", width=1)

        for i, (txt, col) in enumerate(legend_items):
            iy = start_y + (i * 20)
            self.create_oval(w - 226, iy, w - 216, iy + 10, fill=col, outline="")
            self.create_text(w - 206, iy + 5, text=txt, anchor="w",
                             fill="#94a3b8", font=("Segoe UI", 9))

    def _find_node_at(self, x: float, y: float) -> Optional[str]:
        cx = (self.winfo_width() or 800) / 2
        cy = (self.winfo_height() or 600) / 2

        for nid, data in self.node_positions.items():
            tx = (data["x"] - cx) * self.zoom_scale + cx + self.pan_offset_x
            ty = (data["y"] - cy) * self.zoom_scale + cy + self.pan_offset_y
            r = data["radius"] * self.zoom_scale + 5
            if math.hypot(x - tx, y - ty) <= r:
                return nid
        return None

    def _on_button_press(self, event):
        nid = self._find_node_at(event.x, event.y)
        if nid:
            self.dragged_node_id = nid
            self.selected_node_id = nid
            self.redraw()
            if self.on_node_select:
                self.on_node_select(nid)
        else:
            self._on_pan_start(event)

    def _on_b1_motion(self, event):
        if self.dragged_node_id:
            cx = (self.winfo_width() or 800) / 2
            cy = (self.winfo_height() or 600) / 2
            # Reverse transform to unscaled coordinates
            orig_x = (event.x - cx - self.pan_offset_x) / self.zoom_scale + cx
            orig_y = (event.y - cy - self.pan_offset_y) / self.zoom_scale + cy
            self.node_positions[self.dragged_node_id]["x"] = orig_x
            self.node_positions[self.dragged_node_id]["y"] = orig_y
            self.redraw()
        elif self.is_panning:
            self._on_pan_motion(event)

    def _on_button_release(self, event):
        self.dragged_node_id = None
        self._on_pan_end(event)

    def _on_double_click(self, event):
        nid = self._find_node_at(event.x, event.y)
        if nid and self.on_node_double_click:
            self.on_node_double_click(nid)

    def _on_pan_start(self, event):
        self.is_panning = True
        self.last_mouse_x = event.x
        self.last_mouse_y = event.y

    def _on_pan_motion(self, event):
        if self.is_panning:
            dx = event.x - self.last_mouse_x
            dy = event.y - self.last_mouse_y
            self.pan_offset_x += dx
            self.pan_offset_y += dy
            self.last_mouse_x = event.x
            self.last_mouse_y = event.y
            self.redraw()

    def _on_pan_end(self, event):
        self.is_panning = False

    def _on_mouse_wheel(self, event):
        factor = 1.15 if event.delta > 0 else 0.85
        new_scale = self.zoom_scale * factor
        if 0.25 <= new_scale <= 4.0:
            self.zoom_scale = new_scale
            self.redraw()

    def _on_hover(self, event):
        nid = self._find_node_at(event.x, event.y)
        if nid != self.hovered_node_id:
            self.hovered_node_id = nid
            self.config(cursor="hand2" if nid else "arrow")
            self.redraw()
