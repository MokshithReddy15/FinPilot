"""
finpilot/theme.py
Single-source-of-truth design tokens (Dark & Light palettes), typography scale,
8px spacing grid, and custom ttk.Style configuration for FinPilot.
"""

from __future__ import annotations

import platform
import tkinter as tk
from tkinter import ttk

DARK_TOKENS: dict[str, str] = {
    "background": "#0B0F19",
    "surface": "#111827",
    "surface_raised": "#1E293B",
    "surface_hover": "#26334D",
    "border": "#1F2937",
    "border_subtle": "#334155",
    "primary": "#6366F1",
    "primary_hover": "#4F46E5",
    "success": "#10B981",
    "success_bg": "#064E3B",
    "danger": "#EF4444",
    "danger_bg": "#7F1D1D",
    "warning": "#F59E0B",
    "warning_bg": "#78350F",
    "text_primary": "#F8FAFC",
    "text_secondary": "#CBD5E1",
    "text_muted": "#94A3B8",
}

LIGHT_TOKENS: dict[str, str] = {
    "background": "#F8FAFC",
    "surface": "#FFFFFF",
    "surface_raised": "#F1F5F9",
    "surface_hover": "#E2E8F0",
    "border": "#E2E8F0",
    "border_subtle": "#CBD5E1",
    "primary": "#4F46E5",
    "primary_hover": "#4338CA",
    "success": "#059669",
    "success_bg": "#D1FAE5",
    "danger": "#DC2626",
    "danger_bg": "#FEE2E2",
    "warning": "#D97706",
    "warning_bg": "#FEF3C7",
    "text_primary": "#0F172A",
    "text_secondary": "#334155",
    "text_muted": "#64748B",
}

CHART_PALETTE: tuple[str, ...] = (
    "#6366F1",  # Indigo
    "#10B981",  # Emerald
    "#F59E0B",  # Amber
    "#EC4899",  # Pink
    "#06B6D4",  # Cyan
    "#8B5CF6",  # Violet
    "#F97316",  # Orange
    "#14B8A6",  # Teal
)

# 8px Spacing Grid Constants
SPACE_1 = 4
SPACE_2 = 8
SPACE_3 = 16
SPACE_4 = 24
SPACE_5 = 32


def resolve_font_family() -> str:
    """Select the cleanest platform-native UI font family."""
    sys_name = platform.system()
    if sys_name == "Windows":
        return "Segoe UI"
    if sys_name == "Darwin":
        return "SF Pro Display"
    return "DejaVu Sans"


class ThemeManager:
    """
    Manages active colour tokens, font specifications, and configures ttk styles.
    Notifies registered callbacks on dark/light mode toggle.
    """

    def __init__(self, initial_mode: str = "dark") -> None:
        self.mode = initial_mode
        self.tokens: dict[str, str] = (
             dict(DARK_TOKENS) if initial_mode == "dark" else dict(LIGHT_TOKENS)
        )
        self.font_family = resolve_font_family()
        self.fonts: dict[str, tuple[str, int, str] | tuple[str, int]] = {
            "display": (self.font_family, 26, "bold"),
            "kpi": (self.font_family, 20, "bold"),
            "title": (self.font_family, 16, "bold"),
            "subtitle": (self.font_family, 12, "bold"),
            "body": (self.font_family, 11),
            "body_bold": (self.font_family, 11, "bold"),
            "caption": (self.font_family, 9),
            "caption_bold": (self.font_family, 9, "bold"),
            "mono": ("Consolas" if platform.system() == "Windows" else "Menlo", 11),
        }

    def toggle_mode(self, root: tk.Misc) -> str:
        """Switch between 'dark' and 'light' themes and re-apply ttk styles."""
        self.mode = "light" if self.mode == "dark" else "dark"
        self.tokens = (
            dict(DARK_TOKENS) if self.mode == "dark" else dict(LIGHT_TOKENS)
        )
        self.apply_ttk_styles(root)
        return self.mode

    def apply_ttk_styles(self, root: tk.Misc) -> None:
        """Configure custom ttk widget styles so no default grey Tk chrome appears."""
        style = ttk.Style(root)
        if "clam" in style.theme_names():
            style.theme_use("clam")

        t = self.tokens
        root.configure(bg=t["background"])  # type: ignore[call-arg]

        style.configure(
            ".",
            background=t["background"],
            foreground=t["text_primary"],
            font=self.fonts["body"],
            borderwidth=0,
        )
        style.configure("App.TFrame", background=t["background"])
        style.configure("Surface.TFrame", background=t["surface"])
        style.configure("Raised.TFrame", background=t["surface_raised"])

        style.configure(
            "Title.TLabel",
            background=t["background"],
            foreground=t["text_primary"],
            font=self.fonts["title"],
        )
        style.configure(
            "Muted.TLabel",
            background=t["background"],
            foreground=t["text_muted"],
            font=self.fonts["body"],
        )
        style.configure(
            "Surface.TLabel",
            background=t["surface"],
            foreground=t["text_primary"],
            font=self.fonts["body"],
        )
        style.configure(
            "SurfaceMuted.TLabel",
            background=t["surface"],
            foreground=t["text_muted"],
            font=self.fonts["caption"],
        )

        # Custom Entry
        style.configure(
            "Fin.TEntry",
            fieldbackground=t["surface_raised"],
            background=t["surface_raised"],
            foreground=t["text_primary"],
            insertcolor=t["text_primary"],
            bordercolor=t["border_subtle"],
            lightcolor=t["primary"],
            darkcolor=t["border_subtle"],
            padding=(10, 7),
        )
        style.map(
            "Fin.TEntry",
            bordercolor=[("focus", t["primary"])],
            lightcolor=[("focus", t["primary"])],
        )

        # Custom Combobox
        style.configure(
            "Fin.TCombobox",
            fieldbackground=t["surface_raised"],
            background=t["surface_raised"],
            foreground=t["text_primary"],
            arrowcolor=t["text_secondary"],
            bordercolor=t["border_subtle"],
            padding=(10, 6),
        )
        style.map(
            "Fin.TCombobox",
            fieldbackground=[("readonly", t["surface_raised"])],
            selectbackground=[("readonly", t["surface_raised"])],
            selectforeground=[("readonly", t["text_primary"])],
            bordercolor=[("focus", t["primary"])],
        )

        # Custom Treeview (row height 36, flat headings, striped rows)
        style.configure(
            "Fin.Treeview",
            background=t["surface"],
            fieldbackground=t["surface"],
            foreground=t["text_primary"],
            rowheight=36,
            borderwidth=0,
            font=self.fonts["body"],
        )
        style.configure(
            "Fin.Treeview.Heading",
            background=t["surface_raised"],
            foreground=t["text_muted"],
            font=self.fonts["caption_bold"],
            padding=(12, 8),
            borderwidth=0,
            relief="flat",
        )
        style.map(
            "Fin.Treeview",
            background=[("selected", t["primary"])],
            foreground=[("selected", "#FFFFFF")],
        )
        style.map(
            "Fin.Treeview.Heading",
            background=[("active", t["surface_hover"])],
        )

        # Thin minimal Scrollbar
        style.configure(
            "Fin.Vertical.TScrollbar",
            gripcount=0,
            background=t["surface_raised"],
            troughcolor=t["surface"],
            bordercolor=t["surface"],
            arrowcolor=t["surface"],
            width=8,
        )
        style.map(
            "Fin.Vertical.TScrollbar",
            background=[("active", t["text_muted"])],
        )
