import { getCachedEmployees } from '@/lib/cachedReferenceData';
import { IdentitySelector } from './IdentitySelector';

export default async function LiffEntry() {
  const employees = await getCachedEmployees();
  return <IdentitySelector employees={employees} />;
}
