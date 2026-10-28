import StatusTabs from "./StatusTabs";
import { FilterSearch, FilterChips, filterControlClass } from "./FilterBar";
import { ColumnSelector } from "./ColumnSelector";

/**
 * The toolbar every list page shares: tabs, search, the page's filters, the column picker,
 * page-specific `actions` (Export CSV, New Enquiry ...) and the active-filter chips.
 * Works with the object returned by useClientList or useStageList.
 *
 * `extraFilters` renders page-specific controls (date chips, a multi-select ...) between
 * the filter selects and the column picker.
 */
export default function ListToolbar({ list, searchPlaceholder = "Search...", actions, extraFilters, showColumns = true }) {
  const specs = list.filterSpec || [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusTabs tabs={list.tabs} activeTab={list.tab} onChange={list.setTab} />
        <FilterSearch value={list.search} onChange={list.setSearch} placeholder={searchPlaceholder} className="min-w-[220px]" />
        {specs.map((f) => (
          <select
            key={f.key}
            aria-label={f.label}
            value={list.filterValues[f.key]}
            onChange={(e) => list.setFilter(f.key, e.target.value)}
            className={`${filterControlClass} w-auto max-w-[220px]`}
          >
            <option value="all">{f.allLabel || `All ${f.label}`}</option>
            {(list.filterOptions[f.key] || []).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ))}
        {extraFilters}
        {showColumns && list.columnPanel.columns.some((c) => !c.fixed) && <ColumnSelector {...list.columnPanel} />}
        {actions}
      </div>
      <FilterChips chips={list.chips} onClearAll={list.clearAll} />
    </div>
  );
}
