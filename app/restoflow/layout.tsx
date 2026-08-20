import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./theme.css";

/**
 * SF Pro ei ole jaettavissa verkkofonttina, joten järjestelmäfontti tulee
 * ensin — Mac- ja iOS-käyttäjä saa aidon SF Pron. Inter on lähin
 * vastine muille alustoille.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RestoFlow",
    template: "%s · RestoFlow",
  },
  description:
    "Ravintolan kuitit, kulut, työvuorot ja työaika yhdessä näkymässä. " +
    "Ei kassajärjestelmää, ei pankkiyhteyttä — vain se mitä kuluihin ja " +
    "työaikaan tarvitaan.",
};

export default function RestoFlowLayout({ children }: LayoutProps<"/restoflow">) {
  return (
    <div className={`restoflow ${inter.variable} min-h-screen`}>{children}</div>
  );
}
