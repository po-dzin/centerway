import { redirect } from "next/navigation";
import { PRODUCTS, resolveProduct, pick, withQuery, type SearchParams } from "@/lib/products";

export default async function DeclinedPage(props: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const sp = await Promise.resolve(props.searchParams as any);

  const product = resolveProduct(sp);
  const order_ref = pick(sp, ["order_ref", "orderReference", "order", "oref"]);

  const target = withQuery(PRODUCTS[product].declinedUrl, {
    product,
    order_ref: order_ref ?? undefined,
  });

  redirect(target);
}
