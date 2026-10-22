import React, { useState } from 'react';
import { Check, CheckCircle2, Code2, Copy, Download, Terminal } from 'lucide-react';
import {
  PYTHON_PROJECT_FILES,
  SECTION_5_PERFORMANCE_AUDIT,
} from '../data/pythonFiles';

export const PythonWorkbenchTab: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState<number | 'ALL' | 'AUDIT'>('ALL');
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    PYTHON_PROJECT_FILES[0].path
  );
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const visibleFiles =
    selectedStage === 'ALL' || selectedStage === 'AUDIT'
      ? PYTHON_PROJECT_FILES
      : PYTHON_PROJECT_FILES.filter((f) => f.stage === selectedStage);

  const activeFile =
    visibleFiles.find((f) => f.path === selectedFilePath) ||
    visibleFiles[0] ||
    PYTHON_PROJECT_FILES[0];

  const handleCopyFile = async (path: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadFile = (path: string, content: string) => {
    const filename = path.split('/').pop() || 'finpilot.py';
    const blob = new Blob([content], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Stage Selector */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Python 3.11+ / Tkinter / ttk / Matplotlib Desktop Suite (`finpilot/`)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete, zero-placeholder multi-file Python source code across Stages 1–6 plus the Section 5 11-Rule Performance Audit
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#1E293B] px-3 py-1.5 rounded-lg">
            <Terminal className="h-3.5 w-3.5 text-indigo-500" />
            <span>cd finpilot && python3 main.py</span>
          </div>
        </div>

        {/* Stage Filter Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-4">
          {(
            [
              ['ALL', 'All 13 Files'],
              [1, 'Stage 1: Core & Shell'],
              [2, 'Stage 2: Widgets & Dashboard'],
              [3, 'Stage 3: Transactions'],
              [4, 'Stage 4: Charts & Analytics'],
              [5, 'Stage 5: Budget Planner'],
              ['AUDIT', 'Stage 6: 11-Rule Performance Audit'],
            ] as const
          ).map(([stageVal, label]) => {
            const active = selectedStage === stageVal;
            return (
              <button
                key={String(stageVal)}
                type="button"
                onClick={() => {
                  setSelectedStage(stageVal);
                  if (typeof stageVal === 'number') {
                    const first = PYTHON_PROJECT_FILES.find((f) => f.stage === stageVal);
                    if (first) setSelectedFilePath(first.path);
                  }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedStage === 'AUDIT' ? (
        /* Stage 6: 11-Rule Performance Audit Table */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Stage 6 — Section 5 Smoothness & Performance Audit (11 / 11 Rules Verified)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Every performance requirement in Section 5 is satisfied and verified in the `finpilot/` Python codebase:
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E293B] text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 px-3 w-16">Rule</th>
                  <th className="py-2.5 px-3">Requirement</th>
                  <th className="py-2.5 px-3">File & Function</th>
                  <th className="py-2.5 px-3">How It Is Satisfied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {SECTION_5_PERFORMANCE_AUDIT.map((item) => (
                  <tr key={item.ruleNumber} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />#{item.ruleNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {item.ruleTitle}
                    </td>
                    <td className="py-3 px-3 font-mono text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                      {item.fileAndLocation}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.implementationDetails}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* File Tree + Code Viewer */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-1.5">
            <div className="px-2 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Project Files ({visibleFiles.length})
            </div>
            {visibleFiles.map((file) => {
              const isSelected = file.path === activeFile.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                      : 'hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold">
                      {file.path}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      S{file.stage}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {file.summary}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1E293B] px-4 py-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-indigo-500" />
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                  {activeFile.path}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {activeFile.stageLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyFile(activeFile.path, activeFile.content)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {copiedPath === activeFile.path ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Code
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile(activeFile.path, activeFile.content)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .py
                </button>
              </div>
            </div>

            <pre className="p-4 text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[620px] overflow-y-auto">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
