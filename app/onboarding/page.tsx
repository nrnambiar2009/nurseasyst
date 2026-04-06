import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { createSchool } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If they already have a school, skip onboarding
  const { data: existing } = await supabase
    .from("schools")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (existing) redirect("/");

  const params = await searchParams;
  const errorMsg =
    params.error === "missing_fields"
      ? "School name and principal email are required."
      : params.error === "db_error"
      ? "Database error — try again."
      : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Set up your school
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          This takes 30 seconds. You only do it once.
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form action={createSchool} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School name
            </label>
            <input
              name="school_name"
              type="text"
              required
              placeholder="Lincoln High School"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your email (nurse)
            </label>
            <input
              name="nurse_email"
              type="email"
              readOnly
              defaultValue={user.email ?? ""}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Principal email
            </label>
            <input
              name="principal_email"
              type="email"
              required
              placeholder="principal@school.edu"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            Create school →
          </button>
        </form>
      </div>
    </div>
  );
}