
import { useAuthProfileReady } from "deepspace";
import IncidentDashboard from "../../components/IncidentDashboard";

export default function HomePage() {
  const { isSignedIn } = useAuthProfileReady({
    requireUser: true,
  });

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080d18] text-white">
        <p className="text-lg text-slate-300">
          Please sign in to access CrisisLab.
        </p>
      </div>
    );
  }

  return <IncidentDashboard />;
}
