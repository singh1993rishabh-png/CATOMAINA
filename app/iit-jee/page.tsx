import { redirect } from 'next/navigation';

// This route is deprecated — question management is handled by the Admin Panel
// Redirect to dashboard
export default function Page() {
  redirect('/dashboard');
}
