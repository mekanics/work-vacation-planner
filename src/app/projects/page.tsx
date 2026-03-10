export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { getProjects, calculateProjectWorkingDays } from '@/lib/services/projects';
import { ProjectsList } from '@/components/projects/ProjectsList';

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
          Track working days per client contract. Each project defines which weekdays it&apos;s active
          and an optional date range.
        </p>
      </div>

      {/* Projects list with modal for new project */}
      <ProjectsList
        projects={allProjects}
        yearWorkingDays={yearWorkingDays}
      />
    </div>
  );
}
