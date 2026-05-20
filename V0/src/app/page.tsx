import { redirect } from 'next/navigation';

export default function HomePage() {
  // Middleware handles auth — unauthenticated users are redirected to /login.
  // Authenticated users landing here go to the dashboard.
  redirect('/dashboard');
}
