import type { Metadata } from "next";
import { currentUser } from "@/server/auth";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Checks, Example, Faq, Features, FinalCta, Hero, HowItWorks, Normative, Pricing, Problem } from "@/components/landing/Sections";
import { PLANS } from "@/lib/plans";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

const TITLE = "Оценка.Про — сервис для оценщиков недвижимости: оценка квартиры, аналоги, корректировки, отчёт";
const DESCRIPTION =
  "Рабочее место оценщика недвижимости: выписка ЕГРН, аналоги, расчёт корректировок сравнительным подходом, автоматические проверки и отчёт оценщика в DOCX и PDF.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: SITE_NAME,
    title: "Оценка недвижимости — в одном рабочем месте",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Рабочее место оценщика Оценка.Про" }],
  },
  twitter: { card: "summary_large_image", title: "Оценка недвижимости — в одном рабочем месте", description: DESCRIPTION, images: ["/og.png"] },
};

function JsonLd() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "ru",
      description: DESCRIPTION,
      publisher: { "@type": "Organization", name: COMPANY.name },
      offers: PLANS.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.price.replace(/\s/g, ""),
        priceCurrency: "RUB",
        description: p.audience,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      legalName: COMPANY.name,
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
      taxID: COMPANY.inn,
      address: { "@type": "PostalAddress", streetAddress: "ул. Маршала Катукова, д. 22 к. 1", addressLocality: "Москва", postalCode: "123592", addressCountry: "RU" },
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default async function Home() {
  const authed = !!(await currentUser().catch(() => null));
  return (
    <div className="bg-slate-50 text-slate-900">
      <JsonLd />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">К содержанию</a>
      <Header authed={authed} />
      <main id="main">
        <Hero authed={authed} />
        <Problem authed={authed} />
        <Features />
        <HowItWorks />
        <Example />
        <Checks />
        <Normative authed={authed} />
        <Pricing />
        <Faq />
        <FinalCta authed={authed} />
      </main>
      <Footer />
    </div>
  );
}
