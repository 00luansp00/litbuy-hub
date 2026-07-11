import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { CheckoutSteps } from "./CheckoutSteps";
import type { CheckoutStep } from "@/types";

interface CheckoutLayoutProps {
  step: CheckoutStep;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function CheckoutLayout({
  step,
  title = "Finalizar compra",
  subtitle = "Revise seus itens, confirme os dados e simule o pagamento com segurança.",
  children,
}: CheckoutLayoutProps) {
  return (
    <div className="container-lit space-y-6 py-6 md:py-10">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Carrinho", to: "/carrinho" },
          { label: "Checkout" },
        ]}
      />

      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <CheckoutSteps current={step} />
      </motion.header>

      {children}
    </div>
  );
}
