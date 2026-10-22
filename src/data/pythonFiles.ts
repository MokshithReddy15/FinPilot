import mainPy from '../../finpilot/main.py?raw';
import modelsPy from '../../finpilot/models.py?raw';
import storePy from '../../finpilot/store.py?raw';
import themePy from '../../finpilot/theme.py?raw';
import animationsPy from '../../finpilot/animations.py?raw';
import widgetsPy from '../../finpilot/widgets.py?raw';
import chartsPy from '../../finpilot/charts.py?raw';
import seedPy from '../../finpilot/seed.py?raw';
import viewsInitPy from '../../finpilot/views/__init__.py?raw';
import dashboardPy from '../../finpilot/views/dashboard.py?raw';
import transactionsPy from '../../finpilot/views/transactions.py?raw';
import analyticsPy from '../../finpilot/views/analytics.py?raw';
import budgetPy from '../../finpilot/views/budget.py?raw';

export interface PythonFileEntry {
  path: string;
  stage: number;
  stageLabel: string;
  summary: string;
  content: string;
}

export const PYTHON_PROJECT_FILES: PythonFileEntry[] = [
  {
    path: 'finpilot/models.py',
    stage: 1,
    stageLabel: 'Stage 1 · Core Models & Shell',
    summary:
      '@dataclass Transaction & Budget using exact integer paise, TransactionType Enum, Indian numbering formatter (1,25,000), and YYYY-MM-DD validator.',
    content: modelsPy,
  },
  {
    path: 'finpilot/store.py',
    stage: 1,
    stageLabel: 'Stage 1 · Core Models & Shell',
    summary:
      'Zero-UI DataStore with CRUD, single-pass O(N) cached aggregations, observer/listener subscription pattern, and worker-thread JSON/CSV persistence.',
    content: storePy,
  },
  {
    path: 'finpilot/theme.py',
    stage: 1,
    stageLabel: 'Stage 1 · Core Models & Shell',
    summary:
      'Dark & Light colour token dictionaries, platform font resolver (Segoe UI / SF Pro / DejaVu Sans), 8px spacing constants, and custom ttk.Style rules.',
    content: themePy,
  },
  {
    path: 'finpilot/animations.py',
    stage: 1,
    stageLabel: 'Stage 1 · Core Models & Shell',
    summary:
      '60 FPS Animator built on root.after(16), ease_out_cubic easing, and RGB hex colour interpolation (lerp_color & animate_color) with tracked timer IDs.',
    content: animationsPy,
  },
  {
    path: 'finpilot/main.py',
    stage: 1,
    stageLabel: 'Stage 1 · Core Models & Shell',
    summary:
      'Entry point with Windows DPI awareness, 1100x700 centred window, sidebar navigation, synchronized month time-travel, dirty-view tracking, and graceful shutdown.',
    content: mainPy,
  },
  {
    path: 'finpilot/widgets.py',
    stage: 2,
    stageLabel: 'Stage 2 · Kinetic Widgets & Dashboard',
    summary:
      'Canvas-drawn VaultSimulatorCard (draggable savings slider), SegmentedPillToggle (60 FPS sliding pill), StatCard (with radial arc ring & 2px hover lift), InteractiveCashflowHorizon (Catmull-Rom splines + crosshair), and ToastNotification.',
    content: widgetsPy,
  },
  {
    path: 'finpilot/views/dashboard.py',
    stage: 2,
    stageLabel: 'Stage 2 · Kinetic Widgets & Dashboard',
    summary:
      'Interactive Dashboard with Scope SegmentedPillToggle, VaultSimulatorCard, radial Savings Rate card, 6-Month Cashflow Horizon spline & hover HUD, and filterable recent transactions stream.',
    content: dashboardPy,
  },
  {
    path: 'finpilot/seed.py',
    stage: 2,
    stageLabel: 'Stage 2 · Kinetic Widgets & Dashboard',
    summary:
      'Deterministic 6-month Indian personal finance demo generator (salary, freelance, rent, groceries, dining, bills, fuel, travel, shopping, health).',
    content: seedPy,
  },
  {
    path: 'finpilot/views/transactions.py',
    stage: 3,
    stageLabel: 'Stage 3 · Transactions View',
    summary:
      'Sliding Expense/Income SegmentedPillToggle, 1-Tap Instant Log preset chips, inline validation, sortable Treeview with 150ms debounced search, batched 5,000+ row updates, and 5s Undo toast.',
    content: transactionsPy,
  },
  {
    path: 'finpilot/charts.py',
    stage: 4,
    stageLabel: 'Stage 4 · Interactive Charts & Analytics',
    summary:
      'Figure + FigureCanvasTkAgg interactive charts (zero pyplot) with mpl_connect handlers: hover/click Donut wedge expansion (set_radius(1.08)), clickable month bars, and magnetic daily spend crosshair scrubber.',
    content: chartsPy,
  },
  {
    path: 'finpilot/views/analytics.py',
    stage: 4,
    stageLabel: 'Stage 4 · Interactive Charts & Analytics',
    summary:
      'Lazy-loaded Analytics tab with interactive Category Donut lens (+ Reset Lens), clickable Monthly Grouped Bar chart, Magnetic Daily Cumulative Spend scrubber HUD, and computed insights.',
    content: analyticsPy,
  },
  {
    path: 'finpilot/views/budget.py',
    stage: 5,
    stageLabel: 'Stage 5 · Budget Planner & Polish',
    summary:
      'Monthly category budget planner with pre-allocated reusable card slots, tactile -1k / +1k quick-step limit buttons, <70% green / 70-99% amber / 100%+ red thresholds, and edit/delete controls.',
    content: budgetPy,
  },
  {
    path: 'finpilot/views/__init__.py',
    stage: 1,
    stageLabel: 'Stage 1 · Core Models & Shell',
    summary: 'Package initializer for FinPilot view modules.',
    content: viewsInitPy,
  },
];

export interface PerformanceRuleAudit {
  ruleNumber: number;
  ruleTitle: string;
  fileAndLocation: string;
  implementationDetails: string;
}

export const SECTION_5_PERFORMANCE_AUDIT: PerformanceRuleAudit[] = [
  {
    ruleNumber: 1,
    ruleTitle: 'Zero blocking loops; 60 FPS time-based after() animations',
    fileAndLocation: 'finpilot/animations.py · Animator.animate_value() & animate_color()',
    implementationDetails:
      'Uses time.perf_counter() elapsed ratio and root.after(16, _step) with ease_out_cubic(t) and lerp_color(). Zero calls to time.sleep() anywhere in the codebase.',
  },
  {
    ruleNumber: 2,
    ruleTitle: 'Build widgets once; update in-place via itemconfig() / config() / set()',
    fileAndLocation: 'finpilot/views/*.py · build() & refresh()',
    implementationDetails:
      'Every view guards build() with self.is_built. Dashboard recent rows, budget slots, and KPI cards are pre-allocated once and updated via configure() and itemconfig().',
  },
  {
    ruleNumber: 3,
    ruleTitle: 'Canvas tags & itemconfig/coords for animated elements',
    fileAndLocation: 'finpilot/widgets.py · VaultSimulatorCard, SegmentedPillToggle, StatCard',
    implementationDetails:
      'SegmentedPillToggle slides its pill polygon via coords(); StatCard animates its radial arc extent and 2px hover lift via itemconfig/coords without clearing the Canvas.',
  },
  {
    ruleNumber: 4,
    ruleTitle: 'Batch Treeview updates; handle 5,000+ transactions smoothly',
    fileAndLocation: 'finpilot/views/transactions.py · _populate_table()',
    implementationDetails:
      'Bulk-deletes existing item IDs in one call and inserts pre-filtered tuples with pre-configured parity/type tags.',
  },
  {
    ruleNumber: 5,
    ruleTitle: 'Debounce search box (150 ms) and window <Configure> resize (100 ms)',
    fileAndLocation: 'finpilot/views/transactions.py & finpilot/main.py',
    implementationDetails:
      'Search trace calls animator.debounce("tx_search_debounce", 150, ...) and root <Configure> calls animator.debounce("window_resize", 100, ...).',
  },
  {
    ruleNumber: 6,
    ruleTitle: 'Cache aggregations in DataStore and invalidate only on mutation',
    fileAndLocation: 'finpilot/store.py · _ensure_cache() & _invalidate_cache()',
    implementationDetails:
      'Single-pass O(N) aggregation populates monthly income, expense, category, and daily dictionaries. Reads hit the cache in O(1) until a mutation sets _cache_valid = False.',
  },
  {
    ruleNumber: 7,
    ruleTitle: 'Lazy-load Analytics charts on first tab open',
    fileAndLocation: 'finpilot/main.py · switch_view() & finpilot/views/analytics.py',
    implementationDetails:
      'AnalyticsView.build() is deferred until the user clicks "Analytics" in the sidebar for the first time, keeping startup fast.',
  },
  {
    ruleNumber: 8,
    ruleTitle: 'Only refresh the visible view; mark hidden views dirty',
    fileAndLocation: 'finpilot/main.py · _on_store_change() & switch_view()',
    implementationDetails:
      'When DataStore emits an event, only self._views[self._active_view_key].refresh() runs; hidden views set view.is_dirty = True and refresh when raised.',
  },
  {
    ruleNumber: 9,
    ruleTitle: 'Background worker threads for file I/O; never touch Tk from worker thread',
    fileAndLocation: 'finpilot/store.py · save_to_disk_async() & export_csv_async()',
    implementationDetails:
      'JSON saves and CSV exports run in daemon threading.Thread workers with a threading.Lock, marshalling completion toasts back via root.after(0, ...).',
  },
  {
    ruleNumber: 10,
    ruleTitle: 'Track and cancel pending after() jobs on view hide or shutdown',
    fileAndLocation: 'finpilot/animations.py · Animator.cancel_all() & main.py · shutdown()',
    implementationDetails:
      'Animator stores every scheduled job ID in _active_jobs[key] and cancels them cleanly via root.after_cancel() on debounce reset or WM_DELETE_WINDOW.',
  },
  {
    ruleNumber: 11,
    ruleTitle: 'Fixed minimum window size (1100x700), centred on launch, responsive grid weights',
    fileAndLocation: 'finpilot/main.py · _center_window() & view grid configurations',
    implementationDetails:
      'Enforces root.minsize(1100, 700), centres window on screen using winfo_screenwidth/height, and uses columnconfigure/rowconfigure weights across all views.',
  },
];
