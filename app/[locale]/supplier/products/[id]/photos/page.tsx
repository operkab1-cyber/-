import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import { getCurrentAccount } from "@/lib/queries/account";
import { createClient } from "@/lib/supabase/server";
import { PhotoUploader } from "@/components/supplier/PhotoUploader";

export default async function PlantPhotosPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "supplier" || !account.company) redirect(`/${locale}/onboarding/status`);

  const supabase = await createClient();
  const { data: plant } = await supabase
    .from("plants")
    .select("id, company_id, plant_images ( file_path, is_cover )")
    .eq("id", id)
    .single();
  if (!plant || plant.company_id !== account.company.id) notFound();

  return (
    <main className="mx-auto max-w-[800px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Фото товара</h1>

      {plant.plant_images && plant.plant_images.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-3">
          {plant.plant_images.map((img) => (
            <div key={img.file_path} className="relative aspect-square overflow-hidden rounded-md border border-border">
              <Image src={img.file_path} alt="" fill className="object-cover" sizes="200px" />
              {img.is_cover && <span className="absolute left-1 top-1 rounded-full bg-sap px-2 py-0.5 font-mono text-[10px] text-white">обложка</span>}
            </div>
          ))}
        </div>
      )}

      <PhotoUploader
        plantId={plant.id}
        companyId={account.company.id}
        locale={locale}
        images={(plant.plant_images ?? []).map((i) => ({ filePath: i.file_path, isCover: i.is_cover ?? false }))}
      />
    </main>
  );
}
