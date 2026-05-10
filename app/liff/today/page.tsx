import { TodayClient } from './TodayClient';

interface Props {
  searchParams: Promise<{ warn?: string }>;
}

export default async function TodayPage({ searchParams }: Props) {
  const { warn } = await searchParams;
  return <TodayClient warning={warn ?? null} />;
}
