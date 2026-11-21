import { fetchPortfolio } from '@/lib/api';
import { PortfolioShell } from '@/components/portfolio/PortfolioShell';

export const instant = false;

export default async function HomePage() {
  const data = await fetchPortfolio();
  return <PortfolioShell data={data} />;
}
