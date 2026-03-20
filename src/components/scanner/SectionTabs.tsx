/**
 * SectionTabs — horizontal scrollable section filter tabs for WorkspaceDetail.
 * First tab is "All Sections", then one tab per section name.
 * Selected tab has red-600 underline accent.
 *
 * Author: built_by_Beck
 */

interface SectionTabsProps {
  sections: string[];
  selectedSection: string;
  onSectionChange: (section: string) => void;
  sectionCounts?: Record<string, number>;
  totalCount?: number;
}

export function SectionTabs({
  sections,
  selectedSection,
  onSectionChange,
  sectionCounts,
  totalCount,
}: SectionTabsProps) {
  if (sections.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1 border-b border-gray-200 pb-0">
        {/* "All Sections" tab */}
        <button
          onClick={() => onSectionChange('')}
          className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            selectedSection === ''
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          All Sections
          {totalCount !== undefined && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                selectedSection === ''
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {totalCount}
            </span>
          )}
        </button>

        {sections.map((section) => {
          const count = sectionCounts?.[section];
          const isActive = selectedSection === section;

          return (
            <button
              key={section}
              onClick={() => onSectionChange(section)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {section}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    isActive
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
