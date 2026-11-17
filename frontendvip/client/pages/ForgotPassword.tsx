import { Link } from "react-router-dom";

import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function ForgotPassword() {
  return (
    <>
      <PlaceholderPage title="Forgot password" />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          to="/login"
          className="font-semibold text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
