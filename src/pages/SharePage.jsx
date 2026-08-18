import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPublished, incrementViews } from "../store/usePortfolioStore.js";
import { PortfolioView } from "../components/portfolio/PortfolioView.jsx";
import { PasswordGate } from "../components/share/PasswordGate.jsx";

export function SharePage() {
  const { slug } = useParams();
  const snapshot = useMemo(() => getPublished(slug), [slug]);
  const [unlocked, setUnlocked] = useState(false);
  const viewCounted = useRef(false);
  useEffect(() => {
    viewCounted.current = false;
  }, [slug]);

  useEffect(() => {
    if (snapshot && document?.title !== undefined) {
      document.title = `${snapshot.data.profile.name} — Portfolio`;
    }
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || viewCounted.current) return;
    if (snapshot.visibility === "public" || (snapshot.visibility === "password" && unlocked)) {
      incrementViews(slug);
      viewCounted.current = true;
    }
  }, [snapshot, unlocked, slug]);

  if (!snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-center px-4">
        <div>
          <div className="text-4xl mb-4">🧭</div>
          <h1 className="text-white font-head text-xl font-semibold mb-2">No portfolio found at this link</h1>
          <p className="text-slate-400 text-sm mb-6">It may be unpublished, or this link only works on the device it was published from.</p>
          <Link to="/editor" className="text-cyan-400 text-sm underline">Go to Editor</Link>
        </div>
      </div>
    );
  }

  if (snapshot.visibility === "private") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-center px-4">
        <div>
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-white font-head text-xl font-semibold mb-2">This portfolio is private</h1>
          <p className="text-slate-400 text-sm">The owner has disabled public access to this link.</p>
        </div>
      </div>
    );
  }

  if (snapshot.visibility === "password" && !unlocked) {
    return <PasswordGate correctPassword={snapshot.password} name={snapshot.data.profile.name} onUnlock={() => setUnlocked(true)} />;
  }

  return <PortfolioView data={snapshot.data} showBrand />;
}
