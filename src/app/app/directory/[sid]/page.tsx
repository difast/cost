import { DirectoryDetail } from "@/components/DirectoryDetail";
export const metadata = { title: "Редакция справочника" };
export default async function Page({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  return <DirectoryDetail id={sid} />;
}
