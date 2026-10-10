import { Link } from "react-router-dom";
import { Button } from "@saffra/ui";
import logoIcon from "../assets/logo.png";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <img src={logoIcon} alt="Saffra" className="mb-6 h-14 w-14 rounded-2xl opacity-80" />
      <p className="font-display text-6xl font-bold text-primary">404</p>
      <p className="mt-2 text-sm text-muted">This page wandered off the floor plan.</p>
      <Link to="/">
        <Button className="mt-6">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
