"""
finpilot/charts.py
Interactive Matplotlib chart managers built strictly with Figure + FigureCanvasTkAgg (ZERO pyplot).
Every Figure and Axes is instantiated once; data updates clear/redraw the existing Axes
and call canvas.draw_idle() (Section 6 Rules).
Interactive Event Features:
- CategoryDonutChart: Hovering or clicking any slice expands that wedge (`set_radius(1.08)`)
  and updates the centre lens (`Category · Amount · % share`) in real time via `mpl_connect`.
- GroupedBarChart: Clicking any month bar pair triggers `on_select_month(month_key)`.
- CumulativeSpendLineChart: Scrubbing cursor across the Axes snaps a magnetic vertical
  crosshair + glowing marker to the nearest day and fires `on_hover_day(day_info)`.
"""

from __future__ import annotations

import time
import tkinter as tk
from typing import Any, Callable

from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.patches import Wedge

from animations import Animator
from models import format_indian_currency
from theme import CHART_PALETTE, ThemeManager


class BaseChartCard:
    """
    Base wrapper around matplotlib.figure.Figure + FigureCanvasTkAgg.
    Tracks render frame time and disables entry animations automatically on slow hardware.
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        chart_id: str,
        figsize: tuple[float, float] = (5.0, 2.8),
    ) -> None:
        self.parent = parent
        self.theme = theme
        self.animator = animator
        self.chart_id = chart_id
        self.animations_enabled: bool = True

        t = theme.tokens
        self.figure = Figure(figsize=figsize, dpi=100, facecolor=t["surface"])
        self.ax = self.figure.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.figure, master=parent)
        self.widget = self.canvas.get_tk_widget()
        self.widget.configure(
            bg=t["surface"], highlightthickness=0, bd=0, cursor="hand2"
        )

    def _style_axes(self, show_grid: bool = True) -> None:
        t = self.theme.tokens
        self.figure.patch.set_facecolor(t["surface"])
        self.ax.set_facecolor(t["surface"])
        for spine in self.ax.spines.values():
            spine.set_visible(False)
        self.ax.tick_params(
            colors=t["text_muted"],
            labelsize=8,
            length=0,
        )
        if show_grid:
            self.ax.grid(
                axis="y",
                color=t["border_subtle"],
                linestyle="--",
                linewidth=0.6,
                alpha=0.45,
            )
            self.ax.set_axisbelow(True)
        else:
            self.ax.grid(False)

    def _measured_draw(self) -> None:
        """Call draw_idle() and measure elapsed time to enforce the 33 ms budget."""
        t0 = time.perf_counter()
        self.canvas.draw_idle()
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        if elapsed_ms > 33.0:
            self.animations_enabled = False


class GroupedBarChart(BaseChartCard):
    """
    Income vs Expenses grouped bar chart with interactive click-to-select month support.
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        chart_id: str,
        figsize: tuple[float, float] = (5.0, 2.8),
        on_select_month: Callable[[str], None] | None = None,
    ) -> None:
        super().__init__(parent, theme, animator, chart_id, figsize)
        self.on_select_month = on_select_month
        self._series: list[dict[str, Any]] = []
        self.canvas.mpl_connect("button_press_event", self._on_click)

    def _on_click(self, event: Any) -> None:
        if (
            self.on_select_month is None
            or event.inaxes != self.ax
            or event.xdata is None
            or not self._series
        ):
            return
        idx = int(round(event.xdata))
        if 0 <= idx < len(self._series):
            self.on_select_month(self._series[idx]["month"])

    def update_chart(
        self,
        series: list[dict[str, Any]],
        currency_symbol: str = "Rs. ",
        animate: bool = True,
    ) -> None:
        self._series = list(series)
        t = self.theme.tokens
        labels = [item["label"] for item in series]
        incomes = [item["income_paise"] / 100.0 for item in series]
        expenses = [item["expense_paise"] / 100.0 for item in series]

        if not any(incomes) and not any(expenses):
            self.ax.clear()
            self._style_axes(show_grid=False)
            self.ax.text(
                0.5,
                0.5,
                "No monthly data available",
                ha="center",
                va="center",
                color=t["text_muted"],
                fontsize=10,
                transform=self.ax.transAxes,
            )
            self._measured_draw()
            return

        def _render_frame(progress: float) -> None:
            self.ax.clear()
            self._style_axes(show_grid=True)
            x = list(range(len(labels)))
            width = 0.34
            inc_vals = [v * progress for v in incomes]
            exp_vals = [v * progress for v in expenses]

            self.ax.bar(
                [i - width / 2 for i in x],
                inc_vals,
                width=width,
                color=t["success"],
                label="Income",
                zorder=3,
            )
            self.ax.bar(
                [i + width / 2 for i in x],
                exp_vals,
                width=width,
                color=t["danger"],
                label="Expenses",
                zorder=3,
            )
            self.ax.set_xticks(x)
            self.ax.set_xticklabels(labels)
            max_y = max(max(incomes, default=1.0), max(expenses, default=1.0), 1.0)
            self.ax.set_ylim(0, max_y * 1.18)
            self.ax.legend(
                frameon=False,
                loc="upper right",
                fontsize=8,
                labelcolor=t["text_secondary"],
            )
            self.figure.tight_layout(pad=1.0)
            self._measured_draw()

        if animate and self.animations_enabled:
            self.animator.animate_value(
                key=f"chart_{self.chart_id}",
                start_val=0.15,
                end_val=1.0,
                duration_ms=260,
                on_update=_render_frame,
            )
        else:
            _render_frame(1.0)


class CategoryDonutChart(BaseChartCard):
    """
    Interactive Expenses-by-Category Donut Chart:
    - Hovering or clicking any wedge expands its outer radius (`1.08` vs `1.0`)
      and updates the Centre Lens text to show that category's name, spend, and % share!
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        chart_id: str,
        figsize: tuple[float, float] = (4.6, 2.2),
    ) -> None:
        super().__init__(parent, theme, animator, chart_id, figsize)
        self._wedges: list[Wedge] = []
        self._items: list[dict[str, Any]] = []
        self._total_paise: int = 0
        self._currency_symbol: str = "Rs. "
        self._focused_idx: int | None = None
        self._center_title_text: Any = None
        self._center_val_text: Any = None
        self._center_pct_text: Any = None

        self.canvas.mpl_connect("motion_notify_event", self._on_motion)
        self.canvas.mpl_connect("button_press_event", self._on_click)

    def _hit_wedge_index(self, event: Any) -> int | None:
        if event.inaxes != self.ax:
            return None
        for idx, wedge in enumerate(self._wedges):
            contains, _ = wedge.contains(event)
            if contains:
                return idx
        return None

    def _on_motion(self, event: Any) -> None:
        hit = self._hit_wedge_index(event)
        if hit != self._focused_idx:
            self._focused_idx = hit
            self._apply_focus_lens()

    def _on_click(self, event: Any) -> None:
        hit = self._hit_wedge_index(event)
        self._focused_idx = None if hit == self._focused_idx else hit
        self._apply_focus_lens()

    def reset_lens(self) -> None:
        self._focused_idx = None
        self._apply_focus_lens()

    def _apply_focus_lens(self) -> None:
        if not self._wedges or self._center_title_text is None:
            return

        for idx, w in enumerate(self._wedges):
            is_foc = idx == self._focused_idx
            w.set_radius(1.08 if is_foc else 1.0)
            w.set_alpha(
                1.0
                if (self._focused_idx is None or is_foc)
                else 0.42
            )

        if self._focused_idx is not None and 0 <= self._focused_idx < len(self._items):
            item = self._items[self._focused_idx]
            pct = (
                (item["amount_paise"] / self._total_paise) * 100.0
                if self._total_paise > 0
                else 0.0
            )
            self._center_title_text.set_text(item["category"])
            self._center_val_text.set_text(
                format_indian_currency(item["amount_paise"], self._currency_symbol)
            )
            self._center_pct_text.set_text(f"{pct:.1f}% share")
        else:
            self._center_title_text.set_text("Total Spent")
            self._center_val_text.set_text(
                format_indian_currency(self._total_paise, self._currency_symbol)
            )
            self._center_pct_text.set_text("Hover slice to inspect")

        self._measured_draw()

    def update_chart(
        self,
        breakdown: list[dict[str, Any]],
        currency_symbol: str = "Rs. ",
        animate: bool = True,
    ) -> None:
        t = self.theme.tokens
        self._currency_symbol = currency_symbol
        self._focused_idx = None

        if not breakdown:
            self._wedges.clear()
            self._items.clear()
            self.ax.clear()
            self._style_axes(show_grid=False)
            self.ax.text(
                0.5,
                0.5,
                "No expenses in selected month",
                ha="center",
                va="center",
                color=t["text_muted"],
                fontsize=10,
                transform=self.ax.transAxes,
            )
            self._measured_draw()
            return

        top_items = [dict(x) for x in breakdown[:6]]
        if len(breakdown) > 6:
            other_paise = sum(item["amount_paise"] for item in breakdown[6:])
            top_items.append({"category": "Other+", "amount_paise": other_paise})

        self._items = top_items
        labels = [item["category"] for item in top_items]
        values = [item["amount_paise"] for item in top_items]
        self._total_paise = sum(values)
        colors = [
            CHART_PALETTE[i % len(CHART_PALETTE)] for i in range(len(top_items))
        ]

        self.ax.clear()
        self._style_axes(show_grid=False)
        wedges, _ = self.ax.pie(
            values,
            labels=None,
            colors=colors,
            startangle=90,
            counterclock=False,
            wedgeprops={"width": 0.38, "edgecolor": t["surface"], "linewidth": 2},
        )
        self._wedges = list(wedges)

        self._center_title_text = self.ax.text(
            0,
            0.16,
            "Total Spent",
            ha="center",
            va="center",
            fontsize=8,
            color=t["text_muted"],
        )
        self._center_val_text = self.ax.text(
            0,
            -0.04,
            format_indian_currency(self._total_paise, currency_symbol),
            ha="center",
            va="center",
            fontsize=10,
            fontweight="bold",
            color=t["text_primary"],
        )
        self._center_pct_text = self.ax.text(
            0,
            -0.24,
            "Hover slice to inspect",
            ha="center",
            va="center",
            fontsize=7,
            color=t["primary"],
        )
        self.ax.legend(
            wedges,
            labels,
            loc="center left",
            bbox_to_anchor=(0.92, 0.5),
            frameon=False,
            fontsize=8,
            labelcolor=t["text_secondary"],
        )
        self.figure.tight_layout(pad=0.8)
        self._measured_draw()


class CumulativeSpendLineChart(BaseChartCard):
    """
    Daily cumulative spending trend line with a magnetic hover crosshair scrubber.
    Moving the pointer across the chart snaps a vertical line + glowing marker to the
    nearest day and invokes `on_hover_day(day_dict)`.
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        chart_id: str,
        figsize: tuple[float, float] = (9.2, 1.9),
        on_hover_day: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        super().__init__(parent, theme, animator, chart_id, figsize)
        self.on_hover_day = on_hover_day
        self._daily_series: list[dict[str, Any]] = []
        self._crosshair_line: Any = None
        self._crosshair_dot: Any = None
        self.canvas.mpl_connect("motion_notify_event", self._on_motion)

    def _on_motion(self, event: Any) -> None:
        if (
            event.inaxes != self.ax
            or event.xdata is None
            or not self._daily_series
            or self._crosshair_line is None
            or self._crosshair_dot is None
        ):
            return
        day_idx = int(round(event.xdata)) - 1
        day_idx = max(0, min(len(self._daily_series) - 1, day_idx))
        item = self._daily_series[day_idx]
        day_num = item["day"]
        cum_val = item["cumulative_paise"] / 100.0

        self._crosshair_line.set_xdata([day_num, day_num])
        self._crosshair_line.set_visible(True)
        self._crosshair_dot.set_data([day_num], [cum_val])
        self._crosshair_dot.set_visible(True)
        if self.on_hover_day:
            self.on_hover_day(item)
        self._measured_draw()

    def update_chart(
        self,
        daily_series: list[dict[str, Any]],
        currency_symbol: str = "Rs. ",
    ) -> None:
        self._daily_series = list(daily_series)
        t = self.theme.tokens
        self.ax.clear()
        self._style_axes(show_grid=True)

        days = [item["day"] for item in daily_series]
        cum_rupees = [item["cumulative_paise"] / 100.0 for item in daily_series]

        if not days or max(cum_rupees, default=0.0) <= 0:
            self._crosshair_line = None
            self._crosshair_dot = None
            self.ax.text(
                0.5,
                0.5,
                "No daily spending activity for this month",
                ha="center",
                va="center",
                color=t["text_muted"],
                fontsize=10,
                transform=self.ax.transAxes,
            )
            self._measured_draw()
            return

        self.ax.plot(
            days,
            cum_rupees,
            color=t["primary"],
            linewidth=2.3,
            zorder=4,
        )
        self.ax.fill_between(
            days,
            cum_rupees,
            color=t["primary"],
            alpha=0.18,
            zorder=2,
        )

        last_day = days[-1]
        last_cum = cum_rupees[-1]
        self._crosshair_line = self.ax.axvline(
            x=last_day,
            color=t["primary"],
            linestyle="--",
            linewidth=1.2,
            zorder=5,
        )
        (self._crosshair_dot,) = self.ax.plot(
            [last_day],
            [last_cum],
            marker="o",
            markersize=6,
            color=t["primary"],
            markeredgecolor=t["surface"],
            markeredgewidth=1.5,
            zorder=6,
        )

        if self.on_hover_day and daily_series:
            self.on_hover_day(daily_series[-1])

        self.ax.set_xlim(1, max(days))
        self.ax.set_ylim(0, max(cum_rupees) * 1.15)
        self.ax.set_xlabel("Day of Month (Hover to scrub)", color=t["text_muted"], fontsize=8)
        self.figure.tight_layout(pad=1.0)
        self._measured_draw()
