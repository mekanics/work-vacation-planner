import Link from 'next/link';
import { format } from 'date-fns';
import { getProjects, calculateProjectWorkingDays } from '@/lib/services/projects';
import { ProjectsManager } from '@/components/projects/ProjectsManager';

export const metadata = {
  title: 'Projects · Work Planner',
};

export default async function ProjectsPage() {
  const allProjects = await getProjects();

  // Calculate working days for the current year for each project
  const currentYear = new Date().getFullYear();
  const yearFrom = `${currentYear}-01-01`;
  const yearTo = `${currentYear}-12-31`;

  const yearWorkingDaysEntries = await Promise.all(
    allProjects.map(async (project) => {
      const summary = await calculateProjectWorkingDays(project.id, yearFrom, yearTo);
      return [project.id, summary?.working_days ?? 0] as [string, number];
    })
  );
  const yearWorkingDays = Object.fromEntries(yearWorkingDaysEntries);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href={`/${currentYear}`}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← {currentYear} overview
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track working days per client contract. Each project defines which weekdays it's active
          and an optional date range.
        </p>
      </div>

      {/* Projects manager (client component) */}
      <ProjectsManager
        projects={allProjects}
        yearWorkingDays={yearWorkingDays}
      />

      {/* API reference */}
      {allProjects.length > 0 && (
        <div className="mt-8 p-4 bg-gray-50 border rounded-lg">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">API endpoints</h2>
          <div className="space-y-1.5 text-xs text-gray-600 font-mono">
            <div>GET /api/projects</div>
            <div>GET /api/projects/:id</div>
            <div>GET /api/projects/:id/working-days?from=YYYY-MM-DD&amp;to=YYYY-MM-DD</div>
            <div className="mt-2 text-gray-400">— or via the global endpoint —</div>
            <div>GET /api/working-days?from=...&amp;to=...&amp;project=:id</div>
          </div>
          <div className="mt-3 space-y-1 text-xs text-gray-500">
            {allProjects.slice(0, 3).map((p) => (
              <div key={p.id}>
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: p.colour }}
                />
                <span className="font-medium">{p.name}</span>
                {' '}
                <span className="text-gray-400">id: {p.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
