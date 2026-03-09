'use client';

import Link from 'next/link';
import type { ProjectRecord } from '@/lib/services/projects';

interface ProjectCalendarLinksProps {
  projects: ProjectRecord[];
}

export function ProjectCalendarLinks({ projects }: ProjectCalendarLinksProps) {
  if (projects.length === 0) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <div className="space-y-1 mb-4">
      {projects.map((project) => (
        <div key={project.id} className="flex items-center gap-2 text-sm text-gray-600">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.colour }}
          />
          <span className="font-medium text-gray-800 flex-1 truncate">{project.name}</span>
          <Link
            href={`/projects/${project.id}/${year}/${month}`}
            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline flex-shrink-0 flex items-center gap-1"
          >
            📅 View calendar
          </Link>
        </div>
      ))}
    </div>
  );
}
