import { aggregateAllData, serializeData } from "@/lib/data-aggregator";
import ClientShell from "@/components/ClientShell";

// Force dynamic rendering since we read files from disk
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await aggregateAllData();
  const serialized = serializeData(data);

  return <ClientShell data={serialized} />;
}
