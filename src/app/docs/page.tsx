'use client';

// See /openapi.yaml for spec
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-gray-50 px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Work &amp; Vacation Planner — API Docs
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Interactive API reference powered by Swagger UI.{' '}
          <a
            href="/openapi.yaml"
            className="text-blue-600 underline hover:text-blue-800"
            download
          >
            Download OpenAPI spec
          </a>{' '}
          · Import into n8n or any OpenAPI-compatible client using{' '}
          <code className="rounded bg-gray-200 px-1 text-xs">
            http://&lt;your-homelab-host&gt;:3000/openapi.yaml
          </code>
        </p>
      </header>
      <main>
        <SwaggerUI url="/openapi.yaml" docExpansion="list" />
      </main>
    </div>
  );
}
