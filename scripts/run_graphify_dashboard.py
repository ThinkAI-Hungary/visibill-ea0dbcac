"""
Launcher for Graphify Dashboard
Run this script to launch the Visibill Architecture Dashboard.
"""

import os
import sys

# Change working directory to project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.chdir(project_root)
sys.path.insert(0, os.path.join(project_root, "tools", "graphify_dashboard"))

from dashboard_app import DashboardApp

if __name__ == "__main__":
    app = DashboardApp(root_dir=project_root)
    app.mainloop()
