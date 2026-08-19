import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "../utils/api.js";
import { PortfolioView } from "../components/portfolio/PortfolioView.jsx";
import { PasswordGate } from "../components/share/PasswordGate.jsx";

export function SharePage() {
  const { slug } = useParams();
  const [status, setStatus] = useState("loading"); // loading | notFound | passwordLocked | error | ready
  const [portfolioData, setPortfolioData] = useState(null);
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    api
      .getBySlug(slug)
      .then(({ portfolio }) => {
        if (cancelled) return;
        // Private portfolios deliberately 404 (so the endpoint can't be used
        // to probe which slugs exist), so they land in the notFound branch
        // below rather than being reported as private here.
        if (portfolio.visibility === "password") {
          setStatus("passwordLocked");
        } else {
          setPortfolioData(portfolio.data);
          setName(portfolio.data.profile.name);
          document.title = `${portfolio.data.profile.name} — Portfolio`;
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setStatus("notFound");
        else {
          setErrorMessage(err.message || "Something went wrong loading this portfolio.");
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const unlock = async (password) => {
    const { data } = await api.unlockBySlug(slug, password);
    setPortfolioData(data);
    setName(data.profile.name);
    document.title = `${data.profile.name} — Portfolio`;
    setStatus("ready");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (status === "notFound" || status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-center px-4">
        <div>
          <div className="text-4xl mb-4">🧭</div>
          <h1 className="text-white font-head text-xl font-semibold mb-2">
            {status === "error" ? "Couldn't load this portfolio" : "No portfolio found at this link"}
          </h1>
          <p className="text-slate-400 text-sm mb-6">{status === "error" ? errorMessage : "It may be unpublished, or the link is incorrect."}</p>
          <Link to="/editor" className="text-cyan-400 text-sm underline">Go to Editor</Link>
        </div>
      </div>
    );
  }

  if (status === "passwordLocked") {
    return <PasswordGate name={name} onUnlock={unlock} />;
  }

  return <PortfolioView data={portfolioData} showBrand />;
}
