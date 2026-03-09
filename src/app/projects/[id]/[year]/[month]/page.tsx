import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{
    id: string;
    year: string;
    month: string;
  }>;
}

export default async function ProjectMonthPageRedirect({ params }: PageProps) {
  const { id, year, month } = await params;
  const monthStr = `${year}-${month.padStart(2, '0')}`;
  redirect(`/projects/${id}?tab=calendar&month=${monthStr}`);
}
