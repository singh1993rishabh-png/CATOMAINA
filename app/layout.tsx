import type { Metadata } from 'next';
import Navbar from './components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'CATOMAINA — CAT Exam Preparation',
  description: 'The most advanced CAT preparation platform. Mock tests, drill mode, leaderboards and detailed analysis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
