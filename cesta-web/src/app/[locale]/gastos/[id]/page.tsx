import { notFound } from "next/navigation";
import { ReceiptDetailBody } from "@/features/expenses/components/receipt-detail-body";
import { fetchReceiptSSR } from "@/features/expenses/services/receipt.server";

const CUID_PATTERN = /^c[a-z0-9]{24,}$/;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!CUID_PATTERN.test(id)) notFound();
  const receipt = await fetchReceiptSSR(id);
  if (!receipt) notFound();
  return <ReceiptDetailBody receipt={receipt} />;
}
