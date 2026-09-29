"""
Visibill & Eaisybill Architecture Dashboard
Live Graphify Knowledge Graph Desktop App with Modern Dark UI
"""

import os
import sys
import re
import time
import queue
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox
import customtkinter as ctk

# Ensure local imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from graph_engine import GraphEngine
from graph_canvas import GraphCanvas

# Global Theme Settings
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# Design Palette Tokens
C_BG_APP = "#0c0d12"
C_BG_HEADER = "#13141c"
C_BG_CARD = "#171822"
C_BORDER = "#252736"
C_BORDER_LIGHT = "#323547"
C_PRIMARY = "#0284c7"
C_PRIMARY_HOVER = "#0369a1"
C_CYAN = "#38bdf8"
C_EMERALD = "#10b981"
C_AMBER = "#f59e0b"
C_ROSE = "#f43f5e"
C_PURPLE = "#818cf8"
C_TEXT_MAIN = "#f8fafc"
C_TEXT_MUTED = "#94a3b8"
C_TEXT_DIM = "#64748b"


class DashboardApp(ctk.CTk):
    def __init__(self, root_dir: str = "."):
        super().__init__()

        self.root_dir = os.path.abspath(root_dir)
        self.engine = GraphEngine(self.root_dir)
        self.event_queue = queue.Queue()

        # Window configuration
        self.title("Visibill & Eaisybill Architecture Dashboard | Graphify Live")
        self.geometry("1360x860")
        self.minsize(1080, 700)
        self.configure(fg_color=C_BG_APP)

        # State
        self.is_updating = False
        self.selected_node_id: str = ""
        self.watcher_running = True
        self.active_category = "all"
        self.incoming_map = {}
        self.outgoing_map = {}

        # Set custom app icon if exists
        icon_path = os.path.join(self.root_dir, "public", "favicon.ico")
        if os.path.exists(icon_path):
            try:
                self.iconbitmap(icon_path)
            except Exception:
                pass

        # Build UI layout
        self._build_header()
        self._build_tabs()
        self._build_statusbar()

        # Start queue processor
        self.after(50, self._process_event_queue)

        # Load initial data
        self.reload_graph_data(initial=True)

        # Start background watcher
        self.watcher_thread = threading.Thread(target=self._background_watcher, daemon=True)
        self.watcher_thread.start()

        # Cleanup on close
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _on_close(self):
        self.watcher_running = False
        self.destroy()

    # -------------------------------------------------------------
    # HEADER BAR (Modern SaaS Style)
    # -------------------------------------------------------------
    def _build_header(self):
        header_frame = ctk.CTkFrame(self, fg_color=C_BG_HEADER, corner_radius=0, height=68, border_width=1, border_color=C_BORDER)
        header_frame.pack(fill="x", side="top", padx=0, pady=0)
        header_frame.pack_propagate(False)

        # Left branding
        left_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        left_box.pack(side="left", padx=20, pady=10)

        brand_line = ctk.CTkFrame(left_box, fg_color="transparent")
        brand_line.pack(anchor="w")

        # Sleek Pill Badge
        badge = ctk.CTkLabel(
            brand_line,
            text="VISIBILL",
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            fg_color=C_PRIMARY,
            text_color="#ffffff",
            corner_radius=4,
            width=58,
            height=20
        )
        badge.pack(side="left", padx=(0, 10))

        title_lbl = ctk.CTkLabel(
            brand_line,
            text="ARCHITECTURE & KNOWLEDGE GRAPH",
            font=ctk.CTkFont(family="Segoe UI", size=15, weight="bold"),
            text_color=C_TEXT_MAIN
        )
        title_lbl.pack(side="left")

        self.subtitle_lbl = ctk.CTkLabel(
            left_box,
            text="Betöltés folyamatban...",
            font=ctk.CTkFont(family="Segoe UI", size=11),
            text_color=C_TEXT_MUTED
        )
        self.subtitle_lbl.pack(anchor="w", pady=(2, 0))

        # Center Live Status Badge
        self.badge_frame = ctk.CTkFrame(header_frame, fg_color="#10131d", corner_radius=20, border_width=1, border_color="#1e2436")
        self.badge_frame.pack(side="left", expand=True, padx=10, pady=14)

        self.live_dot = ctk.CTkLabel(
            self.badge_frame,
            text="●",
            text_color=C_EMERALD,
            font=ctk.CTkFont(size=14, weight="bold")
        )
        self.live_dot.pack(side="left", padx=(14, 6))

        self.live_status_lbl = ctk.CTkLabel(
            self.badge_frame,
            text="LIVE SYNC: AKTÍV",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color="#cbd5e1"
        )
        self.live_status_lbl.pack(side="left", padx=(0, 16), pady=6)

        # Right Action Buttons
        actions_box = ctk.CTkFrame(header_frame, fg_color="transparent")
        actions_box.pack(side="right", padx=20, pady=10)

        self.update_btn = ctk.CTkButton(
            actions_box,
            text="⚡ graphify update",
            width=140,
            height=34,
            corner_radius=8,
            fg_color=C_PRIMARY,
            hover_color=C_PRIMARY_HOVER,
            font=ctk.CTkFont(size=12, weight="bold"),
            command=self.trigger_graphify_update
        )
        self.update_btn.pack(side="left", padx=6)

        self.reload_btn = ctk.CTkButton(
            actions_box,
            text="Frissítés",
            width=85,
            height=34,
            corner_radius=8,
            fg_color=C_BG_CARD,
            border_width=1,
            border_color=C_BORDER,
            hover_color="#232635",
            font=ctk.CTkFont(size=12),
            command=lambda: self.reload_graph_data(force=True)
        )
        self.reload_btn.pack(side="left", padx=6)

        self.theme_btn = ctk.CTkButton(
            actions_box,
            text="🌓",
            width=40,
            height=34,
            corner_radius=8,
            fg_color=C_BG_CARD,
            border_width=1,
            border_color=C_BORDER,
            hover_color="#232635",
            command=self._toggle_theme
        )
        self.theme_btn.pack(side="left", padx=4)

    # -------------------------------------------------------------
    # TABVIEW NAVIGATION
    # -------------------------------------------------------------
    def _build_tabs(self):
        self.tabview = ctk.CTkTabview(
            self,
            fg_color=C_BG_APP,
            segmented_button_fg_color="#12131b",
            segmented_button_selected_color=C_PRIMARY,
            segmented_button_selected_hover_color=C_PRIMARY_HOVER,
            segmented_button_unselected_color="#1a1c27",
            segmented_button_unselected_hover_color="#242738",
            corner_radius=8
        )
        self.tabview.pack(fill="both", expand=True, padx=14, pady=(6, 2))

        # Styled Tab Names (without broken emoji characters)
        self.tab_overview = self.tabview.add("◈  Áttekintés & KPI-k")
        self.tab_explorer = self.tabview.add("❖  Architektúra Navigátor")
        self.tab_visualizer = self.tabview.add("◎  Interaktív Gráf")
        self.tab_impact = self.tabview.add("⚡  Érintettségi Vizsgálat")
        self.tab_console = self.tabview.add("⌨  Graphify Konzol")

        self._build_tab_overview()
        self._build_tab_explorer()
        self._build_tab_visualizer()
        self._build_tab_impact()
        self._build_tab_console()

    def _build_statusbar(self):
        self.statusbar = ctk.CTkFrame(self, fg_color=C_BG_HEADER, height=28, corner_radius=0, border_width=1, border_color=C_BORDER)
        self.statusbar.pack(fill="x", side="bottom")

        self.status_left = ctk.CTkLabel(
            self.statusbar,
            text="Kész. Gráf inicializálva.",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_MUTED
        )
        self.status_left.pack(side="left", padx=16)

        self.status_right = ctk.CTkLabel(
            self.statusbar,
            text=f"Munkakönyvtár: {self.root_dir}",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_DIM
        )
        self.status_right.pack(side="right", padx=16)

    # -------------------------------------------------------------
    # TAB 1: OVERVIEW & KPIS (Clean Modern Cards)
    # -------------------------------------------------------------
    def _build_tab_overview(self):
        scroll = ctk.CTkScrollableFrame(self.tab_overview, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=6, pady=8)

        # 1. KPI Cards Row
        kpi_grid = ctk.CTkFrame(scroll, fg_color="transparent")
        kpi_grid.pack(fill="x", pady=(0, 16))

        self.kpi_cards = {}
        cards_info = [
            ("nodes", "CSOMÓPONTOK", "Összes indexelt szimbólum", C_PRIMARY),
            ("links", "KAPCSOLATOK", "Import és hívási élek", C_CYAN),
            ("communities", "KÖZÖSSÉGEK", "Architektúra klaszterek", C_PURPLE),
            ("components", "KOMPONENSEK", "React UI elemek", C_EMERALD),
            ("hooks", "HOOKOK & ÁLLAPOT", "Custom hooks & context", C_AMBER),
            ("edge_funcs", "EDGE FUNCTIONS", "Deno backend mikro-szolgáltatások", C_ROSE),
        ]

        for i, (key, title, subtitle, color) in enumerate(cards_info):
            card = ctk.CTkFrame(kpi_grid, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
            card.grid(row=0, column=i, sticky="nsew", padx=5, pady=4)
            kpi_grid.columnconfigure(i, weight=1)

            # Accent top bar (3px)
            top_bar = ctk.CTkFrame(card, fg_color=color, height=3, corner_radius=0)
            top_bar.pack(fill="x", side="top")

            # Header with dot indicator
            h_frame = ctk.CTkFrame(card, fg_color="transparent")
            h_frame.pack(fill="x", padx=14, pady=(10, 0))

            dot = ctk.CTkLabel(h_frame, text="●", text_color=color, font=ctk.CTkFont(size=10))
            dot.pack(side="left", padx=(0, 6))

            t_lbl = ctk.CTkLabel(h_frame, text=title, font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"), text_color=C_TEXT_MUTED)
            t_lbl.pack(side="left")

            # Big Value
            val_lbl = ctk.CTkLabel(card, text="--", font=ctk.CTkFont(family="Segoe UI", size=24, weight="bold"), text_color=C_TEXT_MAIN)
            val_lbl.pack(anchor="w", padx=14, pady=(4, 0))
            self.kpi_cards[key] = val_lbl

            # Subtitle
            sub_lbl = ctk.CTkLabel(card, text=subtitle, font=ctk.CTkFont(size=10), text_color=C_TEXT_DIM)
            sub_lbl.pack(anchor="w", padx=14, pady=(0, 12))

        # 2. Middle Section: God Nodes + Import Cycles
        middle_frame = ctk.CTkFrame(scroll, fg_color="transparent")
        middle_frame.pack(fill="both", expand=True, pady=6)
        middle_frame.columnconfigure(0, weight=3)
        middle_frame.columnconfigure(1, weight=2)

        # Left Box: God Nodes
        god_box = ctk.CTkFrame(middle_frame, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
        god_box.grid(row=0, column=0, sticky="nsew", padx=(0, 8), pady=4)

        god_header = ctk.CTkFrame(god_box, fg_color="transparent")
        god_header.pack(fill="x", padx=18, pady=(14, 8))

        ctk.CTkLabel(
            god_header,
            text="◈ Központi Architektúra Magok (God Nodes)",
            font=ctk.CTkFont(family="Segoe UI", size=14, weight="bold"),
            text_color=C_TEXT_MAIN
        ).pack(anchor="w")

        ctk.CTkLabel(
            god_header,
            text="A legtöbb bejövő és kimenő kapcsolattal rendelkező kritikus modulok",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_MUTED
        ).pack(anchor="w", pady=(2, 0))

        self.god_nodes_container = ctk.CTkFrame(god_box, fg_color="transparent")
        self.god_nodes_container.pack(fill="both", expand=True, padx=16, pady=(0, 14))

        # Right Box: Import Cycles
        cycles_box = ctk.CTkFrame(middle_frame, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
        cycles_box.grid(row=0, column=1, sticky="nsew", padx=(8, 0), pady=4)

        cyc_header = ctk.CTkFrame(cycles_box, fg_color="transparent")
        cyc_header.pack(fill="x", padx=18, pady=(14, 8))

        ctk.CTkLabel(
            cyc_header,
            text="⚠ Körkörös Függőségek (Import Cycles)",
            font=ctk.CTkFont(family="Segoe UI", size=14, weight="bold"),
            text_color=C_AMBER
        ).pack(anchor="w")

        ctk.CTkLabel(
            cyc_header,
            text="Architektúra kockázatok, egymásra hivatkozó körkörös fájlok",
            font=ctk.CTkFont(size=11),
            text_color=C_TEXT_MUTED
        ).pack(anchor="w", pady=(2, 0))

        self.cycles_container = ctk.CTkFrame(cycles_box, fg_color="transparent")
        self.cycles_container.pack(fill="both", expand=True, padx=16, pady=(0, 14))

        # 3. Bottom Section: Relation Badges Bar
        rel_box = ctk.CTkFrame(scroll, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
        rel_box.pack(fill="x", pady=(14, 10))

        ctk.CTkLabel(
            rel_box,
            text="◈ Kapcsolattípusok Megoszlása a Kódbázisban",
            font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            text_color=C_TEXT_MAIN
        ).pack(anchor="w", padx=18, pady=(12, 6))

        self.relations_chip_container = ctk.CTkFrame(rel_box, fg_color="transparent")
        self.relations_chip_container.pack(fill="x", padx=14, pady=(0, 12))

    def _render_overview_data(self, stats: dict):
        # Update KPI numbers
        self.kpi_cards["nodes"].configure(text=f"{stats['total_nodes']:,}")
        self.kpi_cards["links"].configure(text=f"{stats['total_links']:,}")
        self.kpi_cards["communities"].configure(text=f"{stats['communities_count']:,}")

        cat = stats.get("categories_counts", {})
        self.kpi_cards["components"].configure(text=f"{cat.get('components', 0):,}")
        self.kpi_cards["hooks"].configure(text=f"{cat.get('hooks_contexts', 0):,}")
        self.kpi_cards["edge_funcs"].configure(text=f"{cat.get('edge_functions', 0):,}")

        # Render God Nodes Rows
        for w in self.god_nodes_container.winfo_children():
            w.destroy()

        god_list = self.engine.god_nodes_report or [
            {"name": "cn()", "edges": 635},
            {"name": "Button", "edges": 367},
            {"name": "useToast()", "edges": 342},
            {"name": "supabase", "edges": 296},
            {"name": "useAuth()", "edges": 264}
        ]

        max_edges = max([g["edges"] for g in god_list], default=1)
        rank_colors = ["#fbbf24", "#94a3b8", "#d97706"]  # Gold, Silver, Bronze

        for idx, g in enumerate(god_list[:8]):
            row = ctk.CTkFrame(self.god_nodes_container, fg_color="#12131b", corner_radius=6, height=38, border_width=1, border_color="#1e202d")
            row.pack(fill="x", pady=3)
            row.pack_propagate(False)

            # Rank Pill
            rank_col = rank_colors[idx] if idx < 3 else "#334155"
            r_badge = ctk.CTkLabel(
                row,
                text=f"#{idx+1}",
                font=ctk.CTkFont(size=10, weight="bold"),
                fg_color=rank_col,
                text_color="#000000" if idx < 3 else "#ffffff",
                width=26,
                height=18,
                corner_radius=4
            )
            r_badge.pack(side="left", padx=(10, 8))

            # Monospace Code Chip
            code_chip = ctk.CTkLabel(
                row,
                text=g["name"],
                font=ctk.CTkFont(family="Consolas", size=11, weight="bold"),
                text_color=C_CYAN,
                fg_color="#1a1c28",
                corner_radius=4,
                padx=8,
                pady=2
            )
            code_chip.pack(side="left", padx=4)

            # Inspect Button
            btn = ctk.CTkButton(
                row,
                text="Vizsgálat ›",
                width=76,
                height=24,
                font=ctk.CTkFont(size=10, weight="bold"),
                fg_color="#1e293b",
                hover_color=C_PRIMARY,
                corner_radius=4,
                command=lambda name=g["name"]: self._jump_to_node_by_name(name)
            )
            btn.pack(side="right", padx=(4, 10))

            # Edge Count
            edges_lbl = ctk.CTkLabel(row, text=f"{g['edges']} kapcsolat", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED)
            edges_lbl.pack(side="right", padx=10)

            # Sleek Progress Bar
            progress = ctk.CTkProgressBar(row, width=110, height=6, fg_color="#232535", progress_color=C_PRIMARY)
            progress.pack(side="right", padx=6)
            progress.set(g["edges"] / max_edges)

        # Render Import Cycles
        for w in self.cycles_container.winfo_children():
            w.destroy()

        if self.engine.import_cycles_report:
            for idx, cycle in enumerate(self.engine.import_cycles_report):
                crow = ctk.CTkFrame(self.cycles_container, fg_color="#1b1419", corner_radius=6, border_width=1, border_color="#381e27")
                crow.pack(fill="x", pady=3, padx=2)

                # Cycle header badge
                ch_frame = ctk.CTkFrame(crow, fg_color="transparent")
                ch_frame.pack(fill="x", padx=10, pady=(6, 2))

                c_badge = ctk.CTkLabel(
                    ch_frame,
                    text=f"KÖR #{idx+1}",
                    font=ctk.CTkFont(size=9, weight="bold"),
                    fg_color="#451a24",
                    text_color="#fca5a5",
                    corner_radius=3,
                    padx=6,
                    height=18
                )
                c_badge.pack(side="left")

                # Formatted path lines
                parts = cycle.split(" -> ")
                path_str = "\n  ↳ ".join([p.strip() for p in parts])

                ctk.CTkLabel(
                    crow,
                    text=path_str,
                    font=ctk.CTkFont(family="Consolas", size=9),
                    text_color="#fecaca",
                    justify="left"
                ).pack(anchor="w", padx=10, pady=(2, 8))
        else:
            ctk.CTkLabel(
                self.cycles_container,
                text="Nem található import kör a jelentésben.",
                font=ctk.CTkFont(size=11),
                text_color=C_TEXT_DIM
            ).pack(anchor="w", padx=8, pady=8)

        # Render Relations Metric Chips
        for w in self.relations_chip_container.winfo_children():
            w.destroy()

        relations_sorted = sorted(stats.get("relations", {}).items(), key=lambda x: x[1], reverse=True)[:8]
        chip_colors = [C_CYAN, C_PRIMARY, C_PURPLE, C_EMERALD, "#ec4899", C_AMBER, "#14b8a6", C_ROSE]

        for i, (rel_name, rel_count) in enumerate(relations_sorted):
            col = chip_colors[i % len(chip_colors)]
            chip = ctk.CTkFrame(self.relations_chip_container, fg_color="#12131b", corner_radius=6, border_width=1, border_color="#1f2231")
            chip.pack(side="left", padx=4, pady=2)

            dot = ctk.CTkLabel(chip, text="●", text_color=col, font=ctk.CTkFont(size=9))
            dot.pack(side="left", padx=(8, 4), pady=4)

            name_lbl = ctk.CTkLabel(chip, text=f"{rel_name}:", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED)
            name_lbl.pack(side="left", padx=2, pady=4)

            val_lbl = ctk.CTkLabel(chip, text=f"{rel_count:,}", font=ctk.CTkFont(size=11, weight="bold"), text_color=C_TEXT_MAIN)
            val_lbl.pack(side="left", padx=(2, 8), pady=4)

    # -------------------------------------------------------------
    # TAB 2: ARCHITECTURE EXPLORER & CODE INSPECTOR
    # -------------------------------------------------------------
    def _build_tab_explorer(self):
        pane = ctk.CTkFrame(self.tab_explorer, fg_color="transparent")
        pane.pack(fill="both", expand=True, padx=4, pady=4)
        pane.columnconfigure(0, weight=4)
        pane.columnconfigure(1, weight=5)
        pane.rowconfigure(0, weight=1)

        # Left Pane: Tree & Search
        left_frame = ctk.CTkFrame(pane, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
        left_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 6), pady=0)

        # Category Buttons Filter
        cat_bar = ctk.CTkScrollableFrame(left_frame, orientation="horizontal", height=42, fg_color="transparent")
        cat_bar.pack(fill="x", padx=10, pady=(10, 4))

        categories = [
            ("all", "Mind"),
            ("components", "Komponensek"),
            ("pages", "Oldalak"),
            ("hooks_contexts", "Hookok"),
            ("edge_functions", "Edge Funcs"),
            ("docs", "Dokumentációk")
        ]

        self.cat_buttons = {}
        for cat_id, cat_title in categories:
            b = ctk.CTkButton(
                cat_bar,
                text=cat_title,
                width=85,
                height=28,
                corner_radius=6,
                font=ctk.CTkFont(size=11, weight="bold"),
                fg_color=C_PRIMARY if cat_id == "all" else "#1b1d28",
                hover_color=C_PRIMARY_HOVER,
                command=lambda c=cat_id: self._select_category(c)
            )
            b.pack(side="left", padx=3)
            self.cat_buttons[cat_id] = b

        # Search Bar
        search_box = ctk.CTkFrame(left_frame, fg_color="transparent")
        search_box.pack(fill="x", padx=10, pady=4)

        self.explorer_search_entry = ctk.CTkEntry(
            search_box,
            placeholder_text="Keresés komponens, funkció vagy fájl alapján...",
            height=34,
            corner_radius=8,
            fg_color="#101117",
            border_color=C_BORDER,
            font=ctk.CTkFont(size=12)
        )
        self.explorer_search_entry.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self.explorer_search_entry.bind("<KeyRelease>", self._on_explorer_search)

        # Treeview (Custom Dark Styling)
        tree_container = tk.Frame(left_frame, bg=C_BG_CARD)
        tree_container.pack(fill="both", expand=True, padx=10, pady=(6, 10))

        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "Graph.Treeview",
            background="#12131b",
            foreground="#e2e8f0",
            fieldbackground="#12131b",
            borderwidth=0,
            rowheight=26,
            font=("Segoe UI", 10)
        )
        style.configure(
            "Graph.Treeview.Heading",
            background="#1a1c27",
            foreground="#94a3b8",
            font=("Segoe UI", 10, "bold"),
            borderwidth=0
        )
        style.map("Graph.Treeview", background=[("selected", C_PRIMARY)], foreground=[("selected", "#ffffff")])

        self.tree = ttk.Treeview(tree_container, columns=("file", "type"), selectmode="browse", style="Graph.Treeview")
        self.tree.heading("#0", text="Elem / Csomópont", anchor="w")
        self.tree.heading("file", text="Forrásfájl", anchor="w")
        self.tree.heading("type", text="Típus", anchor="center")

        self.tree.column("#0", width=220, anchor="w")
        self.tree.column("file", width=260, anchor="w")
        self.tree.column("type", width=70, anchor="center")

        tree_scroll = ttk.Scrollbar(tree_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scroll.set)

        self.tree.pack(side="left", fill="both", expand=True)
        tree_scroll.pack(side="right", fill="y")

        self.tree.bind("<<TreeviewSelect>>", self._on_tree_select)
        self.tree.bind("<Double-1>", self._on_tree_double_click)

        # Right Pane: Inspector & Code Preview
        right_frame = ctk.CTkFrame(pane, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
        right_frame.grid(row=0, column=1, sticky="nsew", padx=(6, 0), pady=0)

        # Header Info Card
        self.insp_title_lbl = ctk.CTkLabel(
            right_frame,
            text="Válassz ki egy elemet",
            font=ctk.CTkFont(family="Segoe UI", size=16, weight="bold"),
            text_color=C_CYAN
        )
        self.insp_title_lbl.pack(anchor="w", padx=16, pady=(12, 2))

        self.insp_file_lbl = ctk.CTkLabel(
            right_frame,
            text="--",
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color=C_TEXT_MUTED
        )
        self.insp_file_lbl.pack(anchor="w", padx=16, pady=(0, 8))

        # Inspector Action Bar
        act_bar = ctk.CTkFrame(right_frame, fg_color="transparent")
        act_bar.pack(fill="x", padx=14, pady=4)

        self.btn_inspect_graph = ctk.CTkButton(
            act_bar,
            text="◎ Gráf Nézet",
            width=110,
            height=30,
            fg_color=C_PRIMARY,
            hover_color=C_PRIMARY_HOVER,
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._view_selected_in_graph
        )
        self.btn_inspect_graph.pack(side="left", padx=4)

        self.btn_open_editor = ctk.CTkButton(
            act_bar,
            text="Megnyitás VS Code-ban",
            width=160,
            height=30,
            fg_color="#1f2333",
            border_width=1,
            border_color=C_BORDER,
            hover_color="#292e42",
            font=ctk.CTkFont(size=11),
            command=self._open_in_editor
        )
        self.btn_open_editor.pack(side="left", padx=4)

        # Relations sub-lists (Incoming / Outgoing)
        rel_split = ctk.CTkFrame(right_frame, fg_color="transparent")
        rel_split.pack(fill="x", padx=14, pady=6)
        rel_split.columnconfigure(0, weight=1)
        rel_split.columnconfigure(1, weight=1)

        # In-degree box
        in_box = ctk.CTkFrame(rel_split, fg_color="#12131b", corner_radius=8, border_width=1, border_color="#1e202d")
        in_box.grid(row=0, column=0, sticky="nsew", padx=(0, 4), pady=0)
        self.in_count_lbl = ctk.CTkLabel(in_box, text="● Bejövő Hívások (0)", font=ctk.CTkFont(size=11, weight="bold"), text_color=C_EMERALD)
        self.in_count_lbl.pack(anchor="w", padx=10, pady=(6, 2))
        self.in_listbox = tk.Listbox(in_box, bg="#0d0e14", fg="#e2e8f0", selectbackground=C_PRIMARY, height=5, borderwidth=0, highlightthickness=0)
        self.in_listbox.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.in_listbox.bind("<Double-Button-1>", lambda e: self._on_relation_double_click(self.in_listbox))

        # Out-degree box
        out_box = ctk.CTkFrame(rel_split, fg_color="#12131b", corner_radius=8, border_width=1, border_color="#1e202d")
        out_box.grid(row=0, column=1, sticky="nsew", padx=(4, 0), pady=0)
        self.out_count_lbl = ctk.CTkLabel(out_box, text="● Kimenő Függőségek (0)", font=ctk.CTkFont(size=11, weight="bold"), text_color=C_AMBER)
        self.out_count_lbl.pack(anchor="w", padx=10, pady=(6, 2))
        self.out_listbox = tk.Listbox(out_box, bg="#0d0e14", fg="#e2e8f0", selectbackground=C_PRIMARY, height=5, borderwidth=0, highlightthickness=0)
        self.out_listbox.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.out_listbox.bind("<Double-Button-1>", lambda e: self._on_relation_double_click(self.out_listbox))

        # Code Preview
        ctk.CTkLabel(
            right_frame,
            text="Forráskód Előnézet",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=C_TEXT_MAIN
        ).pack(anchor="w", padx=16, pady=(6, 2))

        self.code_text = ctk.CTkTextbox(
            right_frame,
            fg_color="#0c0d12",
            text_color="#e2e8f0",
            font=ctk.CTkFont(family="Consolas", size=11),
            corner_radius=8,
            border_width=1,
            border_color="#1e202d"
        )
        self.code_text.pack(fill="both", expand=True, padx=14, pady=(2, 12))

    def _select_category(self, cat_id: str):
        self.active_category = cat_id
        for cid, btn in self.cat_buttons.items():
            btn.configure(fg_color=C_PRIMARY if cid == cat_id else "#1b1d28")
        self._populate_explorer_tree()

    def _populate_explorer_tree(self, filter_query: str = ""):
        self.tree.delete(*self.tree.get_children())

        if filter_query:
            nodes_to_show = self.engine.search_nodes(filter_query, limit=120)
        else:
            if self.active_category == "all":
                nodes_to_show = (
                    self.engine.categories["components"][:50] +
                    self.engine.categories["pages"][:40] +
                    self.engine.categories["hooks_contexts"][:40] +
                    self.engine.categories["edge_functions"][:30]
                )
            else:
                nodes_to_show = self.engine.categories.get(self.active_category, [])[:150]

        for n in nodes_to_show:
            lbl = n.get("label", "N/A")
            src = n.get("source_file", "")
            ft = n.get("file_type", "code")
            self.tree.insert("", "end", iid=n["id"], text=lbl, values=(src, ft))

    def _on_explorer_search(self, event=None):
        q = self.explorer_search_entry.get().strip()
        self._populate_explorer_tree(filter_query=q)

    def _on_tree_select(self, event=None):
        sel = self.tree.selection()
        if not sel:
            return
        node_id = sel[0]
        self._inspect_node(node_id)

    def _on_tree_double_click(self, event=None):
        sel = self.tree.selection()
        if sel:
            self._view_selected_in_graph()

    def _inspect_node(self, node_id: str):
        self.selected_node_id = node_id
        details = self.engine.get_node_details(node_id)
        if not details:
            return

        node = details["node"]
        self.insp_title_lbl.configure(text=f"{node.get('label', 'N/A')}  [{node.get('file_type', 'code')}]")
        loc = node.get("source_location", "")
        self.insp_file_lbl.configure(text=f"{node.get('source_file', '')} : {loc}")

        # Update lists
        self.in_listbox.delete(0, tk.END)
        self.incoming_map.clear()
        for idx, item in enumerate(details["incoming"][:100]):
            txt = f"{item['label']}  [{item['relation']}]"
            self.in_listbox.insert(tk.END, txt)
            self.incoming_map[idx] = item["source_id"]

        self.in_count_lbl.configure(text=f"● Bejövő Hívások ({len(details['incoming'])})")

        self.out_listbox.delete(0, tk.END)
        self.outgoing_map.clear()
        for idx, item in enumerate(details["outgoing"][:100]):
            txt = f"{item['label']}  [{item['relation']}]"
            self.out_listbox.insert(tk.END, txt)
            self.outgoing_map[idx] = item["target_id"]

        self.out_count_lbl.configure(text=f"● Kimenő Függőségek ({len(details['outgoing'])})")

        # Code preview
        self.code_text.delete("1.0", tk.END)
        snippet = details.get("snippet", "")
        if snippet:
            self.code_text.insert("1.0", snippet)
        else:
            self.code_text.insert("1.0", "// Forráskód előnézet nem érhető el vagy nem kódfájl.")

    def _on_relation_double_click(self, listbox):
        sel = listbox.curselection()
        if not sel:
            return
        idx = sel[0]
        target_map = self.incoming_map if listbox == self.in_listbox else self.outgoing_map
        nid = target_map.get(idx)
        if nid:
            self._inspect_node(nid)

    def _view_selected_in_graph(self):
        if not self.selected_node_id:
            return
        self.tabview.set("◎  Interaktív Gráf")
        self._load_visualizer_node(self.selected_node_id)

    def _open_in_editor(self):
        if not self.selected_node_id:
            return
        node = self.engine.nodes_by_id.get(self.selected_node_id)
        if not node:
            return
        src_file = node.get("source_file", "")
        if not src_file:
            return
        abs_path = os.path.join(self.root_dir, src_file)
        loc = node.get("source_location", "L1")
        line = "1"
        m = re.search(r"L(\d+)", loc)
        if m:
            line = m.group(1)

        try:
            cmd = f'code -g "{abs_path}:{line}"'
            subprocess.Popen(cmd, shell=True)
            self.status_left.configure(text=f"Megnyitva szerkesztőben: {src_file}:{line}")
        except Exception as e:
            try:
                os.startfile(abs_path)
            except Exception as e2:
                messagebox.showerror("Hiba", f"Nem sikerült megnyitni a fájlt: {e2}")

    # -------------------------------------------------------------
    # TAB 3: INTERACTIVE GRAPH VISUALIZER
    # -------------------------------------------------------------
    def _build_tab_visualizer(self):
        control_bar = ctk.CTkFrame(self.tab_visualizer, fg_color=C_BG_CARD, height=52, corner_radius=8, border_width=1, border_color=C_BORDER)
        control_bar.pack(fill="x", padx=4, pady=(4, 6))

        ctk.CTkLabel(control_bar, text="Központi Elem:", font=ctk.CTkFont(size=12, weight="bold"), text_color=C_TEXT_MUTED).pack(side="left", padx=(16, 6))
        self.viz_center_lbl = ctk.CTkLabel(control_bar, text="Nincs kiválasztva", font=ctk.CTkFont(family="Consolas", size=13, weight="bold"), text_color=C_CYAN)
        self.viz_center_lbl.pack(side="left", padx=4)

        # Depth selector
        ctk.CTkLabel(control_bar, text="Mélység:", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED).pack(side="left", padx=(24, 6))
        self.depth_var = ctk.StringVar(value="1")
        depth_seg = ctk.CTkSegmentedButton(
            control_bar,
            values=["1", "2"],
            variable=self.depth_var,
            width=70,
            selected_color=C_PRIMARY,
            command=lambda v: self._refresh_visualizer()
        )
        depth_seg.pack(side="left", padx=4)

        # Fit view button
        fit_btn = ctk.CTkButton(
            control_bar,
            text="🎯 Igazítás",
            width=90,
            height=28,
            fg_color="#1e2230",
            border_width=1,
            border_color=C_BORDER,
            hover_color="#2b3145",
            command=lambda: self.canvas.fit_view()
        )
        fit_btn.pack(side="left", padx=14)

        # Quick Jump search
        self.viz_search_entry = ctk.CTkEntry(
            control_bar,
            placeholder_text="Gyors ugrás csomópontra...",
            width=220,
            height=30,
            fg_color="#0e1017",
            border_color=C_BORDER
        )
        self.viz_search_entry.pack(side="right", padx=16)
        self.viz_search_entry.bind("<Return>", lambda e: self._jump_to_node_by_name(self.viz_search_entry.get().strip()))

        # Canvas Frame
        canvas_frame = ctk.CTkFrame(self.tab_visualizer, fg_color="#0e1017", corner_radius=8, border_width=1, border_color=C_BORDER)
        canvas_frame.pack(fill="both", expand=True, padx=4, pady=4)

        self.canvas = GraphCanvas(
            canvas_frame,
            on_node_select=self._on_canvas_node_select,
            on_node_double_click=self._on_canvas_node_double_click
        )
        self.canvas.pack(fill="both", expand=True)

    def _load_visualizer_node(self, node_id: str):
        depth = int(self.depth_var.get())
        ego_data = self.engine.get_ego_graph(node_id, depth=depth, max_nodes=45)
        node = self.engine.nodes_by_id.get(node_id)
        if node:
            self.viz_center_lbl.configure(text=f"{node.get('label')}  ({len(ego_data['nodes'])} kapcsolódó)")
        self.canvas.set_data(ego_data)

    def _refresh_visualizer(self):
        if self.canvas.center_id:
            self._load_visualizer_node(self.canvas.center_id)

    def _on_canvas_node_select(self, node_id: str):
        self.selected_node_id = node_id
        node = self.engine.nodes_by_id.get(node_id)
        if node:
            self.status_left.configure(text=f"Kiválasztva: {node.get('label')} ({node.get('source_file')})")

    def _on_canvas_node_double_click(self, node_id: str):
        self._load_visualizer_node(node_id)

    def _jump_to_node_by_name(self, name: str):
        if not name:
            return
        results = self.engine.search_nodes(name, limit=1)
        if results:
            nid = results[0]["id"]
            self.tabview.set("◎  Interaktív Gráf")
            self._load_visualizer_node(nid)
            self._inspect_node(nid)
        else:
            messagebox.showinfo("Keresés", f"Nem található csomópont: '{name}'")

    # -------------------------------------------------------------
    # TAB 4: IMPACT & PATH ANALYSIS
    # -------------------------------------------------------------
    def _build_tab_impact(self):
        pane = ctk.CTkFrame(self.tab_impact, fg_color="transparent")
        pane.pack(fill="both", expand=True, padx=6, pady=6)
        pane.columnconfigure(0, weight=1)
        pane.columnconfigure(1, weight=1)
        pane.rowconfigure(0, weight=1)

        # Left Column: Impact Analysis
        impact_box = ctk.CTkFrame(pane, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
        impact_box.grid(row=0, column=0, sticky="nsew", padx=(0, 6), pady=0)

        ctk.CTkLabel(impact_box, text="⚡ Érintettségi Vizsgálat (Impact Analysis)", font=ctk.CTkFont(size=14, weight="bold"), text_color=C_TEXT_MAIN).pack(anchor="w", padx=16, pady=(14, 4))
        ctk.CTkLabel(impact_box, text="Ha módosítasz egy komponenst vagy segédfüggvényt, mi minden sérülhet / érintett?", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED).pack(anchor="w", padx=16, pady=(0, 10))

        search_row = ctk.CTkFrame(impact_box, fg_color="transparent")
        search_row.pack(fill="x", padx=14, pady=4)
        self.impact_entry = ctk.CTkEntry(search_row, placeholder_text="Írd be a vizsgálandó fájl/szimbólum nevét...", height=34, fg_color="#101117", border_color=C_BORDER)
        self.impact_entry.pack(side="left", fill="x", expand=True, padx=(0, 6))

        impact_btn = ctk.CTkButton(search_row, text="Elemzés", width=95, height=34, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOVER, command=self._run_impact_analysis)
        impact_btn.pack(side="right")

        self.impact_summary_lbl = ctk.CTkLabel(impact_box, text="Nincs futtatva elemzés", font=ctk.CTkFont(size=11, weight="bold"), text_color=C_CYAN)
        self.impact_summary_lbl.pack(anchor="w", padx=16, pady=(8, 4))

        self.impact_textbox = ctk.CTkTextbox(impact_box, fg_color="#0c0d12", font=ctk.CTkFont(family="Consolas", size=11), border_width=1, border_color="#1e202d")
        self.impact_textbox.pack(fill="both", expand=True, padx=14, pady=(4, 14))

        # Right Column: Shortest Path Finder
        path_box = ctk.CTkFrame(pane, fg_color=C_BG_CARD, corner_radius=10, border_width=1, border_color=C_BORDER)
        path_box.grid(row=0, column=1, sticky="nsew", padx=(6, 0), pady=0)

        ctk.CTkLabel(path_box, text="🔗 Függőségi Útvonal (Shortest Path)", font=ctk.CTkFont(size=14, weight="bold"), text_color=C_TEXT_MAIN).pack(anchor="w", padx=16, pady=(14, 4))
        ctk.CTkLabel(path_box, text="Találd meg a legrövidebb hívási láncot két tetszőleges komponens között!", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED).pack(anchor="w", padx=16, pady=(0, 10))

        p_in1 = ctk.CTkFrame(path_box, fg_color="transparent")
        p_in1.pack(fill="x", padx=14, pady=3)
        ctk.CTkLabel(p_in1, text="Honnan (Start):", width=100, anchor="w", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED).pack(side="left")
        self.path_start_entry = ctk.CTkEntry(p_in1, placeholder_text="pl. InvoiceContext", height=32, fg_color="#101117", border_color=C_BORDER)
        self.path_start_entry.pack(side="left", fill="x", expand=True)

        p_in2 = ctk.CTkFrame(path_box, fg_color="transparent")
        p_in2.pack(fill="x", padx=14, pady=3)
        ctk.CTkLabel(p_in2, text="Hová (Cél):", width=100, anchor="w", font=ctk.CTkFont(size=11), text_color=C_TEXT_MUTED).pack(side="left")
        self.path_end_entry = ctk.CTkEntry(p_in2, placeholder_text="pl. supabase", height=32, fg_color="#101117", border_color=C_BORDER)
        self.path_end_entry.pack(side="left", fill="x", expand=True)

        find_path_btn = ctk.CTkButton(path_box, text="Útvonal Keresése", height=34, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOVER, command=self._run_path_finder)
        find_path_btn.pack(fill="x", padx=14, pady=(8, 8))

        self.path_textbox = ctk.CTkTextbox(path_box, fg_color="#0c0d12", font=ctk.CTkFont(family="Consolas", size=11), border_width=1, border_color="#1e202d")
        self.path_textbox.pack(fill="both", expand=True, padx=14, pady=(4, 14))

    def _run_impact_analysis(self):
        target = self.impact_entry.get().strip()
        if not target:
            return
        results = self.engine.search_nodes(target, limit=1)
        if not results:
            self.impact_summary_lbl.configure(text=f"Nem található elem: '{target}'")
            return

        target_node = results[0]
        target_id = target_node["id"]

        direct_callers = self.engine.adj_in.get(target_id, [])
        all_impacted_ids = set()
        for l in direct_callers:
            all_impacted_ids.add(l.get("source"))

        second_hop_ids = set()
        for cid in list(all_impacted_ids):
            for l2 in self.engine.adj_in.get(cid, []):
                second_hop_ids.add(l2.get("source"))

        self.impact_summary_lbl.configure(
            text=f"Cél: {target_node['label']}  |  Direkt érintett: {len(all_impacted_ids)}  |  2. szintű: {len(second_hop_ids)}"
        )

        lines = [
            f"=== ÉRINTETTSÉGI ELEMZÉS: {target_node['label']} ===",
            f"Fájl: {target_node.get('source_file')}\n",
            f"--- 1. SZINTŰ KÖZVETLEN HÍVÓK / IMPORTÁLÓK ({len(all_impacted_ids)}) ---"
        ]
        for l in direct_callers[:35]:
            src = self.engine.nodes_by_id.get(l.get("source"))
            if src:
                lines.append(f"  • {src.get('label'):<25} [{l.get('relation'):<12}] -> {src.get('source_file')}")

        lines.append(f"\n--- 2. SZINTŰ INDIREKT FÜGGŐSÉGEK ({len(second_hop_ids)}) ---")
        for sid in list(second_hop_ids)[:25]:
            src = self.engine.nodes_by_id.get(sid)
            if src:
                lines.append(f"  • {src.get('label'):<25} -> {src.get('source_file')}")

        self.impact_textbox.delete("1.0", tk.END)
        self.impact_textbox.insert("1.0", "\n".join(lines))

    def _run_path_finder(self):
        s_name = self.path_start_entry.get().strip()
        e_name = self.path_end_entry.get().strip()
        if not s_name or not e_name:
            return

        s_nodes = self.engine.search_nodes(s_name, limit=1)
        e_nodes = self.engine.search_nodes(e_name, limit=1)
        if not s_nodes or not e_nodes:
            self.path_textbox.delete("1.0", tk.END)
            self.path_textbox.insert("1.0", "Hiba: Egyik vagy mindkét csomópont nem található a gráfban!")
            return

        s_id = s_nodes[0]["id"]
        e_id = e_nodes[0]["id"]

        path = self.engine.find_shortest_path(s_id, e_id)
        self.path_textbox.delete("1.0", tk.END)

        if not path:
            self.path_textbox.insert("1.0", f"Nincs közvetlen kimenő függőségi útvonal:\n'{s_nodes[0]['label']}'  --->  '{e_nodes[0]['label']}'")
            return

        lines = [
            f"=== LEGRÖVIDEBB FÜGGŐSÉGI LÁNC ({len(path)-1} lépés) ===",
            f"Start: {s_nodes[0]['label']} ({s_nodes[0].get('source_file')})",
            f"Cél:   {e_nodes[0]['label']} ({e_nodes[0].get('source_file')})\n"
        ]

        for i, (node, link) in enumerate(path):
            rel_txt = f" --[{link.get('relation')}]--> " if link else ""
            lines.append(f"[{i}] {node.get('label')}  ({node.get('source_file')})")
            if rel_txt:
                lines.append(f"    {rel_txt}")

        self.path_textbox.insert("1.0", "\n".join(lines))

    # -------------------------------------------------------------
    # TAB 5: GRAPHIFY CONSOLE & CLI RUNNER
    # -------------------------------------------------------------
    def _build_tab_console(self):
        ctrl = ctk.CTkFrame(self.tab_console, fg_color=C_BG_CARD, height=52, corner_radius=8, border_width=1, border_color=C_BORDER)
        ctrl.pack(fill="x", padx=4, pady=(4, 6))

        ctk.CTkLabel(ctrl, text="Parancs:", font=ctk.CTkFont(size=12, weight="bold"), text_color=C_TEXT_MUTED).pack(side="left", padx=(16, 6))

        self.cli_query_entry = ctk.CTkEntry(
            ctrl,
            placeholder_text="pl. Hol van a számla kiállítás logika? vagy query kérdés...",
            width=400,
            height=34,
            fg_color="#101117",
            border_color=C_BORDER
        )
        self.cli_query_entry.pack(side="left", padx=6)
        self.cli_query_entry.bind("<Return>", lambda e: self._run_graphify_query())

        query_btn = ctk.CTkButton(ctrl, text="Kérdezés (query)", width=130, height=34, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOVER, command=self._run_graphify_query)
        query_btn.pack(side="left", padx=6)

        upd_btn = ctk.CTkButton(ctrl, text="graphify update .", width=140, height=34, fg_color="#1e2230", border_width=1, border_color=C_BORDER, command=self.trigger_graphify_update)
        upd_btn.pack(side="left", padx=6)

        clear_btn = ctk.CTkButton(ctrl, text="Törlés", width=70, height=34, fg_color="#1a1c27", command=lambda: self.console_text.delete("1.0", tk.END))
        clear_btn.pack(side="right", padx=16)

        # Terminal Box with Window dots
        term_frame = ctk.CTkFrame(self.tab_console, fg_color="#0c0d12", corner_radius=8, border_width=1, border_color=C_BORDER)
        term_frame.pack(fill="both", expand=True, padx=4, pady=4)

        term_bar = ctk.CTkFrame(term_frame, fg_color="#12131b", height=28, corner_radius=0)
        term_bar.pack(fill="x", side="top")
        term_bar.pack_propagate(False)

        dots = ctk.CTkLabel(term_bar, text="● ● ●", font=ctk.CTkFont(size=9), text_color="#475569")
        dots.pack(side="left", padx=12)

        term_title = ctk.CTkLabel(term_bar, text="graphify-cli terminal", font=ctk.CTkFont(family="Consolas", size=10), text_color=C_TEXT_DIM)
        term_title.pack(side="left", padx=6)

        self.console_text = ctk.CTkTextbox(
            term_frame,
            fg_color="#0c0d12",
            text_color=C_CYAN,
            font=ctk.CTkFont(family="Consolas", size=11),
            corner_radius=0,
            border_width=0
        )
        self.console_text.pack(fill="both", expand=True, padx=6, pady=6)
        self.console_text.insert("1.0", "=== Graphify Konzol inicializálva. Kérdezz vagy frissíts a fenti gombokkal. ===\n")

    def _run_graphify_query(self):
        q = self.cli_query_entry.get().strip()
        if not q:
            return
        self.console_text.insert(tk.END, f"\n> graphify query \"{q}\"\n")
        self.console_text.see(tk.END)

        def worker():
            try:
                proc = subprocess.Popen(
                    f'graphify query "{q}"',
                    cwd=self.root_dir,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace"
                )
                for line in proc.stdout:
                    self.event_queue.put(("console_line", line))
                proc.wait()
                self.event_queue.put(("console_line", f"\n[Kész. Hibakód: {proc.returncode}]\n"))
            except Exception as e:
                self.event_queue.put(("console_line", f"\nHiba a futtatás közben: {e}\n"))

        threading.Thread(target=worker, daemon=True).start()

    def _process_event_queue(self):
        """Processes messages from background threads safely in the main GUI thread."""
        while not self.event_queue.empty():
            try:
                msg_type, payload = self.event_queue.get_nowait()
                if msg_type == "load_complete":
                    self._on_load_complete(payload)
                elif msg_type == "console_line":
                    self.console_text.insert(tk.END, payload)
                    self.console_text.see(tk.END)
                elif msg_type == "update_finished":
                    self._on_graphify_update_finished(payload)
                elif msg_type == "status_error":
                    self.status_left.configure(text=payload)
                elif msg_type == "trigger_reload":
                    self.reload_graph_data(force=True)
            except queue.Empty:
                break
        if self.watcher_running:
            self.after(50, self._process_event_queue)

    # -------------------------------------------------------------
    # LIVE ENGINE & DATA RELOADING
    # -------------------------------------------------------------
    def reload_graph_data(self, force: bool = False, initial: bool = False):
        if not force and not self.engine.needs_reload() and not initial:
            return

        self.live_status_lbl.configure(text="BETÖLTÉS...")
        self.status_left.configure(text="Graphify adatok betöltése és indexelése folyamatban...")

        def load_worker():
            ok = self.engine.load()
            if ok:
                stats = self.engine.get_stats()
                self.event_queue.put(("load_complete", stats))
            else:
                self.event_queue.put(("status_error", "Hiba: graphify-out/graph.json nem található!"))

        threading.Thread(target=load_worker, daemon=True).start()

    def _on_load_complete(self, stats: dict):
        # Update overview
        self._render_overview_data(stats)

        # Update Explorer Tree
        self._populate_explorer_tree()

        # Update Header Status
        now_str = time.strftime("%H:%M:%S")
        self.live_status_lbl.configure(text=f"LIVE SYNC: AKTÍV ({now_str})")
        self.live_dot.configure(text_color=C_EMERALD)
        self.subtitle_lbl.configure(
            text=f"Commit: {stats['built_at_commit'][:8]}   •   Nodes: {stats['total_nodes']:,}   •   Edges: {stats['total_links']:,}   •   Index: {stats['load_time_sec']}s"
        )
        self.status_left.configure(text=f"Naprakész. {stats['total_nodes']:,} csomópont és {stats['total_links']:,} kapcsolat betöltve.")

        # Default select if nothing selected
        if not self.selected_node_id and self.engine.nodes:
            if self.engine.god_nodes_report:
                first_god = self.engine.god_nodes_report[0]["name"]
                res = self.engine.search_nodes(first_god, limit=1)
                if res:
                    self._inspect_node(res[0]["id"])
                    self._load_visualizer_node(res[0]["id"])
            elif self.engine.nodes:
                self._inspect_node(self.engine.nodes[0]["id"])

    def trigger_graphify_update(self):
        if self.is_updating:
            return
        self.is_updating = True
        self.update_btn.configure(text="⏳ Frissítés...", state="disabled")
        self.live_dot.configure(text_color=C_AMBER)
        self.live_status_lbl.configure(text="GRAPHIFY UPDATE FUT...")

        self.tabview.set("⌨  Graphify Konzol")
        self.console_text.insert(tk.END, f"\n=== [INDÍTÁS: graphify update .] ({time.strftime('%H:%M:%S')}) ===\n")
        self.console_text.see(tk.END)

        def update_worker():
            try:
                proc = subprocess.Popen(
                    "graphify update .",
                    cwd=self.root_dir,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace"
                )
                for line in proc.stdout:
                    self.event_queue.put(("console_line", line))
                proc.wait()

                self.event_queue.put(("update_finished", proc.returncode))
            except Exception as e:
                self.event_queue.put(("console_line", f"\nHiba a graphify futtatásakor: {e}\n"))
                self.is_updating = False
                self.update_btn.configure(text="⚡ graphify update", state="normal")

        threading.Thread(target=update_worker, daemon=True).start()

    def _on_graphify_update_finished(self, returncode: int):
        self.is_updating = False
        self.update_btn.configure(text="⚡ graphify update", state="normal")
        if returncode == 0:
            self.console_text.insert(tk.END, "\n✅ SIKERES FRISSÍTÉS! Gráf újratöltése...\n")
            self.reload_graph_data(force=True)
        else:
            self.console_text.insert(tk.END, f"\n❌ HIBA a frissítés közben. Hibakód: {returncode}\n")
            self.live_status_lbl.configure(text="FRISSÍTÉSI HIBA")
            self.live_dot.configure(text_color=C_ROSE)

    def _background_watcher(self):
        """Continuously checks if graphify-out/graph.json has been modified externally."""
        while self.watcher_running:
            time.sleep(2.0)
            if not self.is_updating and self.engine.needs_reload():
                self.event_queue.put(("trigger_reload", None))

    def _toggle_theme(self):
        current = ctk.get_appearance_mode()
        new_mode = "Light" if current == "Dark" else "Dark"
        ctk.set_appearance_mode(new_mode)
        bg_col = "#ffffff" if new_mode == "Light" else "#0c0d12"
        self.configure(fg_color=bg_col)
        self.canvas.configure(bg="#f8fafc" if new_mode == "Light" else "#0e1017")
        self.canvas.redraw()

if __name__ == "__main__":
    app = DashboardApp(root_dir=".")
    app.mainloop()
