import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import SettingsClient from "./[id]/settings-client";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        id: user.id,
        name: user.name ?? "",
        email: user.email,
      }}
    />
  );
}