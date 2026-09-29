"""
Graphify Data Engine for eaisybill-prod
Loads, indexes, searches and provides graph intelligence from graphify-out.
"""

import os
import json
import re
import time
from typing import Dict, List, Any, Optional, Set, Tuple

class GraphEngine:
    def __init__(self, root_dir: str):
        self.root_dir = os.path.abspath(root_dir)
        self.graph_json_path = os.path.join(self.root_dir, "graphify-out", "graph.json")
        self.report_md_path = os.path.join(self.root_dir, "graphify-out", "GRAPH_REPORT.md")
        self.manifest_path = os.path.join(self.root_dir, "graphify-out", "manifest.json")

        self.last_mtime: float = 0.0
        self.last_load_time: float = 0.0

        # Raw data
        self.raw_graph: Dict[str, Any] = {}
        self.nodes: List[Dict[str, Any]] = []
        self.links: List[Dict[str, Any]] = []
        self.built_at_commit: str = ""

        # Indexes
        self.nodes_by_id: Dict[str, Dict[str, Any]] = {}
        self.nodes_by_file: Dict[str, List[Dict[str, Any]]] = {}
        self.adj_out: Dict[str, List[Dict[str, Any]]] = {}
        self.adj_in: Dict[str, List[Dict[str, Any]]] = {}

        # Parsed Report data
        self.report_summary: Dict[str, Any] = {}
        self.god_nodes_report: List[Dict[str, Any]] = []
        self.import_cycles_report: List[str] = []
        self.communities_report: List[Dict[str, Any]] = []

        # Categories
        self.categories: Dict[str, List[Dict[str, Any]]] = {
            "components": [],
            "pages": [],
            "hooks_contexts": [],
            "edge_functions": [],
            "database_sql": [],
            "agents_skills": [],
            "docs": [],
            "other": []
        }

    def is_available(self) -> bool:
        return os.path.exists(self.graph_json_path)

    def get_current_mtime(self) -> float:
        if os.path.exists(self.graph_json_path):
            return os.path.getmtime(self.graph_json_path)
        return 0.0

    def needs_reload(self) -> bool:
        current_mtime = self.get_current_mtime()
        return current_mtime > self.last_mtime

    def load(self) -> bool:
        if not self.is_available():
            return False

        t0 = time.time()
        current_mtime = self.get_current_mtime()

        with open(self.graph_json_path, "r", encoding="utf-8") as f:
            self.raw_graph = json.load(f)

        self.nodes = self.raw_graph.get("nodes", [])
        self.links = self.raw_graph.get("links", [])
        self.built_at_commit = self.raw_graph.get("built_at_commit", "")

        # Reset indexes
        self.nodes_by_id.clear()
        self.nodes_by_file.clear()
        self.adj_out.clear()
        self.adj_in.clear()
        for k in self.categories:
            self.categories[k].clear()

        # Build node indexes
        for n in self.nodes:
            nid = n.get("id")
            if not nid:
                continue
            self.nodes_by_id[nid] = n

            src_file = n.get("source_file", "") or ""
            norm_file = src_file.replace("\\", "/")
            if norm_file:
                self.nodes_by_file.setdefault(norm_file, []).append(n)

            # Categorize
            if "src/components/" in norm_file:
                self.categories["components"].append(n)
            elif "src/pages/" in norm_file:
                self.categories["pages"].append(n)
            elif "src/hooks/" in norm_file or "src/context/" in norm_file or "src/contexts/" in norm_file:
                self.categories["hooks_contexts"].append(n)
            elif "supabase/functions/" in norm_file:
                self.categories["edge_functions"].append(n)
            elif "supabase/migrations/" in norm_file or norm_file.endswith(".sql"):
                self.categories["database_sql"].append(n)
            elif ".agents/" in norm_file:
                self.categories["agents_skills"].append(n)
            elif norm_file.startswith("docs/") or norm_file.endswith(".md"):
                self.categories["docs"].append(n)
            else:
                self.categories["other"].append(n)

        # Build adjacency lists
        for l in self.links:
            src = l.get("source")
            tgt = l.get("target")
            if src:
                self.adj_out.setdefault(src, []).append(l)
            if tgt:
                self.adj_in.setdefault(tgt, []).append(l)

        # Parse Report if available
        self._parse_report()

        self.last_mtime = current_mtime
        self.last_load_time = time.time() - t0
        return True

    def _parse_report(self):
        if not os.path.exists(self.report_md_path):
            return

        try:
            with open(self.report_md_path, "r", encoding="utf-8") as f:
                content = f.read()

            # God Nodes
            self.god_nodes_report.clear()
            god_match = re.search(r"## God Nodes.*?\n(.*?)(?=\n## |\Z)", content, re.DOTALL)
            if god_match:
                for line in god_match.group(1).strip().split("\n"):
                    line = line.strip()
                    m = re.match(r"\d+\.\s*`([^`]+)`\s*-\s*(\d+)\s*edges", line)
                    if m:
                        self.god_nodes_report.append({
                            "name": m.group(1),
                            "edges": int(m.group(2))
                        })

            # Import Cycles
            self.import_cycles_report.clear()
            cycle_match = re.search(r"## Import Cycles.*?\n(.*?)(?=\n## |\Z)", content, re.DOTALL)
            if cycle_match:
                for line in cycle_match.group(1).strip().split("\n"):
                    line = line.strip()
                    if line.startswith("- "):
                        self.import_cycles_report.append(line[2:].strip())

            # Summary numbers
            sum_match = re.search(r"## Summary\s*\n-\s*([^\n]+)", content)
            if sum_match:
                self.report_summary["summary_line"] = sum_match.group(1)

        except Exception as e:
            print(f"Error parsing GRAPH_REPORT.md: {e}")

    def get_stats(self) -> Dict[str, Any]:
        relations = {}
        for l in self.links:
            r = l.get("relation", "unknown")
            relations[r] = relations.get(r, 0) + 1

        file_types = {}
        for n in self.nodes:
            ft = n.get("file_type", "unknown")
            file_types[ft] = file_types.get(ft, 0) + 1

        communities = set()
        for n in self.nodes:
            c = n.get("community")
            if c is not None:
                communities.add(c)

        return {
            "total_nodes": len(self.nodes),
            "total_links": len(self.links),
            "communities_count": len(communities),
            "built_at_commit": self.built_at_commit,
            "relations": relations,
            "file_types": file_types,
            "categories_counts": {k: len(v) for k, v in self.categories.items()},
            "load_time_sec": round(self.last_load_time, 3),
            "last_mtime": self.last_mtime
        }

    def search_nodes(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        if not query:
            return []
        q = query.lower()
        results = []
        for n in self.nodes:
            lbl = n.get("label", "").lower()
            src = n.get("source_file", "").lower()
            if q in lbl or q in src:
                # Calculate simple relevance score
                score = 0
                if lbl == q:
                    score += 100
                elif lbl.startswith(q):
                    score += 50
                elif q in lbl:
                    score += 30
                if q in src:
                    score += 10

                in_count = len(self.adj_in.get(n["id"], []))
                out_count = len(self.adj_out.get(n["id"], []))

                results.append((score + in_count + out_count, n))

        results.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in results[:limit]]

    def get_node_details(self, node_id: str) -> Optional[Dict[str, Any]]:
        node = self.nodes_by_id.get(node_id)
        if not node:
            return None

        incoming = self.adj_in.get(node_id, [])
        outgoing = self.adj_out.get(node_id, [])

        inc_details = []
        for l in incoming:
            src_node = self.nodes_by_id.get(l.get("source"))
            inc_details.append({
                "source_id": l.get("source"),
                "label": src_node.get("label", "Unknown") if src_node else "Unknown",
                "source_file": src_node.get("source_file", "") if src_node else "",
                "relation": l.get("relation", "")
            })

        out_details = []
        for l in outgoing:
            tgt_node = self.nodes_by_id.get(l.get("target"))
            out_details.append({
                "target_id": l.get("target"),
                "label": tgt_node.get("label", "Unknown") if tgt_node else "Unknown",
                "source_file": tgt_node.get("source_file", "") if tgt_node else "",
                "relation": l.get("relation", "")
            })

        # Read source code snippet if available
        snippet = ""
        src_file = node.get("source_file")
        if src_file:
            abs_file = os.path.join(self.root_dir, src_file)
            if os.path.exists(abs_file) and os.path.isfile(abs_file):
                try:
                    loc = node.get("source_location", "L1")
                    line_no = 1
                    m = re.search(r"L(\d+)", loc)
                    if m:
                        line_no = int(m.group(1))

                    with open(abs_file, "r", encoding="utf-8", errors="ignore") as f:
                        all_lines = f.readlines()

                    start = max(0, line_no - 15)
                    end = min(len(all_lines), line_no + 25)
                    snippet_lines = []
                    for idx in range(start, end):
                        prefix = " > " if idx + 1 == line_no else "   "
                        snippet_lines.append(f"{idx + 1:4d}{prefix}{all_lines[idx].rstrip()}")
                    snippet = "\n".join(snippet_lines)
                except Exception as e:
                    snippet = f"Error reading code snippet: {e}"

        return {
            "node": node,
            "incoming": inc_details,
            "outgoing": out_details,
            "snippet": snippet
        }

    def get_ego_graph(self, center_id: str, depth: int = 1, max_nodes: int = 40) -> Dict[str, Any]:
        center = self.nodes_by_id.get(center_id)
        if not center:
            return {"nodes": [], "links": [], "center_id": None}

        visited_nodes: Set[str] = {center_id}
        frontier: Set[str] = {center_id}
        collected_links: List[Dict[str, Any]] = []

        for _ in range(depth):
            next_frontier = set()
            for nid in frontier:
                # Outgoing
                for link in self.adj_out.get(nid, []):
                    tgt = link.get("target")
                    if tgt in self.nodes_by_id:
                        collected_links.append(link)
                        if tgt not in visited_nodes and len(visited_nodes) < max_nodes:
                            visited_nodes.add(tgt)
                            next_frontier.add(tgt)

                # Incoming
                for link in self.adj_in.get(nid, []):
                    src = link.get("source")
                    if src in self.nodes_by_id:
                        collected_links.append(link)
                        if src not in visited_nodes and len(visited_nodes) < max_nodes:
                            visited_nodes.add(src)
                            next_frontier.add(src)

            frontier = next_frontier
            if not frontier or len(visited_nodes) >= max_nodes:
                break

        # Deduplicate links and only keep links between visited nodes
        final_links = []
        link_keys = set()
        for l in collected_links:
            src = l.get("source")
            tgt = l.get("target")
            if src in visited_nodes and tgt in visited_nodes:
                k = (src, tgt, l.get("relation"))
                if k not in link_keys:
                    link_keys.add(k)
                    final_links.append(l)

        final_nodes = [self.nodes_by_id[nid] for nid in visited_nodes]

        return {
            "center_id": center_id,
            "nodes": final_nodes,
            "links": final_links
        }

    def find_shortest_path(self, start_id: str, end_id: str) -> List[Tuple[Dict[str, Any], Optional[Dict[str, Any]]]]:
        """BFS shortest path from start_id to end_id. Returns list of (node, link_to_next)."""
        if start_id not in self.nodes_by_id or end_id not in self.nodes_by_id:
            return []
        if start_id == end_id:
            return [(self.nodes_by_id[start_id], None)]

        queue = [(start_id, [])]
        visited = {start_id}

        while queue:
            curr_id, path = queue.pop(0)
            if curr_id == end_id:
                full_path = []
                for nid, link in path:
                    full_path.append((self.nodes_by_id[nid], link))
                full_path.append((self.nodes_by_id[end_id], None))
                return full_path

            for link in self.adj_out.get(curr_id, []):
                nxt = link.get("target")
                if nxt and nxt not in visited and nxt in self.nodes_by_id:
                    visited.add(nxt)
                    queue.append((nxt, path + [(curr_id, link)]))

        return []
