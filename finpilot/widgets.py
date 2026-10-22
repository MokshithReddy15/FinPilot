"""
finpilot/widgets.py
Tactile, fluid, interactive Canvas-backed widgets for FinPilot Desktop:
- RoundedCard: Smooth rounded surface with hover border glow & 2px elevation lift
- StatCard: KPI card with animated count-up numbers, hover lift, and optional radial arc ring
- VaultSimulatorCard: Primary Net Balance card with a live draggable Savings Rate Simulator slider
- SegmentedPillToggle: Framer-Motion-style sliding pill segmented control on tk.Canvas
- InteractiveCashflowHorizon: Dual-stream Catmull-Rom spline + paired bars + interactive month nodes
- AnimatedProgressBar: Smooth Canvas progress bar with dynamic threshold colour
- SidebarButton: Left navigation item with animated active indicator bar and hover state
- PillButton: Primary/secondary clickable action button with smooth colour transition
- ToastNotification: Floating bottom-right notification with 5s timer and Undo action button
"""

from __future__ import annotations

import tkinter as tk
from typing import Any, Callable

from animations import Animator, lerp_color
from models import format_indian_currency
from theme import ThemeManager


def _rounded_rect_coords(
    x1: float, y1: float, x2: float, y2: float, r: float
) -> list[float]:
    """Return polygon coordinates for a smooth rounded rectangle on a tk.Canvas."""
    return [
        x1 + r, y1,
        x1 + r, y1,
        x2 - r, y1,
        x2 - r, y1,
        x2, y1,
        x2, y1 + r,
        x2, y1 + r,
        x2, y2 - r,
        x2, y2 - r,
        x2, y2,
        x2 - r, y2,
        x2 - r, y2,
        x1 + r, y2,
        x1 + r, y2,
        x1, y2,
        x1, y2 - r,
        x1, y2 - r,
        x1, y1 + r,
        x1, y1 + r,
        x1, y1,
    ]


class RoundedCard(tk.Canvas):
    """
    Canvas-drawn rounded container with subtle 1px border, hover border illumination,
    and an inner frame for hosting child widgets.
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator | None = None,
        card_key: str = "rcard",
        radius: int = 14,
        padding: int = 16,
        surface_key: str = "surface",
        height: int | None = None,
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t["background"],
            highlightthickness=0,
            bd=0,
            height=height or 120,
        )
        self.theme = theme
        self.animator = animator
        self.card_key = card_key
        self.radius = radius
        self.padding = padding
        self.surface_key = surface_key
        self._current_border = t["border"]

        self._bg_poly = self.create_polygon(
            _rounded_rect_coords(1, 2, 100, 100, self.radius),
            smooth=True,
            fill=t[self.surface_key],
            outline=t["border"],
            width=1,
            tags=("card_bg",),
        )

        self.body = tk.Frame(self, bg=t[self.surface_key], bd=0, highlightthickness=0)
        self._body_win = self.create_window(
            self.padding,
            self.padding,
            anchor="nw",
            window=self.body,
        )
        self.bind("<Configure>", self._on_configure)
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)

    def _on_enter(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        t = self.theme.tokens
        target = t["primary"]
        if self.animator:
            self.animator.animate_color(
                f"rc_bdr_{id(self)}",
                self._current_border,
                target,
                160,
                self._set_border_color,
            )
        else:
            self._set_border_color(target)

    def _on_leave(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        t = self.theme.tokens
        target = t["border"]
        if self.animator:
            self.animator.animate_color(
                f"rc_bdr_{id(self)}",
                self._current_border,
                target,
                200,
                self._set_border_color,
            )
        else:
            self._set_border_color(target)

    def _set_border_color(self, hex_col: str) -> None:
        self._current_border = hex_col
        self.itemconfig(self._bg_poly, outline=hex_col)

    def _on_configure(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        w = max(40, event.width)
        h = max(40, event.height)
        self.coords(
            self._bg_poly,
            *_rounded_rect_coords(1, 1, w - 2, h - 2, self.radius),
        )
        self.coords(self._body_win, self.padding, self.padding)
        self.itemconfig(
            self._body_win,
            width=max(10, w - self.padding * 2),
            height=max(10, h - self.padding * 2),
        )

    def apply_theme(self) -> None:
        """Update card colours in-place without recreating widgets (Rule 2)."""
        t = self.theme.tokens
        self._current_border = t["border"]
        self.configure(bg=t["background"])
        self.itemconfig(
            self._bg_poly,
            fill=t[self.surface_key],
            outline=t["border"],
        )
        self.body.configure(bg=t[self.surface_key])


class SegmentedPillToggle(tk.Canvas):
    """
    Framer-Motion-style sliding pill segmented control drawn on a tk.Canvas.
    Clicking any option smoothly slides the active rounded pill across options at 60 FPS.
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        toggle_id: str,
        options: list[tuple[str, str]],  # [(key, label), ...]
        on_change: Callable[[str], None],
        width: int = 260,
        height: int = 32,
        active_color_key: str = "primary",
        parent_bg_key: str = "background",
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t[parent_bg_key],
            highlightthickness=0,
            bd=0,
            width=width,
            height=height,
            cursor="hand2",
        )
        self.theme = theme
        self.animator = animator
        self.toggle_id = toggle_id
        self.options = options
        self.on_change = on_change
        self.total_w = width
        self.total_h = height
        self.active_color_key = active_color_key
        self.parent_bg_key = parent_bg_key

        self._selected_idx = 0
        self._pill_x = 3.0
        self._seg_w = (width - 6) / max(1, len(options))

        self._track_poly = self.create_polygon(
            _rounded_rect_coords(1, 1, width - 2, height - 2, 9),
            smooth=True,
            fill=t["surface_raised"],
            outline=t["border_subtle"],
            width=1,
        )
        self._pill_poly = self.create_polygon(
            _rounded_rect_coords(3, 3, 3 + self._seg_w, height - 3, 7),
            smooth=True,
            fill=t[self.active_color_key],
            outline="",
        )

        self._text_items: list[int] = []
        for idx, (_key, label) in enumerate(options):
            cx = 3 + self._seg_w * (idx + 0.5)
            item = self.create_text(
                cx,
                height / 2,
                text=label,
                fill="#FFFFFF" if idx == 0 else t["text_secondary"],
                font=theme.fonts["caption_bold"],
            )
            self._text_items.append(item)

        self.bind("<ButtonRelease-1>", self._on_click)

    def _on_click(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        idx = int((event.x - 3) // self._seg_w)
        idx = max(0, min(len(self.options) - 1, idx))
        if idx != self._selected_idx:
            self.set_selected(self.options[idx][0], notify=True)

    def set_selected(
        self, key: str, notify: bool = False, animate: bool = True
    ) -> None:
        target_idx = 0
        for i, (k, _) in enumerate(self.options):
            if k == key:
                target_idx = i
                break

        self._selected_idx = target_idx
        target_x = 3.0 + target_idx * self._seg_w
        t = self.theme.tokens

        for i, item_id in enumerate(self._text_items):
            self.itemconfig(
                item_id,
                fill="#FFFFFF" if i == target_idx else t["text_secondary"],
            )

        if not animate:
            self._pill_x = target_x
            self.coords(
                self._pill_poly,
                *_rounded_rect_coords(
                    target_x, 3, target_x + self._seg_w, self.total_h - 3, 7
                ),
            )
        else:
            start_x = self._pill_x

            def _step(val: float) -> None:
                self._pill_x = val
                self.coords(
                    self._pill_poly,
                    *_rounded_rect_coords(
                        val, 3, val + self._seg_w, self.total_h - 3, 7
                    ),
                )

            self.animator.animate_value(
                key=f"seg_pill_{self.toggle_id}",
                start_val=start_x,
                end_val=target_x,
                duration_ms=210,
                on_update=_step,
            )

        if notify:
            self.on_change(key)

    def set_active_color_key(self, color_key: str) -> None:
        self.active_color_key = color_key
        self.itemconfig(self._pill_poly, fill=self.theme.tokens[color_key])

    def apply_theme(self) -> None:
        t = self.theme.tokens
        self.configure(bg=t[self.parent_bg_key])
        self.itemconfig(
            self._track_poly,
            fill=t["surface_raised"],
            outline=t["border_subtle"],
        )
        self.itemconfig(self._pill_poly, fill=t[self.active_color_key])
        for i, item_id in enumerate(self._text_items):
            self.itemconfig(
                item_id,
                fill="#FFFFFF" if i == self._selected_idx else t["text_secondary"],
            )


class VaultSimulatorCard(tk.Canvas):
    """
    Primary Tactile Hero Vault Card for Dashboard:
    - Animated count-up Net Balance display
    - Interactive draggable Savings Rate Simulator slider (10%..75%) drawn on the Canvas
    - Real-time projected annual compounding readout (Rs. X/yr)
    - Smooth 2px hover lift and indigo border illumination
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t["background"],
            highlightthickness=0,
            bd=0,
            height=136,
            cursor="hand2",
        )
        self.theme = theme
        self.animator = animator
        self._current_balance = 0.0
        self._monthly_income_paise = 143500 * 100
        self._actual_savings_rate = 48.5
        self._sim_target_pct = 45
        self._currency_symbol = "Rs. "
        self._hover_dy = 0.0
        self._border_col = t["primary"]

        self._bg_poly = self.create_polygon(
            _rounded_rect_coords(1, 3, 320, 134, 14),
            smooth=True,
            fill=t["surface"],
            outline=t["primary"],
            width=1,
        )
        self._accent_strip = self.create_rectangle(
            20, 3, 96, 5, fill=t["primary"], outline=""
        )

        self._title_item = self.create_text(
            18,
            16,
            anchor="nw",
            text="TOTAL NET BALANCE",
            fill=t["primary"],
            font=theme.fonts["caption_bold"],
        )
        self._meta_item = self.create_text(
            300,
            16,
            anchor="ne",
            text="",
            fill=t["text_muted"],
            font=theme.fonts["caption"],
        )
        self._val_item = self.create_text(
            18,
            36,
            anchor="nw",
            text="Rs. 0",
            fill=t["text_primary"],
            font=theme.fonts["display"],
        )

        # Interactive Slider Elements
        self._sim_label_item = self.create_text(
            18,
            80,
            anchor="nw",
            text="Interactive Savings Simulator: 45%",
            fill=t["text_secondary"],
            font=theme.fonts["caption_bold"],
        )
        self._sim_proj_item = self.create_text(
            300,
            80,
            anchor="ne",
            text="Rs. 0/yr",
            fill=t["success"],
            font=theme.fonts["caption_bold"],
        )

        self._slider_track = self.create_rectangle(
            18, 104, 300, 108, fill=t["surface_raised"], outline=""
        )
        self._slider_fill = self.create_rectangle(
            18, 104, 160, 108, fill=t["primary"], outline=""
        )
        self._slider_thumb = self.create_oval(
            154, 99, 166, 113, fill="#FFFFFF", outline=t["primary"], width=2
        )

        self._footer_item = self.create_text(
            18,
            116,
            anchor="nw",
            text="Drag slider to simulate annual savings velocity",
            fill=t["text_muted"],
            font=theme.fonts["caption"],
        )

        self.bind("<Configure>", self._on_configure)
        self.bind("<Button-1>", self._on_slider_drag)
        self.bind("<B1-Motion>", self._on_slider_drag)
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)

    def _on_enter(self, _e: tk.Event) -> None:  # type: ignore[type-arg]
        t = self.theme.tokens
        self.animator.animate_color(
            "vault_bdr",
            self._border_col,
            t["primary_hover"],
            150,
            self._update_border,
        )

    def _on_leave(self, _e: tk.Event) -> None:  # type: ignore[type-arg]
        t = self.theme.tokens
        self.animator.animate_color(
            "vault_bdr",
            self._border_col,
            t["primary"],
            180,
            self._update_border,
        )

    def _update_border(self, col: str) -> None:
        self._border_col = col
        self.itemconfig(self._bg_poly, outline=col)

    def _on_configure(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        w = max(180, event.width)
        h = max(120, event.height)
        self.coords(self._bg_poly, *_rounded_rect_coords(1, 2, w - 2, h - 2, 14))
        self.coords(self._meta_item, w - 18, 16)
        self.coords(self._sim_proj_item, w - 18, 80)
        self._layout_slider(w)

    def _layout_slider(self, width: int | None = None) -> None:
        w = width or max(180, self.winfo_width())
        x1 = 18.0
        x2 = max(x1 + 60.0, float(w - 18))
        ratio = (self._sim_target_pct - 10.0) / (75.0 - 10.0)
        ratio = max(0.0, min(1.0, ratio))
        cx = x1 + ratio * (x2 - x1)

        self.coords(self._slider_track, x1, 104, x2, 108)
        self.coords(self._slider_fill, x1, 104, cx, 108)
        self.coords(self._slider_thumb, cx - 6, 100, cx + 6, 112)

        monthly_target = int(round((self._monthly_income_paise * self._sim_target_pct) / 100.0))
        annual_target = monthly_target * 12
        self.itemconfig(
            self._sim_label_item,
            text=f"Savings Simulator: {self._sim_target_pct}%",
        )
        self.itemconfig(
            self._sim_proj_item,
            text=f"{format_indian_currency(annual_target, self._currency_symbol)}/yr",
        )
        self.itemconfig(
            self._footer_item,
            text=(
                f"Actual rate: {self._actual_savings_rate:.1f}% · "
                f"Target: {format_indian_currency(monthly_target, self._currency_symbol)}/mo"
            ),
        )

    def _on_slider_drag(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        if event.y < 72:
            return
        w = max(180, self.winfo_width())
        x1 = 18.0
        x2 = max(x1 + 60.0, float(w - 18))
        ratio = (event.x - x1) / (x2 - x1)
        ratio = max(0.0, min(1.0, ratio))
        self._sim_target_pct = int(round(10 + ratio * 65))
        self._layout_slider(w)

    def update_vault(
        self,
        balance_paise: int,
        monthly_income_paise: int,
        actual_savings_rate: float,
        record_count: int,
        currency_symbol: str,
        scope_title: str = "TOTAL NET BALANCE",
        animate: bool = True,
    ) -> None:
        self._monthly_income_paise = max(0, monthly_income_paise)
        self._actual_savings_rate = actual_savings_rate
        self._currency_symbol = currency_symbol
        self.itemconfig(self._title_item, text=scope_title)
        self.itemconfig(self._meta_item, text=f"{record_count} entries")
        self._layout_slider()

        target = float(balance_paise)
        if not animate:
            self._current_balance = target
            self.itemconfig(
                self._val_item,
                text=format_indian_currency(int(round(target)), currency_symbol),
            )
            return

        start = self._current_balance

        def _step(val: float) -> None:
            self._current_balance = val
            self.itemconfig(
                self._val_item,
                text=format_indian_currency(int(round(val)), currency_symbol),
            )

        self.animator.animate_value(
            key="vault_balance_countup",
            start_val=start,
            end_val=target,
            duration_ms=440,
            on_update=_step,
        )

    def apply_theme(self) -> None:
        t = self.theme.tokens
        self._border_col = t["primary"]
        self.configure(bg=t["background"])
        self.itemconfig(self._bg_poly, fill=t["surface"], outline=t["primary"])
        self.itemconfig(self._accent_strip, fill=t["primary"])
        self.itemconfig(self._title_item, fill=t["primary"])
        self.itemconfig(self._meta_item, fill=t["text_muted"])
        self.itemconfig(self._val_item, fill=t["text_primary"])
        self.itemconfig(self._sim_label_item, fill=t["text_secondary"])
        self.itemconfig(self._sim_proj_item, fill=t["success"])
        self.itemconfig(self._slider_track, fill=t["surface_raised"])
        self.itemconfig(self._slider_fill, fill=t["primary"])
        self.itemconfig(self._slider_thumb, outline=t["primary"])
        self.itemconfig(self._footer_item, fill=t["text_muted"])


class StatCard(tk.Canvas):
    """
    Kinetic KPI stat card drawn on a single Canvas with:
    - Animated ease-out-cubic count-up numbers
    - Optional animated SVG-style radial progress ring (show_radial=True)
    - Smooth 2px hover lift and border colour interpolation
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        card_id: str,
        label: str,
        accent_key: str = "primary",
        show_radial: bool = False,
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t["background"],
            highlightthickness=0,
            bd=0,
            height=136,
            cursor="hand2",
        )
        self.theme = theme
        self.animator = animator
        self.card_id = card_id
        self.accent_key = accent_key
        self.show_radial = show_radial
        self._current_numeric: float = 0.0
        self._current_border = t["border"]

        self._bg_poly = self.create_polygon(
            _rounded_rect_coords(1, 3, 220, 134, 14),
            smooth=True,
            fill=t["surface"],
            outline=t["border"],
            width=1,
        )
        self._accent_bar = self.create_rectangle(
            18, 3, 68, 5, fill=t[self.accent_key], outline=""
        )
        self._label_item = self.create_text(
            18,
            18,
            anchor="nw",
            text=label,
            fill=t["text_muted"],
            font=theme.fonts["caption_bold"],
        )
        self._badge_item = self.create_text(
            200,
            18,
            anchor="ne",
            text="",
            fill=t[self.accent_key],
            font=theme.fonts["caption_bold"],
        )
        self._value_item = self.create_text(
            18,
            46,
            anchor="nw",
            text="Rs. 0",
            fill=t[self.accent_key] if accent_key in ("success", "danger") else t["text_primary"],
            font=theme.fonts["kpi"],
        )
        self._sub_item = self.create_text(
            18,
            98,
            anchor="nw",
            text="",
            fill=t["text_secondary"],
            font=theme.fonts["caption"],
        )

        # Optional Radial Ring (for Savings Rate card)
        self._ring_track = self.create_oval(
            160,
            40,
            202,
            82,
            outline=t["surface_raised"] if show_radial else "",
            width=4 if show_radial else 0,
        )
        self._ring_arc = self.create_arc(
            160,
            40,
            202,
            82,
            start=90,
            extent=0,
            style="arc",
            outline=t[self.accent_key] if show_radial else "",
            width=4 if show_radial else 0,
        )

        self.bind("<Configure>", self._on_configure)
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)

    def _on_enter(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        t = self.theme.tokens
        w = max(80, self.winfo_width())
        h = max(80, self.winfo_height())
        # 2px upward hover lift
        self.coords(self._bg_poly, *_rounded_rect_coords(1, 1, w - 2, h - 4, 14))
        self.animator.animate_color(
            f"sc_bdr_{self.card_id}",
            self._current_border,
            t[self.accent_key],
            160,
            self._set_border,
        )

    def _on_leave(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        t = self.theme.tokens
        w = max(80, self.winfo_width())
        h = max(80, self.winfo_height())
        self.coords(self._bg_poly, *_rounded_rect_coords(1, 3, w - 2, h - 2, 14))
        self.animator.animate_color(
            f"sc_bdr_{self.card_id}",
            self._current_border,
            t["border"],
            200,
            self._set_border,
        )

    def _set_border(self, col: str) -> None:
        self._current_border = col
        self.itemconfig(self._bg_poly, outline=col)

    def _on_configure(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        w = max(80, event.width)
        h = max(80, event.height)
        self.coords(self._bg_poly, *_rounded_rect_coords(1, 3, w - 2, h - 2, 14))
        self.coords(self._accent_bar, 18, 3, min(w - 18, 76), 5)
        self.coords(self._badge_item, w - 18, 18)
        if self.show_radial:
            self.coords(self._ring_track, w - 58, 38, w - 18, 78)
            self.coords(self._ring_arc, w - 58, 38, w - 18, 78)

    def set_value(
        self,
        target_value: float,
        formatter: Callable[[float], str],
        subtitle: str = "",
        badge_text: str = "",
        badge_color_key: str | None = None,
        animate: bool = True,
    ) -> None:
        """Animate from current numeric value to target_value using ease-out-cubic."""
        t = self.theme.tokens
        self.itemconfig(self._sub_item, text=subtitle)
        self.itemconfig(
            self._badge_item,
            text=badge_text,
            fill=t[badge_color_key or self.accent_key],
        )

        if not animate:
            self._current_numeric = target_value
            self.itemconfig(self._value_item, text=formatter(target_value))
            if self.show_radial:
                pct = max(0.0, min(100.0, target_value))
                self.itemconfig(self._ring_arc, extent=-3.6 * pct)
            return

        start_val = self._current_numeric

        def _update(val: float) -> None:
            self._current_numeric = val
            self.itemconfig(self._value_item, text=formatter(val))
            if self.show_radial:
                pct = max(0.0, min(100.0, val))
                self.itemconfig(self._ring_arc, extent=-3.6 * pct)

        self.animator.animate_value(
            key=f"stat_{self.card_id}",
            start_val=start_val,
            end_val=target_value,
            duration_ms=420,
            on_update=_update,
        )

    def apply_theme(self) -> None:
        t = self.theme.tokens
        self._current_border = t["border"]
        self.configure(bg=t["background"])
        self.itemconfig(self._bg_poly, fill=t["surface"], outline=t["border"])
        self.itemconfig(self._accent_bar, fill=t[self.accent_key])
        self.itemconfig(self._label_item, fill=t["text_muted"])
        self.itemconfig(
            self._value_item,
            fill=t[self.accent_key]
            if self.accent_key in ("success", "danger")
            else t["text_primary"],
        )
        self.itemconfig(self._sub_item, fill=t["text_secondary"])
        if self.show_radial:
            self.itemconfig(self._ring_track, outline=t["surface_raised"])
            self.itemconfig(self._ring_arc, outline=t[self.accent_key])


class InteractiveCashflowHorizon(tk.Canvas):
    """
    Interactive 6-Month Cashflow Horizon drawn on a tk.Canvas:
    - Smooth Catmull-Rom spline curves (create_line(..., smooth=True)) for Income & Expenses
    - Paired tactile bar columns + glowing nodes
    - Hovering over any month draws a vertical laser crosshair and updates on_inspect_month
    - Clicking any month node calls on_select_month to time-travel across the app
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        on_inspect_month: Callable[[dict[str, Any]], None],
        on_select_month: Callable[[str], None],
        height: int = 195,
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t["surface"],
            highlightthickness=0,
            bd=0,
            height=height,
            cursor="hand2",
        )
        self.theme = theme
        self.animator = animator
        self.on_inspect_month = on_inspect_month
        self.on_select_month = on_select_month
        self._series: list[dict[str, Any]] = []
        self._hovered_idx: int | None = None
        self._active_month: str = ""
        self._anim_progress: float = 1.0

        self.bind("<Configure>", lambda _e: self._redraw())
        self.bind("<Motion>", self._on_motion)
        self.bind("<Leave>", self._on_leave)
        self.bind("<ButtonRelease-1>", self._on_click)

    def set_series(
        self,
        series: list[dict[str, Any]],
        active_month: str,
        animate: bool = True,
    ) -> None:
        self._series = list(series)
        self._active_month = active_month
        if self._series:
            self.on_inspect_month(self._series[-1])

        if not animate:
            self._anim_progress = 1.0
            self._redraw()
            return

        def _step(val: float) -> None:
            self._anim_progress = val
            self._redraw()

        self.animator.animate_value(
            key="horizon_spline_entry",
            start_val=0.15,
            end_val=1.0,
            duration_ms=340,
            on_update=_step,
        )

    def _idx_at_x(self, x: float) -> int | None:
        n = len(self._series)
        if n == 0:
            return None
        w = max(200, self.winfo_width())
        pad_x = 42.0
        span = max(1.0, w - pad_x * 2)
        step = span / max(1, n - 1)
        idx = int(round((x - pad_x) / step))
        return max(0, min(n - 1, idx))

    def _on_motion(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        idx = self._idx_at_x(event.x)
        if idx is not None and idx != self._hovered_idx:
            self._hovered_idx = idx
            self.on_inspect_month(self._series[idx])
            self._redraw()

    def _on_leave(self, _e: tk.Event) -> None:  # type: ignore[type-arg]
        if self._hovered_idx is not None:
            self._hovered_idx = None
            if self._series:
                self.on_inspect_month(self._series[-1])
            self._redraw()

    def _on_click(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        idx = self._idx_at_x(event.x)
        if idx is not None and idx < len(self._series):
            m = self._series[idx]["month"]
            self.on_select_month(m)

    def _redraw(self) -> None:
        self.delete("all")
        t = self.theme.tokens
        w = max(220, self.winfo_width())
        h = max(140, self.winfo_height())
        pad_x = 42.0
        pad_top = 18.0
        pad_bot = 26.0
        plot_h = max(40.0, h - pad_top - pad_bot)

        # Horizontal dashed reference lines
        for r in (0.25, 0.5, 0.75, 1.0):
            y = h - pad_bot - r * plot_h
            self.create_line(
                pad_x - 12,
                y,
                w - pad_x + 12,
                y,
                fill=t["border_subtle"],
                dash=(3, 3),
            )

        n = len(self._series)
        if n == 0:
            self.create_text(
                w / 2,
                h / 2,
                text="No monthly data available",
                fill=t["text_muted"],
                font=self.theme.fonts["body"],
            )
            return

        max_val = max(
            1.0,
            max(
                max(item["income_paise"], item["expense_paise"])
                for item in self._series
            ),
        )

        inc_coords: list[float] = []
        exp_coords: list[float] = []
        nodes: list[tuple[float, float, float, dict[str, Any], int]] = []

        for idx, item in enumerate(self._series):
            x = (
                pad_x + (idx / (n - 1)) * (w - pad_x * 2)
                if n > 1
                else w / 2
            )
            inc_r = (item["income_paise"] / max_val) * self._anim_progress
            exp_r = (item["expense_paise"] / max_val) * self._anim_progress
            inc_y = h - pad_bot - inc_r * plot_h
            exp_y = h - pad_bot - exp_r * plot_h
            inc_coords.extend([x, inc_y])
            exp_coords.extend([x, exp_y])
            nodes.append((x, inc_y, exp_y, item, idx))

        # Draw smooth spline curves
        if len(inc_coords) >= 4:
            self.create_line(
                *inc_coords,
                smooth=True,
                fill=t["success"],
                width=2.5,
            )
            self.create_line(
                *exp_coords,
                smooth=True,
                fill=t["danger"],
                width=2.5,
            )

        inspected_idx = (
            self._hovered_idx
            if self._hovered_idx is not None
            else (n - 1)
        )

        for x, inc_y, exp_y, item, idx in nodes:
            is_focus = idx == inspected_idx
            is_active = item["month"] == self._active_month

            if is_focus:
                self.create_line(
                    x,
                    pad_top - 4,
                    x,
                    h - pad_bot,
                    fill=t["primary"],
                    dash=(3, 3),
                    width=1.5,
                )

            # Paired tactile bars
            self.create_rectangle(
                x - 9,
                inc_y,
                x - 2,
                h - pad_bot,
                fill=t["success"],
                outline="",
            )
            self.create_rectangle(
                x + 2,
                exp_y,
                x + 9,
                h - pad_bot,
                fill=t["danger"],
                outline="",
            )

            # Nodes
            r = 5 if is_focus else 3.5
            self.create_oval(
                x - r,
                inc_y - r,
                x + r,
                inc_y + r,
                fill=t["success"],
                outline=t["surface"],
                width=1.5,
            )
            self.create_oval(
                x - r,
                exp_y - r,
                x + r,
                exp_y + r,
                fill=t["danger"],
                outline=t["surface"],
                width=1.5,
            )

            lbl_col = (
                t["primary"]
                if is_active
                else (t["text_primary"] if is_focus else t["text_muted"])
            )
            self.create_text(
                x,
                h - 11,
                text=item["label"],
                fill=lbl_col,
                font=self.theme.fonts["caption_bold" if (is_active or is_focus) else "caption"],
            )

    def apply_theme(self) -> None:
        self.configure(bg=self.theme.tokens["surface"])
        self._redraw()


class AnimatedProgressBar(tk.Canvas):
    """
    Smooth Canvas progress bar that animates width changes via coords() and
    changes colour based on budget usage (<70% green, 70-99% amber, 100%+ red).
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        animator: Animator,
        bar_id: str,
        height: int = 10,
        surface_bg_key: str = "surface",
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t[surface_bg_key],
            highlightthickness=0,
            bd=0,
            height=height,
        )
        self.theme = theme
        self.animator = animator
        self.bar_id = bar_id
        self.bar_height = height
        self.surface_bg_key = surface_bg_key
        self._current_pct: float = 0.0
        self._target_pct: float = 0.0
        self._level: str = "ok"

        self._track_rect = self.create_rectangle(
            0, 0, 200, height, fill=t["surface_raised"], outline="", width=0
        )
        self._fill_rect = self.create_rectangle(
            0, 0, 0, height, fill=t["success"], outline="", width=0
        )
        self.bind("<Configure>", self._on_configure)

    def _color_for_level(self, level: str) -> str:
        t = self.theme.tokens
        if level == "danger":
            return t["danger"]
        if level == "warning":
            return t["warning"]
        return t["success"]

    def _on_configure(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        w = max(20, event.width)
        self.coords(self._track_rect, 0, 0, w, self.bar_height)
        fill_w = max(0.0, min(1.0, self._current_pct / 100.0)) * w
        self.coords(self._fill_rect, 0, 0, fill_w, self.bar_height)

    def set_progress(
        self, percent: float, level: str = "ok", animate: bool = True
    ) -> None:
        """Animate bar fill to `percent` (0..100) and apply status colour."""
        self._target_pct = max(0.0, min(100.0, percent))
        self._level = level
        self.itemconfig(self._fill_rect, fill=self._color_for_level(level))

        if not animate:
            self._current_pct = self._target_pct
            w = max(20, self.winfo_width())
            self.coords(
                self._fill_rect,
                0,
                0,
                (self._current_pct / 100.0) * w,
                self.bar_height,
            )
            return

        start = self._current_pct

        def _step(val: float) -> None:
            self._current_pct = val
            w = max(20, self.winfo_width())
            self.coords(
                self._fill_rect,
                0,
                0,
                (val / 100.0) * w,
                self.bar_height,
            )

        self.animator.animate_value(
            key=f"prog_{self.bar_id}",
            start_val=start,
            end_val=self._target_pct,
            duration_ms=360,
            on_update=_step,
        )

    def apply_theme(self) -> None:
        t = self.theme.tokens
        self.configure(bg=t[self.surface_bg_key])
        self.itemconfig(self._track_rect, fill=t["surface_raised"])
        self.itemconfig(self._fill_rect, fill=self._color_for_level(self._level))


class PillButton(tk.Canvas):
    """
    Modern clickable button with hover & focus states and hand2 cursor.
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        text: str,
        command: Callable[[], None],
        variant: str = "primary",  # "primary", "secondary", "danger"
        width: int = 130,
        height: int = 34,
        parent_bg_key: str = "surface",
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t[parent_bg_key],
            highlightthickness=0,
            bd=0,
            width=width,
            height=height,
            cursor="hand2",
            takefocus=1,
        )
        self.theme = theme
        self.text = text
        self.command = command
        self.variant = variant
        self.btn_width = width
        self.btn_height = height
        self.parent_bg_key = parent_bg_key
        self._hovered = False

        fill, fg, outline = self._resolve_colors()
        self._poly = self.create_polygon(
            _rounded_rect_coords(1, 1, width - 2, height - 2, 9),
            smooth=True,
            fill=fill,
            outline=outline,
            width=1,
        )
        self._label = self.create_text(
            width // 2,
            height // 2,
            text=text,
            fill=fg,
            font=theme.fonts["caption_bold" if height <= 28 else "body_bold"],
        )

        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<ButtonRelease-1>", self._on_click)
        self.bind("<Return>", lambda _e: self.command())

    def _resolve_colors(self) -> tuple[str, str, str]:
        t = self.theme.tokens
        if self.variant == "primary":
            fill = t["primary_hover"] if self._hovered else t["primary"]
            return fill, "#FFFFFF", fill
        if self.variant == "danger":
            fill = t["danger"] if self._hovered else t["danger_bg"]
            fg = "#FFFFFF" if self._hovered else t["danger"]
            return fill, fg, t["danger"]
        fill = t["surface_hover"] if self._hovered else t["surface_raised"]
        outline = t["primary"] if self._hovered else t["border_subtle"]
        return fill, t["text_primary"], outline

    def _on_enter(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        self._hovered = True
        self._refresh_colors()

    def _on_leave(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        self._hovered = False
        self._refresh_colors()

    def _on_click(self, _event: tk.Event) -> None:  # type: ignore[type-arg]
        self.command()

    def set_text(self, text: str) -> None:
        self.text = text
        self.itemconfig(self._label, text=text)

    def _refresh_colors(self) -> None:
        fill, fg, outline = self._resolve_colors()
        self.itemconfig(self._poly, fill=fill, outline=outline)
        self.itemconfig(self._label, fill=fg)

    def apply_theme(self) -> None:
        self.configure(bg=self.theme.tokens[self.parent_bg_key])
        self._refresh_colors()


class SidebarButton(tk.Canvas):
    """
    Left sidebar navigation button with icon, label, active indicator bar, and hover effect.
    """

    def __init__(
        self,
        parent: tk.Misc,
        theme: ThemeManager,
        icon: str,
        label: str,
        command: Callable[[], None],
    ) -> None:
        t = theme.tokens
        super().__init__(
            parent,
            bg=t["surface"],
            highlightthickness=0,
            bd=0,
            height=44,
            cursor="hand2",
        )
        self.theme = theme
        self.command = command
        self._active = False
        self._hovered = False

        self._bg_rect = self.create_polygon(
            _rounded_rect_coords(8, 2, 212, 42, 10),
            smooth=True,
            fill=t["surface"],
            outline="",
        )
        self._indicator = self.create_rectangle(
            0, 10, 4, 34, fill=t["surface"], outline=""
        )
        self._icon_item = self.create_text(
            28, 22, text=icon, fill=t["text_muted"], font=theme.fonts["body"]
        )
        self._text_item = self.create_text(
            52,
            22,
            anchor="w",
            text=label,
            fill=t["text_secondary"],
            font=theme.fonts["body_bold"],
        )

        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<ButtonRelease-1>", lambda _e: self.command())
        self.bind("<Configure>", self._on_configure)

    def _on_configure(self, event: tk.Event) -> None:  # type: ignore[type-arg]
        w = max(120, event.width)
        self.coords(self._bg_rect, *_rounded_rect_coords(8, 2, w - 8, 42, 10))

    def set_active(self, active: bool) -> None:
        self._active = active
        self.apply_theme()

    def _on_enter(self, _e: tk.Event) -> None:  # type: ignore[type-arg]
        self._hovered = True
        self.apply_theme()

    def _on_leave(self, _e: tk.Event) -> None:  # type: ignore[type-arg]
        self._hovered = False
        self.apply_theme()

    def apply_theme(self) -> None:
        t = self.theme.tokens
        self.configure(bg=t["surface"])
        if self._active:
            bg = t["surface_raised"]
            fg = t["text_primary"]
            ind = t["primary"]
            outline = t["primary"]
        elif self._hovered:
            bg = t["surface_hover"]
            fg = t["text_primary"]
            ind = t["surface"]
            outline = ""
        else:
            bg = t["surface"]
            fg = t["text_muted"]
            ind = t["surface"]
            outline = ""

        self.itemconfig(self._bg_rect, fill=bg, outline=outline)
        self.itemconfig(self._indicator, fill=ind)
        self.itemconfig(self._icon_item, fill=t["primary"] if self._active else fg)
        self.itemconfig(self._text_item, fill=fg)


class ToastNotification(tk.Frame):
    """
    Non-blocking floating bottom-right toast banner with optional action button
    (e.g., 5-second Undo on transaction delete or 80%/100% budget warning).
    """

    def __init__(self, root: tk.Misc, theme: ThemeManager, animator: Animator) -> None:
        t = theme.tokens
        super().__init__(
            root,
            bg=t["surface_raised"],
            highlightbackground=t["primary"],
            highlightthickness=1,
            padx=14,
            pady=10,
        )
        self.root = root
        self.theme = theme
        self.animator = animator
        self._action_cb: Callable[[], None] | None = None

        self._msg_label = tk.Label(
            self,
            text="",
            bg=t["surface_raised"],
            fg=t["text_primary"],
            font=theme.fonts["body"],
        )
        self._msg_label.pack(side="left", padx=(0, 12))

        self._action_btn = tk.Label(
            self,
            text="",
            bg=t["primary"],
            fg="#FFFFFF",
            font=theme.fonts["caption_bold"],
            padx=10,
            pady=4,
            cursor="hand2",
        )
        self._action_btn.bind("<ButtonRelease-1>", self._on_action)

        self._close_btn = tk.Label(
            self,
            text="✕",
            bg=t["surface_raised"],
            fg=t["text_muted"],
            font=theme.fonts["caption_bold"],
            cursor="hand2",
            padx=4,
        )
        self._close_btn.pack(side="right")
        self._close_btn.bind("<ButtonRelease-1>", lambda _e: self.hide())

    def show(
        self,
        message: str,
        level: str = "info",
        duration_ms: int = 5000,
        action_label: str | None = None,
        action_callback: Callable[[], None] | None = None,
    ) -> None:
        """Display the toast in the bottom-right corner for `duration_ms`."""
        t = self.theme.tokens
        border_map = {
            "info": t["primary"],
            "success": t["success"],
            "warning": t["warning"],
            "danger": t["danger"],
        }
        border_col = border_map.get(level, t["primary"])
        self.configure(
            bg=t["surface_raised"],
            highlightbackground=border_col,
        )
        self._msg_label.configure(
            text=message, bg=t["surface_raised"], fg=t["text_primary"]
        )
        self._close_btn.configure(bg=t["surface_raised"], fg=t["text_muted"])

        self._action_cb = action_callback
        if action_label and action_callback:
            self._action_btn.configure(text=action_label, bg=border_col)
            self._action_btn.pack(side="left", padx=(0, 8))
        else:
            self._action_btn.pack_forget()

        self.place(relx=1.0, rely=1.0, x=-24, y=-24, anchor="se")
        self.lift()
        self.animator.debounce("toast_auto_hide", duration_ms, self.hide)

    def _on_action(self, _e: tk.Event) -> None:  # type: ignore[type-arg]
        cb = self._action_cb
        self.hide()
        if cb:
            cb()

    def hide(self) -> None:
        self.animator.cancel("toast_auto_hide")
        self.place_forget()
