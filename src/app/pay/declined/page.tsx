import { redirect } from "next/navigation";
import { PRODUCTS, resolveProduct, resolveOrderRef, type SearchParams } from "@/lib/products";

// Next.js 16: searchParams приходит как Promise
export default async function DeclinedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const product = resolveProduct(sp);
  const orderRef = resolveOrderRef(sp);

  const url = new URL(PRODUCTS[product].declinedUrl);
  if (orderRef) url.searchParams.set("order_ref", orderRef);
  url.searchParams.set("product", product);

  redirect(url.toString());
}