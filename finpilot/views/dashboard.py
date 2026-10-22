"""
finpilot/views/dashboard.py
Screen A: Interactive Spatial Dashboard View
- Scope Control Bar with SegmentedPillToggle ("All-Time Vault (6 Mo)" vs "Active Month Focus")
- Primary Tactile Hero Card: VaultSimulatorCard with live draggable Savings Rate Simulator slider
- 3 Kinetic StatCards (Total Income, Total Expenses, Savings Rate % with animated radial progress ring)
- Interactive 6-Month Cashflow Horizon (Catmull-Rom dual splines + paired bars + hover HUD + click-to-time-travel)
- Recent Transactions Stream (last 6) with instant sliding pill filter (All / Expense / Income)
- Budget Health Strip: top 3 categories closest to their limits with animated progress bars
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk
from typing import Any, Callable

from animations import Animator
from models import CATEGORY_ICONS, TransactionType, format_indian_currency
from store import DataStore
from theme import ThemeManager
from widgets import (
    AnimatedProgressBar,
    InteractiveCashflowHorizon,
    PillButton,
    RoundedCard,
    SegmentedPillToggle,
    StatCard,
    VaultSimulatorCard,
)


class DashboardView(ttk.Frame):
    """
    Main interactive dashboard. Built once in `build()`, updated in-place in `refresh()`.
    """

    def __init__(
        self,
        parent: tk.Misc,
        store: DataStore,
        theme: ThemeManager,
        animator: Animator,
        on_navigate: Callable[[str], None],
        on_load_demo: Callable[[], None],
        on_select_month: Callable[[str], None] | None = None,
    ) -> None:
        super().__init__(parent, style="App.TFrame")
        self.store = store
        self.theme = theme
        self.animator = animator
        self.on_navigate = on_navigate
        self.on_load_demo = on_load_demo
        self.on_select_month = on_select_month
        self.is_built = False
        self.is_dirty = True

        self._scope_mode: str = "ALL"  # "ALL" or "MONTH"
        self._recent_filter: str = "ALL"  # "ALL", "EXPENSE", "INCOME"
        self._active_month: str = ""

        self._stat_cards: dict[str, StatCard] = {}
        self._recent_rows: list[dict[str, tk.Label | tk.Frame]] = []
        self._budget_rows: list[dict[str, tk.Label | AnimatedProgressBar | tk.Frame]] = []
        self._cards: list[RoundedCard] = []

    def set_active_month(self, month: str) -> None:
        """Switch active month from Cashflow Horizon click or top bar."""
        self._active_month = month
        if self.is_built:
            self.refresh(animate=True)

    def build(self) -> None:
        """Construct all dashboard widgets once (Section 5 Rule 2)."""
        if self.is_built:
            return
        self.is_built = True
        t = self.theme.tokens

        self.columnconfigure(0, weight=3)
        self.columnconfigure(1, weight=2)
        self.rowconfigure(2, weight=1)
        self.rowconfigure(3, weight=1)

        # ---- Row 0: Interactive Scope Control Strip ----
        scope_bar = tk.Frame(self, bg=t["background"])
        scope_bar.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 10))
        self._scope_bar = scope_bar

        self._scope_toggle = SegmentedPillToggle(
            scope_bar,
            self.theme,
            self.animator,
            toggle_id="dash_scope",
            options=[
                ("ALL", "All-Time Vault (6 Mo)"),
                ("MONTH", "Active Month Focus"),
            ],
            on_change=self._on_scope_change,
            width=310,
            height=30,
            active_color_key="primary",
            parent_bg_key="background",
        )
        self._scope_toggle.pack(side="left")

        self._comp_label = tk.Label(
            scope_bar,
            text="",
            bg=t["background"],
            fg=t["text_muted"],
            font=self.theme.fonts["caption_bold"],
        )
        self._comp_label.pack(side="right")

        # ---- Row 1: Vault Simulator Hero Card + 3 Kinetic Stat Cards ----
        kpi_frame = ttk.Frame(self, style="App.TFrame")
        kpi_frame.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 14))
        kpi_frame.columnconfigure(0, weight=14, uniform="kpi")
        kpi_frame.columnconfigure(1, weight=10, uniform="kpi")
        kpi_frame.columnconfigure(2, weight=10, uniform="kpi")
        kpi_frame.columnconfigure(3, weight=10, uniform="kpi")

        self._vault_card = VaultSimulatorCard(kpi_frame, self.theme, self.animator)
        self._vault_card.grid(row=0, column=0, sticky="ew", padx=(0, 12))

        specs = [
            ("income", "TOTAL INCOME", "success", False),
            ("expense", "TOTAL EXPENSES", "danger", False),
            ("savings", "SAVINGS RATE", "primary", True),
        ]
        for idx, (cid, title, accent, radial) in enumerate(specs, start=1):
            card = StatCard(
                kpi_frame,
                self.theme,
                self.animator,
                cid,
                title,
                accent,
                show_radial=radial,
            )
            pad_r = 12 if idx < 3 else 0
            card.grid(row=0, column=idx, sticky="ew", padx=(0, pad_r))
            self._stat_cards[cid] = card

        # ---- Row 2 Col 0: Interactive 6-Month Cashflow Horizon (Spline + Bars + HUD) ----
        chart_card = RoundedCard(
            self, self.theme, animator=self.animator, card_key="dash_horizon", height=255
        )
        chart_card.grid(row=2, column=0, sticky="nsew", padx=(0, 14), pady=(0, 14))
        self._cards.append(chart_card)

        header_row = tk.Frame(chart_card.body, bg=t["surface"])
        header_row.pack(fill="x", pady=(0, 6))
        self._chart_title = tk.Label(
            header_row,
            text="6-Month Cashflow Horizon (Hover to Inspect · Click Month to Focus)",
            bg=t["surface"],
            fg=t["text_primary"],
            font=self.theme.fonts["body_bold"],
        )
        self._chart_title.pack(side="left")

        self._horizon_hud = tk.Label(
            header_row,
            text="",
            bg=t["surface_raised"],
            fg=t["text_primary"],
            font=self.theme.fonts["caption_bold"],
            padx=10,
            pady=3,
        )
        self._horizon_hud.pack(side="right")

        self._horizon_chart = InteractiveCashflowHorizon(
            chart_card.body,
            self.theme,
            self.animator,
            on_inspect_month=self._on_inspect_horizon_month,
            on_select_month=self._on_click_horizon_month,
            height=190,
        )
        self._horizon_chart.pack(fill="both", expand=True)

        # ---- Row 2 Col 1: Budget Health Strip (Top 3 closest to limit) ----
        budget_card = RoundedCard(
            self, self.theme, animator=self.animator, card_key="dash_budget", height=255
        )
        budget_card.grid(row=2, column=1, sticky="nsew", pady=(0, 14))
        self._cards.append(budget_card)

        b_hdr = tk.Frame(budget_card.body, bg=t["surface"])
        b_hdr.pack(fill="x", pady=(0, 8))
        self._b_title = tk.Label(
            b_hdr,
            text="Budget Health — Top 3 Caps",
            bg=t["surface"],
            fg=t["text_primary"],
            font=self.theme.fonts["body_bold"],
        )
        self._b_title.pack(side="left")

        self._b_manage_btn = PillButton(
            b_hdr,
            self.theme,
            text="Configure →",
            command=lambda: self.on_navigate("budget"),
            variant="secondary",
            width=96,
            height=26,
        )
        self._b_manage_btn.pack(side="right")

        for i in range(3):
            row_f = tk.Frame(budget_card.body, bg=t["surface"])
            row_f.pack(fill="x", pady=5)
            top_line = tk.Frame(row_f, bg=t["surface"])
            top_line.pack(fill="x")
            cat_lbl = tk.Label(
                top_line,
                text="",
                bg=t["surface"],
                fg=t["text_primary"],
                font=self.theme.fonts["body_bold"],
            )
            cat_lbl.pack(side="left")
            meta_lbl = tk.Label(
                top_line,
                text="",
                bg=t["surface"],
                fg=t["text_muted"],
                font=self.theme.fonts["caption"],
            )
            meta_lbl.pack(side="right")
            pbar = AnimatedProgressBar(
                row_f,
                self.theme,
                self.animator,
                bar_id=f"dash_b_{i}",
                height=8,
            )
            pbar.pack(fill="x", pady=(4, 0))
            self._budget_rows.append(
                {"frame": row_f, "cat": cat_lbl, "meta": meta_lbl, "bar": pbar}
            )

        self._budget_empty_lbl = tk.Label(
            budget_card.body,
            text="No budgets set. Open Budget Planner to configure monthly caps.",
            bg=t["surface"],
            fg=t["text_muted"],
            font=self.theme.fonts["body"],
            wraplength=280,
            justify="left",
        )

        # ---- Row 3 Col 0..1: Recent Transactions (Last 6) + Sliding Stream Filter ----
        recent_card = RoundedCard(
            self, self.theme, animator=self.animator, card_key="dash_recent", height=230
        )
        recent_card.grid(row=3, column=0, columnspan=2, sticky="nsew")
        self._cards.append(recent_card)

        r_hdr = tk.Frame(recent_card.body, bg=t["surface"])
        r_hdr.pack(fill="x", pady=(0, 8))
        self._r_title = tk.Label(
            r_hdr,
            text="Recent Transactions Stream",
            bg=t["surface"],
            fg=t["text_primary"],
            font=self.theme.fonts["body_bold"],
        )
        self._r_title.pack(side="left")

        self._view_all_btn = PillButton(
            r_hdr,
            self.theme,
            text="Full Ledger →",
            command=lambda: self.on_navigate("transactions"),
            variant="secondary",
            width=112,
            height=28,
        )
        self._view_all_btn.pack(side="right", padx=(10, 0))

        self._stream_toggle = SegmentedPillToggle(
            r_hdr,
            self.theme,
            self.animator,
            toggle_id="dash_stream_filter",
            options=[
                ("ALL", "All"),
                ("EXPENSE", "Expenses"),
                ("INCOME", "Income"),
            ],
            on_change=self._on_recent_filter_change,
            width=225,
            height=28,
            active_color_key="primary",
            parent_bg_key="surface",
        )
        self._stream_toggle.pack(side="right")

        self._recent_list_frame = tk.Frame(recent_card.body, bg=t["surface"])
        self._recent_list_frame.pack(fill="both", expand=True)

        for _ in range(6):
            rf = tk.Frame(self._recent_list_frame, bg=t["surface"], pady=3)
            icon_lbl = tk.Label(
                rf,
                text="📌",
                bg=t["surface"],
                fg=t["text_primary"],
                font=self.theme.fonts["body"],
                width=3,
            )
            icon_lbl.pack(side="left")
            title_lbl = tk.Label(
                rf,
                text="",
                bg=t["surface"],
                fg=t["text_primary"],
                font=self.theme.fonts["body_bold"],
                anchor="w",
            )
            title_lbl.pack(side="left", padx=(4, 12))
            note_lbl = tk.Label(
                rf,
                text="",
                bg=t["surface"],
                fg=t["text_muted"],
                font=self.theme.fonts["caption"],
                anchor="w",
            )
            note_lbl.pack(side="left", fill="x", expand=True)
            date_lbl = tk.Label(
                rf,
                text="",
                bg=t["surface"],
                fg=t["text_muted"],
                font=self.theme.fonts["caption"],
                padx=12,
            )
            date_lbl.pack(side="right")
            amt_lbl = tk.Label(
                rf,
                text="",
                bg=t["surface"],
                fg=t["success"],
                font=self.theme.fonts["body_bold"],
                width=14,
                anchor="e",
            )
            amt_lbl.pack(side="right")
            self._recent_rows.append(
                {
                    "frame": rf,
                    "icon": icon_lbl,
                    "title": title_lbl,
                    "note": note_lbl,
                    "date": date_lbl,
                    "amount": amt_lbl,
                }
            )

        # Empty-state frame with CTA
        self._empty_frame = tk.Frame(recent_card.body, bg=t["surface"])
        self._empty_lbl = tk.Label(
            self._empty_frame,
            text="No transactions recorded yet. Add your first entry or load 6 months of demo data.",
            bg=t["surface"],
            fg=t["text_muted"],
            font=self.theme.fonts["body"],
        )
        self._empty_lbl.pack(pady=(12, 8))
        self._empty_cta = PillButton(
            self._empty_frame,
            self.theme,
            text="Load Demo Data",
            command=self.on_load_demo,
            variant="primary",
            width=150,
            height=34,
        )
        self._empty_cta.pack()

    def _on_scope_change(self, mode: str) -> None:
        self._scope_mode = mode
        self.refresh(animate=True)

    def _on_recent_filter_change(self, filter_key: str) -> None:
        self._recent_filter = filter_key
        self._refresh_recent_rows()

    def _on_inspect_horizon_month(self, item: dict[str, Any]) -> None:
        sym = self.store.currency_symbol
        inc = format_indian_currency(item["income_paise"], sym)
        exp = format_indian_currency(item["expense_paise"], sym)
        net = format_indian_currency(
            item["income_paise"] - item["expense_paise"], sym, signed=True
        )
        self._horizon_hud.configure(
            text=f"{item['label']}  ·  In: {inc}  ·  Out: {exp}  ·  Net: {net}"
        )

    def _on_click_horizon_month(self, month_key: str) -> None:
        self._active_month = month_key
        self._scope_mode = "MONTH"
        self._scope_toggle.set_selected("MONTH", notify=False, animate=True)
        if self.on_select_month:
            self.on_select_month(month_key)
        self.refresh(animate=True)

    def _refresh_recent_rows(self) -> None:
        t = self.theme.tokens
        sym = self.store.currency_symbol
        recent_txs = self.store.get_transactions(tx_type=self._recent_filter)[:6]
        if not recent_txs:
            self._recent_list_frame.pack_forget()
            self._empty_frame.pack(fill="both", expand=True)
        else:
            self._empty_frame.pack_forget()
            self._recent_list_frame.pack(fill="both", expand=True)
            for idx, r_item in enumerate(self._recent_rows):
                if idx < len(recent_txs):
                    tx = recent_txs[idx]
                    r_item["frame"].pack(fill="x")  # type: ignore[union-attr]
                    r_item["icon"].configure(text=CATEGORY_ICONS.get(tx.category, "📌"))  # type: ignore[union-attr]
                    r_item["title"].configure(text=tx.category)  # type: ignore[union-attr]
                    r_item["note"].configure(text=tx.note or "—")  # type: ignore[union-attr]
                    r_item["date"].configure(text=tx.date)  # type: ignore[union-attr]
                    is_inc = tx.type == TransactionType.INCOME
                    sign_paise = tx.amount_paise if is_inc else -tx.amount_paise
                    r_item["amount"].configure(  # type: ignore[union-attr]
                        text=format_indian_currency(sign_paise, sym, signed=True),
                        fg=t["success"] if is_inc else t["danger"],
                    )
                else:
                    r_item["frame"].pack_forget()  # type: ignore[union-attr]

    def refresh(self, animate: bool = True) -> None:
        """Update existing widgets in-place with latest DataStore aggregations."""
        if not self.is_built:
            self.build()
        self.is_dirty = False
        t = self.theme.tokens
        sym = self.store.currency_symbol

        months = self.store.get_available_months()
        if not self._active_month or self._active_month not in months:
            self._active_month = self.store.get_latest_month()

        scope_arg = "ALL" if self._scope_mode == "ALL" else self._active_month
        metrics = self.store.get_summary_metrics(scope_arg)
        comp = self.store.get_monthly_comparison(self._active_month)

        scope_title = (
            "TOTAL NET BALANCE"
            if self._scope_mode == "ALL"
            else f"{self._active_month} NET SURPLUS"
        )
        monthly_inc_for_sim = (
            comp.current_income_paise
            if comp.current_income_paise > 0
            else int(metrics["income_paise"] // 6)
        )
        tx_count = len(self.store.get_transactions(month=scope_arg))

        self._vault_card.update_vault(
            balance_paise=int(metrics["balance_paise"]),
            monthly_income_paise=monthly_inc_for_sim,
            actual_savings_rate=float(metrics["savings_rate"]),
            record_count=tx_count,
            currency_symbol=sym,
            scope_title=scope_title,
            animate=animate,
        )

        self._stat_cards["income"].set_value(
            float(metrics["income_paise"]),
            lambda v: format_indian_currency(int(round(v)), sym),
            subtitle=f"Active mo ({comp.current_month}): {format_indian_currency(comp.current_income_paise, sym)}",
            badge_text="INFLOW",
            badge_color_key="success",
            animate=animate,
        )

        exp_badge = "OUTFLOW"
        exp_badge_col = "danger"
        if comp.expense_change_pct is not None:
            arrow = "▲" if comp.expense_change_pct > 0 else "▼"
            exp_badge = f"{arrow} {abs(comp.expense_change_pct):.1f}% MoM"
            exp_badge_col = "danger" if comp.expense_change_pct > 0 else "success"

        self._stat_cards["expense"].set_value(
            float(metrics["expense_paise"]),
            lambda v: format_indian_currency(int(round(v)), sym),
            subtitle=f"Prev mo ({comp.previous_month}): {format_indian_currency(comp.previous_expense_paise, sym)}",
            badge_text=exp_badge,
            badge_color_key=exp_badge_col,
            animate=animate,
        )

        sav_rate = float(metrics["savings_rate"])
        sav_badge = "EXCELLENT" if sav_rate >= 30 else ("HEALTHY" if sav_rate >= 15 else "LOW")
        self._stat_cards["savings"].set_value(
            sav_rate,
            lambda v: f"{v:.1f}%",
            subtitle="Retained capital ratio",
            badge_text=sav_badge,
            badge_color_key="success" if sav_rate >= 20 else "warning",
            animate=animate,
        )

        # Monthly spending summary delta strip
        if comp.expense_change_pct is None:
            self._comp_label.configure(
                text=f"Active Month ({comp.current_month}): {format_indian_currency(comp.current_expense_paise, sym)}",
                fg=t["text_muted"],
            )
        else:
            arrow = "▲" if comp.expense_change_pct >= 0 else "▼"
            col = t["danger"] if comp.expense_change_pct > 0 else t["success"]
            self._comp_label.configure(
                text=(
                    f"MoM Spend Delta ({comp.current_month} vs {comp.previous_month}): "
                    f"{arrow} {abs(comp.expense_change_pct):.1f}%"
                ),
                fg=col,
            )

        # Interactive 6-Month Cashflow Horizon
        series = self.store.get_last_n_months_series(6)
        self._horizon_chart.set_series(
            series, active_month=self._active_month, animate=animate
        )

        # Budget health strip (Top 3 closest to limit)
        statuses = self.store.get_budget_statuses(comp.current_month)[:3]
        if not statuses:
            for item in self._budget_rows:
                item["frame"].pack_forget()  # type: ignore[union-attr]
            self._budget_empty_lbl.pack(fill="x", pady=16)
        else:
            self._budget_empty_lbl.pack_forget()
            for idx, item in enumerate(self._budget_rows):
                if idx < len(statuses):
                    st = statuses[idx]
                    item["frame"].pack(fill="x", pady=5)  # type: ignore[union-attr]
                    item["cat"].configure(text=f"{CATEGORY_ICONS.get(st.category, '📌')} {st.category}")  # type: ignore[union-attr]
                    item["meta"].configure(  # type: ignore[union-attr]
                        text=(
                            f"{format_indian_currency(st.spent_paise, sym)} / "
                            f"{format_indian_currency(st.limit_paise, sym)} ({st.percent_used:.0f}%)"
                        )
                    )
                    item["bar"].set_progress(st.percent_used, st.level, animate=animate)  # type: ignore[union-attr]
                else:
                    item["frame"].pack_forget()  # type: ignore[union-attr]

        self._refresh_recent_rows()

    def apply_theme(self) -> None:
        """Re-theme all child widgets without rebuilding."""
        if not self.is_built:
            return
        t = self.theme.tokens
        self._scope_bar.configure(bg=t["background"])
        self._scope_toggle.apply_theme()
        self._comp_label.configure(bg=t["background"])
        self._vault_card.apply_theme()
        for card in self._stat_cards.values():
            card.apply_theme()
        for rcard in self._cards:
            rcard.apply_theme()
        self._horizon_chart.apply_theme()
        self._horizon_hud.configure(bg=t["surface_raised"], fg=t["text_primary"])
        self._b_manage_btn.apply_theme()
        self._view_all_btn.apply_theme()
        self._stream_toggle.apply_theme()
        self._empty_cta.apply_theme()
        self._chart_title.configure(bg=t["surface"], fg=t["text_primary"])
        self._b_title.configure(bg=t["surface"], fg=t["text_primary"])
        self._r_title.configure(bg=t["surface"], fg=t["text_primary"])
        self._budget_empty_lbl.configure(bg=t["surface"], fg=t["text_muted"])
        self._recent_list_frame.configure(bg=t["surface"])
        self._empty_frame.configure(bg=t["surface"])
        self._empty_lbl.configure(bg=t["surface"], fg=t["text_muted"])
        for b_item in self._budget_rows:
            b_item["frame"].configure(bg=t["surface"])  # type: ignore[union-attr]
            b_item["cat"].configure(bg=t["surface"], fg=t["text_primary"])  # type: ignore[union-attr]
            b_item["meta"].configure(bg=t["surface"], fg=t["text_muted"])  # type: ignore[union-attr]
            b_item["bar"].apply_theme()  # type: ignore[union-attr]
        for r_item in self._recent_rows:
            r_item["frame"].configure(bg=t["surface"])  # type: ignore[union-attr]
            r_item["icon"].configure(bg=t["surface"], fg=t["text_primary"])  # type: ignore[union-attr]
            r_item["title"].configure(bg=t["surface"], fg=t["text_primary"])  # type: ignore[union-attr]
            r_item["note"].configure(bg=t["surface"], fg=t["text_muted"])  # type: ignore[union-attr]
            r_item["date"].configure(bg=t["surface"], fg=t["text_muted"])  # type: ignore[union-attr]
            r_item["amount"].configure(bg=t["surface"])  # type: ignore[union-attr]
        self.refresh(animate=False)
