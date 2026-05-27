const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full bg-highlight/30 border-b border-highlight px-4 py-2 text-center text-sm text-foreground">
      Pagamentos em modo de teste. Use o cartão <span className="font-mono font-semibold">4242 4242 4242 4242</span>, qualquer validade futura e CVC.
    </div>
  );
}