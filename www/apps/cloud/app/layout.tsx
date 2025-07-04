import type { Metadata } from "next"
import { Inter, Roboto_Mono } from "next/font/google"
import Providers from "@/providers"
import "./globals.css"
import { BareboneLayout, TightLayout } from "docs-ui"
import { config } from "@/config"
import clsx from "clsx"
import Footer from "../components/Footer"

const ogImage =
  "https://res.cloudinary.com/dza7lstvk/image/upload/v1732200992/Medusa%20Resources/opengraph-image_daq6nx.jpg"

export const metadata: Metadata = {
  title: {
    template: `%s - ${config.titleSuffix}`,
    default: config.titleSuffix || "",
  },
  description:
    "Learn about Cloud, Medusa's PaaS offering for scalable deployments.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  ),
  openGraph: {
    images: [
      {
        url: ogImage,
        type: "image/jpeg",
        height: "1260",
        width: "2400",
      },
    ],
  },
  twitter: {
    images: [
      {
        url: ogImage,
        type: "image/jpeg",
        height: "1260",
        width: "2400",
      },
    ],
  },
}

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500"],
})

export const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BareboneLayout
      htmlClassName={clsx(inter.variable, robotoMono.variable)}
      gaId={process.env.NEXT_PUBLIC_GA_ID}
    >
      <TightLayout ProvidersComponent={Providers} footerComponent={<Footer />}>
        {children}
      </TightLayout>
    </BareboneLayout>
  )
}
