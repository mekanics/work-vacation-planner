import { redirect } from 'next/navigation';

export default function Home() {
  const now = new Date();
  const year = now.getFullYear();
  redirect(`/${year}`);
}
