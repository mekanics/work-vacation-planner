// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getClients } from '@/lib/services/clients';
import { calculateProjectWorkingDays, getProjects } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

/** GET /api/reports/clients — billable working-day totals grouped by client. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const includeInternal = searchParams.get('includeInternal') === 'true';
  if (!from || !to || !isValidISODate(from) || !isValidISODate(to) || from > to) {
    return NextResponse.json({ error: 'Invalid date range. Use from=YYYY-MM-DD&to=YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const [allClients, allProjects] = await Promise.all([getClients(), getProjects()]);
    const visibleClients = allClients.filter((client) => includeInternal || !client.isSystem);
    const totals = [];
    for (const client of visibleClients) {
      const clientProjects = allProjects.filter((project) => project.clientId === client.id);
      const summaries = await Promise.all(clientProjects.map((project) =>
        calculateProjectWorkingDays(project.id, from, to)
      ));
      totals.push({
        client_id: client.id,
        client_name: client.name,
        colour: client.colour,
        project_count: clientProjects.length,
        total_project_days: summaries.reduce((sum, item) => sum + (item?.total_project_days ?? 0), 0),
        holidays: summaries.reduce((sum, item) => sum + (item?.holidays ?? 0), 0),
        vacation_days: summaries.reduce((sum, item) => sum + (item?.vacation_days ?? 0), 0),
        working_days: summaries.reduce((sum, item) => sum + (item?.working_days ?? 0), 0),
      });
    }
    return NextResponse.json({ from, to, includeInternal, clients: totals });
  } catch (err) {
    console.error('Error calculating client report:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
