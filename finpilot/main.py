"""
finpilot/main.py
Entry point and application shell for FinPilot Desktop (Python 3.11+ / Tkinter / ttk / Matplotlib).
Features:
- Windows high-DPI awareness enabled safely inside try/except
- Fixed minimum window size (1100x700), centred on launch
- Left sidebar navigation with active indicator & hover states
- Top bar with view title, synchronized active month badge, Save JSON button, and Dark/Light theme toggle
- View manager that creates views once, lazy-loads Analytics, only refreshes the visible view,
  and marks hidden views dirty (Section 5 Rules 2, 7, 8)
- Graceful shutdown: saves JSON data, cancels all pending after() jobs, destroys root
"""

from __future__ import annotations

import ctypes
import tkinter as tk
from tkinter import ttk
from typing import Any

from animations import Animator
from seed import generate_demo_data
from store import DataStore
from theme import ThemeManager
from views.analytics import AnalyticsView
from views.budget import BudgetView
from views.dashboard import DashboardView
from views.transactions import TransactionsView
from widgets import PillButton, SidebarButton, ToastNotification


def enable_windows_dpi_awareness() -> None:
    """Enable per-monitor DPI awareness on Windows so fonts and Canvas look razor-sharp."""
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)  # type: ignore[attr-defined]
    except Exception:
        pass


class FinPilotApp:
    """
    Main application controller wiring DataStore, ThemeManager, Animator, and Views.
    """

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("FinPilot — Personal Finance Dashboard")
        self._center_window(1240, 780, min_w=1100, min_h=700)

        self.theme = ThemeManager(initial_mode="dark")
        self.theme.apply_ttk_styles(self.root)
        self.animator = Animator(self.root)
        self.store = DataStore(storage_path="finpilot_data.json")

        # Load persisted JSON if available, otherwise populate 6 months of demo data
        loaded, _msg = self.store.load_from_disk_sync()
        if not loaded:
            txs, budgets = generate_demo_data()
            self.store.load_seed_data(txs, budgets)

        self._active_view_key: str = "dashboard"
        self._active_month: str = self.store.get_latest_month()
        self._views: dict[str, Any] = {}
        self._nav_buttons: dict[str, SidebarButton] = {}

        self._build_shell()
        self.toast = ToastNotification(self.root, self.theme, self.animator)

        # Subscribe to DataStore events
        self.store.subscribe(self._on_store_change)

        # Global Keyboard Shortcuts
        self.root.bind("<Control-n>", self._on_ctrl_n)
        self.root.bind("<Control-N>", self._on_ctrl_n)
        self.root.bind("<Configure>", self._on_window_resize)
        self.root.protocol("WM_DELETE_WINDOW", self.shutdown)

        # Show initial view
        self.switch_view("dashboard")

    def _center_window(
        self, width: int, height: int, min_w: int = 1100, min_h: int = 700
    ) -> None:
        """Section 5 Rule 11: Fixed minimum size (1100x700) and centred on launch."""
        self.root.minsize(min_w, min_h)
        scr_w = self.root.winfo_screenwidth()
        scr_h = self.root.winfo_screenheight()
        x = max(0, (scr_w - width) // 2)
        y = max(0, (scr_h - height) // 2)
        self.root.geometry(f"{width}x{height}+{x}+{y}")

    def _build_shell(self) -> None:
        t = self.theme.tokens
        self.root.columnconfigure(1, weight=1)
        self.root.rowconfigure(1, weight=1)

        # ---- Left Sidebar (230px) ----
        self.sidebar = tk.Frame(
            self.root,
            bg=t["surface"],
            width=230,
            highlightbackground=t["border"],
            highlightthickness=1,
        )
        self.sidebar.grid(row=0, column=0, rowspan=2, sticky="ns")
        self.sidebar.grid_propagate(False)

        brand_frame = tk.Frame(self.sidebar, bg=t["surface"], pady=22, padx=20)
        brand_frame.pack(fill="x")
        self.brand_lbl = tk.Label(
            brand_frame,
            text="◆ FinPilot",
            bg=t["surface"],
            fg=t["text_primary"],
            font=self.theme.fonts["title"],
            anchor="w",
        )
        self.brand_lbl.pack(fill="x")
        self.brand_sub = tk.Label(
            brand_frame,
            text="Kinetic Finance Suite",
            bg=t["surface"],
            fg=t["text_muted"],
            font=self.theme.fonts["caption"],
            anchor="w",
        )
        self.brand_sub.pack(fill="x", pady=(2, 0))

        nav_items = [
            ("dashboard", "📊", "Dashboard"),
            ("transactions", "💳", "Transactions"),
            ("analytics", "📈", "Analytics"),
            ("budget", "🎯", "Budget Planner"),
        ]
        for key, icon, label in nav_items:
            btn = SidebarButton(
                self.sidebar,
                self.theme,
                icon=icon,
                label=label,
                command=lambda k=key: self.switch_view(k),
            )
            btn.pack(fill="x", pady=2)
            self._nav_buttons[key] = btn

        # Bottom Data Controls in Sidebar
        bottom_box = tk.Frame(self.sidebar, bg=t["surface"], padx=16, pady=16)
        bottom_box.pack(side="bottom", fill="x")

        self.demo_btn = PillButton(
            bottom_box,
            self.theme,
            text="Load Demo Data",
            command=self._load_demo_data,
            variant="secondary",
            width=196,
            height=32,
        )
        self.demo_btn.pack(pady=(0, 8))

        self.clear_btn = PillButton(
            bottom_box,
            self.theme,
            text="Clear All Data",
            command=self._clear_all_data,
            variant="danger",
            width=196,
            height=32,
        )
        self.clear_btn.pack()

        # ---- Top Bar ----
        self.topbar = tk.Frame(
            self.root,
            bg=t["background"],
            padx=24,
            pady=14,
        )
        self.topbar.grid(row=0, column=1, sticky="ew")

        self.page_title_lbl = tk.Label(
            self.topbar,
            text="Dashboard",
            bg=t["background"],
            fg=t["text_primary"],
            font=self.theme.fonts["title"],
        )
        self.page_title_lbl.pack(side="left")

        self.theme_btn = PillButton(
            self.topbar,
            self.theme,
            text="☀ Light Mode",
            command=self._toggle_theme,
            variant="secondary",
            width=125,
            height=32,
            parent_bg_key="background",
        )
        self.theme_btn.pack(side="right")

        self.save_btn = PillButton(
            self.topbar,
            self.theme,
            text="Save JSON",
            command=self._save_json_now,
            variant="secondary",
            width=105,
            height=32,
            parent_bg_key="background",
        )
        self.save_btn.pack(side="right", padx=(0, 10))

        self.month_badge = tk.Label(
            self.topbar,
            text=f"Active Month: {self._active_month}",
            bg=t["background"],
            fg=t["primary"],
            font=self.theme.fonts["body_bold"],
            padx=14,
        )
        self.month_badge.pack(side="right")

        # ---- Main Content Viewport (Views stacked & raised, never destroyed) ----
        self.viewport = ttk.Frame(self.root, style="App.TFrame", padding=(24, 4, 24, 20))
        self.viewport.grid(row=1, column=1, sticky="nsew")
        self.viewport.columnconfigure(0, weight=1)
        self.viewport.rowconfigure(0, weight=1)

        self._views["dashboard"] = DashboardView(
            self.viewport,
            self.store,
            self.theme,
            self.animator,
            on_navigate=self.switch_view,
            on_load_demo=self._load_demo_data,
            on_select_month=self._on_month_selected,
        )
        self._views["transactions"] = TransactionsView(
            self.viewport,
            self.store,
            self.theme,
            self.animator,
            toast=None,  # type: ignore[arg-type]
        )
        # AnalyticsView is created here, but its heavy Matplotlib figures are lazy-built
        # inside AnalyticsView.build() only when the tab is first opened (Rule 7).
        self._views["analytics"] = AnalyticsView(
            self.viewport,
            self.store,
            self.theme,
            self.animator,
            on_select_month=self._on_month_selected,
        )
        self._views["budget"] = BudgetView(
            self.viewport,
            self.store,
            self.theme,
            self.animator,
            toast=None,  # type: ignore[arg-type]
        )

        for view in self._views.values():
            view.grid(row=0, column=0, sticky="nsew")

    def _on_month_selected(self, month_key: str) -> None:
        """Synchronize selected month across Top Bar, Dashboard, and Analytics."""
        self._active_month = month_key
        self.month_badge.configure(text=f"Active Month: {self._active_month}")
        self._views["dashboard"].set_active_month(month_key)
        self._views["analytics"].set_selected_month(month_key)
        self.toast.show(f"Focused active month: {month_key}", level="info", duration_ms=2200)

    def switch_view(self, view_key: str) -> None:
        """
        Raise the requested view without destroying frames (Section 2 & Section 5 Rules 7, 8, 10).
        Cancels view-specific animations on hide and refreshes the incoming view if dirty.
        """
        if view_key not in self._views:
            return

        # Wire toast references once
        self._views["transactions"].toast = self.toast
        self._views["budget"].toast = self.toast

        self._active_view_key = view_key
        titles = {
            "dashboard": "Dashboard Overview",
            "transactions": "Transactions Ledger",
            "analytics": "Spending Analytics & Visual Lens",
            "budget": "Monthly Budget Planner",
        }
        self.page_title_lbl.configure(text=titles.get(view_key, "FinPilot"))

        for k, btn in self._nav_buttons.items():
            btn.set_active(k == view_key)

        target_view = self._views[view_key]
        if not target_view.is_built:
            target_view.build()
        if target_view.is_dirty:
            target_view.refresh(animate=True)

        target_view.tkraise()

    def _on_store_change(self, _event: str, _payload: dict[str, Any]) -> None:
        """
        Section 5 Rule 8: Mark all hidden views dirty; immediately refresh ONLY the visible view.
        Also trigger background async JSON save.
        """
        self._active_month = self.store.get_latest_month()
        self.month_badge.configure(text=f"Active Month: {self._active_month}")
        for key, view in self._views.items():
            if key == self._active_view_key:
                view.refresh(animate=True)
            else:
                view.is_dirty = True

        self.store.save_to_disk_async()

    def _on_ctrl_n(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        self.switch_view("transactions")
        self._views["transactions"].focus_amount_field()

    def _on_window_resize(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        """Section 5 Rule 5: Debounce root window <Configure> resize events by 100 ms."""
        if event.widget is self.root:
            self.animator.debounce("window_resize", 100, lambda: None)

    def _toggle_theme(self) -> None:
        mode = self.theme.toggle_mode(self.root)
        t = self.theme.tokens
        self.sidebar.configure(bg=t["surface"], highlightbackground=t["border"])
        self.brand_lbl.configure(bg=t["surface"], fg=t["text_primary"])
        self.brand_sub.configure(bg=t["surface"], fg=t["text_muted"])
        self.topbar.configure(bg=t["background"])
        self.page_title_lbl.configure(bg=t["background"], fg=t["text_primary"])
        self.month_badge.configure(bg=t["background"], fg=t["primary"])
        self.theme_btn.set_text("🌙 Dark Mode" if mode == "light" else "☀ Light Mode")
        self.theme_btn.apply_theme()
        self.save_btn.apply_theme()
        self.demo_btn.apply_theme()
        self.clear_btn.apply_theme()
        for btn in self._nav_buttons.values():
            btn.apply_theme()
        for view in self._views.values():
            if view.is_built:
                view.apply_theme()

    def _load_demo_data(self) -> None:
        txs, budgets = generate_demo_data()
        self.store.load_seed_data(txs, budgets)
        self.toast.show(
            f"Loaded {len(txs)} realistic demo transactions across 6 months.",
            level="success",
        )

    def _clear_all_data(self) -> None:
        self.store.clear_all_data()
        self.toast.show("Cleared all transactions and budgets.", level="warning")

    def _save_json_now(self) -> None:
        def _done(ok: bool, msg: str) -> None:
            self.root.after(
                0,
                lambda: self.toast.show(
                    msg, level="success" if ok else "danger", duration_ms=3500
                ),
            )

        self.store.save_to_disk_async(on_complete=_done)

    def shutdown(self) -> None:
        """Section 8: Graceful shutdown — save JSON, cancel all after() jobs, destroy root."""
        self.animator.cancel_all()
        self.store.save_to_disk_sync()
        self.root.destroy()


def main() -> None:
    enable_windows_dpi_awareness()
    root = tk.Tk()
    FinPilotApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
