export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { ClientsManager } from '@/components/clients/ClientsManager';
import { getClients } from '@/lib/services/clients';

export const metadata = { title: 'Clients · Work Planner' };

export default async function ClientsPage() {
  const clients = await getClients();
  const currentYear = new Date().getFullYear();
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href={`/${currentYear}`} className="text-sm text-gray-500 hover:text-gray-800">← {currentYear} overview</Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="text-sm text-gray-500 mt-1">Manage client colours and weekday templates for new projects. Internal is excluded from billable client reports by default.</p>
      </div>
      <ClientsManager clients={clients} />
    </div>
  );
}
