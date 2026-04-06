"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function createSchool(formData: FormData) {
   const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const schoolName = formData.get("school_name") as string;
  const nurseEmail = formData.get("nurse_email") as string;
  const principalEmail = formData.get("principal_email") as string;

  if (!schoolName?.trim() || !principalEmail?.trim()) {
    // We'll handle errors via URL params to keep this a server action
    redirect("/onboarding?error=missing_fields");
  }

  const { error } = await supabase.from("schools").insert({
    school_name: schoolName.trim(),
    nurse_email: nurseEmail.trim(),
    principal_email: principalEmail.trim(),
    user_id: user.id,
  });

  if (error) {
    console.error("School insert error:", error);
    redirect("/onboarding?error=db_error");
  }

  redirect("/");
}