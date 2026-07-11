import { jsonLdScriptProps } from "@/lib/seo/jsonLd";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" {...jsonLdScriptProps(data)} />;
}
