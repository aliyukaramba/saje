import { PaymentStatus } from "../../../components/PaymentStatus";

export const dynamic = "force-dynamic";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const reference = ref && /^[A-Za-z0-9_-]{6,64}$/.test(ref) ? ref : null;
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/menu">{process.env.RESTAURANT_NAME ?? "Restaurant"}<span>.</span></a>
      </header>
      <PaymentStatus reference={reference} />
    </div>
  );
}
