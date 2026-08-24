import { GuestPass } from "@/components/guest/guest-pass";

export default async function PasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestPass token={token} />;
}
