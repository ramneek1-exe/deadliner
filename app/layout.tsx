import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./globals.css";

const siteUrl = "https://deadliner.net";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Deadliner — Syllabus to Calendar",
  description:
    "Upload your course syllabus (PDF, DOCX, Excel, or image) and instantly extract every deadline into a .ics calendar file for Apple Calendar, Google Calendar, or Outlook.",
  keywords: [
    "syllabus to calendar",
    "syllabus parser",
    "deadline extractor",
    "ics calendar",
    "course deadlines",
    "student calendar",
    "syllabus converter",
    "academic planner",
    "assignment tracker",
  ],
  authors: [{ url: siteUrl }],
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/favicon-light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Deadliner — Syllabus to Calendar",
    description:
      "Upload your course syllabus (PDF, DOCX, Excel, or image) and instantly extract every deadline into a .ics calendar file for Apple Calendar, Google Calendar, or Outlook.",
    siteName: "Deadliner",
    url: siteUrl,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Deadliner — Syllabus to Calendar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deadliner — Syllabus to Calendar",
    description:
      "Upload your course syllabus and instantly extract every deadline into a calendar file.",
    images: ["/opengraph-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Deadliner",
  url: siteUrl,
  description:
    "Upload your course syllabus (PDF, DOCX, Excel, or image) and instantly extract every deadline into a .ics calendar file.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern browser with JavaScript enabled",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "AI-powered deadline extraction from syllabi",
    "Supports PDF, DOCX, XLSX, JPEG, PNG, and HEIC files",
    "Export to Apple Calendar, Google Calendar, and Outlook",
    "Edit and review events before exporting",
    "Multi-course support with grouped calendar export",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
