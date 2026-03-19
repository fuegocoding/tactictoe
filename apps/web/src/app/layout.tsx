import Providers from '@/components/Providers';

export const metadata = {
  title: 'TacticToe',
  description: 'Competitive Tic-Tac-Toe and its deeper variants.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
